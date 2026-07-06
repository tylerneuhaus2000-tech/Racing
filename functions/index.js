/**
 * Gridline Shop — serverseitige PayPal-Zahlungsabwicklung (Firebase Cloud Functions).
 *
 * WARUM DAS HIER SERVERSEITIG LAUFEN MUSS:
 * Der Spiel-Client (gt3-web-racer.html) läuft im Browser und ist grundsätzlich nicht
 * vertrauenswürdig — jede Variable, jeder fetch()-Aufruf lässt sich per DevTools
 * manipulieren. Ein "Kauf" darf daher niemals bedeuten, dass der Client direkt
 * Guthaben/Freischaltungen in Firestore schreibt. Stattdessen:
 *   1. createOrder   – Client nennt nur die Item-ID, Preis kommt server­seitig aus CATALOG.
 *   2. PayPal-Checkout läuft im Client (PayPal JS SDK Buttons).
 *   3. captureOrder  – erst NACH erfolgreicher PayPal-Bestätigung wird das Entitlement/
 *      Guthaben geschrieben, und zwar per Firebase Admin SDK (umgeht Firestore-Regeln,
 *      läuft aber in einer vom Nutzer nicht kontrollierbaren Server-Umgebung).
 *   4. paypalWebhook – Sicherheitsnetz für den Fall, dass der Client nach der Zahlung
 *      abbricht, bevor captureOrder läuft (Tab-Crash, Netzwerkfehler).
 *
 * SETUP DURCH DEN NUTZER (nicht automatisierbar, siehe Plan):
 *   firebase functions:secrets:set PAYPAL_CLIENT_ID
 *   firebase functions:secrets:set PAYPAL_CLIENT_SECRET
 *   firebase functions:secrets:set PAYPAL_WEBHOOK_ID
 * Firebase-Projekt muss auf dem Blaze-Tarif laufen (Cloud Functions laufen nicht auf Spark).
 */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();

const PAYPAL_CLIENT_ID = defineSecret('PAYPAL_CLIENT_ID');
const PAYPAL_CLIENT_SECRET = defineSecret('PAYPAL_CLIENT_SECRET');
const PAYPAL_WEBHOOK_ID = defineSecret('PAYPAL_WEBHOOK_ID');
// 'sandbox' während der Entwicklung/Tests, erst nach erfolgreichem Sandbox-Testkauf
// bewusst auf 'live' umstellen (siehe Umsetzungsreihenfolge im Plan, Schritt 8).
const PAYPAL_ENV = defineString('PAYPAL_ENV', { default: 'sandbox' });

function paypalApiBase() {
  return PAYPAL_ENV.value() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

/**
 * Katalog ist die EINZIGE Quelle der Wahrheit für Preise — der Client übergibt nur
 * eine itemId, niemals einen Preis. Muss synchron zum SHOP_ITEMS-Array in
 * gt3-web-racer.html gehalten werden (dort rein informativ für die Anzeige).
 */
const CATALOG = {
  // Kosmetik-Skins
  skin_amg_gold:        { type: 'skin',    price: '2.49', currency: 'EUR', name: 'AMG GT3 — Gold Livery' },
  skin_porsche_carbon:  { type: 'skin',    price: '2.49', currency: 'EUR', name: 'Porsche 911 GT3 R — Carbon Livery' },
  // Auto-/Streckenfreischaltungen
  car_ferrari499p:      { type: 'car',     price: '4.99', currency: 'EUR', name: 'Ferrari 499P' },
  track_norisring:      { type: 'track',   price: '3.49', currency: 'EUR', name: 'Norisring' },
  // Ingame-Credits (fester, deterministischer Gegenwert — bewusst KEINE Zufallsmechanik/Lootbox)
  credits_1000:         { type: 'credits', price: '0.99', currency: 'EUR', amount: 1000, name: '1.000 Credits' },
  credits_5000:         { type: 'credits', price: '3.99', currency: 'EUR', amount: 5000, name: '5.000 Credits' },
  // Werbefrei/Premium — einmaliger Kauf, kein Abo
  premium_noads:        { type: 'premium', price: '9.99', currency: 'EUR', name: 'Premium — Werbefrei' },
};

async function paypalToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID.value()}:${PAYPAL_CLIENT_SECRET.value()}`).toString('base64');
  const r = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new Error(`PayPal OAuth fehlgeschlagen: ${r.status}`);
  const data = await r.json();
  return data.access_token;
}

/** Schreibt das Entitlement/Guthaben für ein abgeschlossenes Item. Idempotent:
 *  Aufrufer muss vorher prüfen, dass purchases/{orderId} noch nicht existiert. */
async function grantItem(uid, itemId, item) {
  if (item.type === 'credits') {
    await db.collection('wallets').doc(uid).set(
      { credits: admin.firestore.FieldValue.increment(item.amount), updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  } else if (item.type === 'premium') {
    await db.collection('wallets').doc(uid).set(
      { premium: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  } else {
    const field = item.type === 'car' ? 'unlockedCars' : item.type === 'track' ? 'unlockedTracks' : 'unlockedSkins';
    await db.collection('entitlements').doc(uid).set(
      { [field]: admin.firestore.FieldValue.arrayUnion(itemId) },
      { merge: true }
    );
  }
}

exports.createOrder = onCall({ secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Login erforderlich.');
  const uid = req.auth.uid;
  const itemId = req.data && req.data.itemId;
  const item = CATALOG[itemId];
  if (!item) throw new HttpsError('invalid-argument', 'Unbekanntes Item: ' + itemId);

  const token = await paypalToken();
  const r = await fetch(`${paypalApiBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        // uid+itemId gemeinsam kodiert, damit der Webhook (der keine Firebase-Auth-Session
        // kennt) im Bedarfsfall trotzdem korrekt zuordnen kann, wem was gutgeschrieben wird.
        custom_id: `${uid}:${itemId}`,
        amount: { currency_code: item.currency, value: item.price },
        description: item.name,
      }],
    }),
  });
  const order = await r.json();
  if (!r.ok) {
    logger.error('PayPal createOrder fehlgeschlagen', order);
    throw new HttpsError('internal', 'PayPal-Order konnte nicht erstellt werden.');
  }
  return { orderID: order.id };
});

exports.captureOrder = onCall({ secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Login erforderlich.');
  const uid = req.auth.uid;
  const { orderID, itemId } = req.data || {};
  const item = CATALOG[itemId];
  if (!orderID || !item) throw new HttpsError('invalid-argument', 'orderID/itemId fehlt oder ungültig.');

  const ref = db.collection('purchases').doc(orderID);
  if ((await ref.get()).exists) {
    // Bereits verarbeitet (z.B. durch den Webhook) — idempotent, kein Fehler.
    return { alreadyProcessed: true };
  }

  const token = await paypalToken();
  const r = await fetch(`${paypalApiBase()}/v2/checkout/orders/${orderID}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const capture = await r.json();
  if (!r.ok || capture.status !== 'COMPLETED') {
    logger.error('PayPal captureOrder nicht abgeschlossen', capture);
    throw new HttpsError('failed-precondition', 'Zahlung konnte nicht abgeschlossen werden.');
  }

  // Betrag/Währung gegen den erwarteten Katalogpreis verifizieren — niemals dem
  // Client vertrauen, auch nicht der Order-Antwort ungeprüft.
  const paid = capture.purchase_units?.[0]?.payments?.captures?.[0];
  const [orderUid, orderItemId] = (capture.purchase_units?.[0]?.custom_id || '').split(':');
  if (!paid || paid.amount?.value !== item.price || paid.amount?.currency_code !== item.currency) {
    logger.error('Betrag/Währung stimmen nicht mit Katalog überein', { paid, item });
    throw new HttpsError('failed-precondition', 'Zahlungsbetrag stimmt nicht überein.');
  }
  if (orderUid !== uid || orderItemId !== itemId) {
    logger.error('Order gehört nicht zum aufrufenden Nutzer/Item', { orderUid, orderItemId, uid, itemId });
    throw new HttpsError('permission-denied', 'Order gehört nicht zu diesem Nutzer.');
  }

  await ref.set({
    uid, itemId, itemType: item.type,
    amount: paid.amount.value, currency: paid.amount.currency_code,
    status: 'COMPLETED',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await grantItem(uid, itemId, item);
  return { success: true };
});

/**
 * Sicherheitsnetz: PayPal ruft diesen Endpoint bei Zahlungsereignissen auf, auch wenn
 * der Client nach der Zahlung nie captureOrder erreicht hat. Muss im PayPal Developer
 * Dashboard als Webhook-URL eingetragen werden (erst nach dem ersten Deploy bekannt).
 */
exports.paypalWebhook = onRequest({ secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID] }, async (req, res) => {
  try {
    const token = await paypalToken();
    const verifyRes = await fetch(`${paypalApiBase()}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_algo: req.headers['paypal-auth-algo'],
        cert_url: req.headers['paypal-cert-url'],
        transmission_id: req.headers['paypal-transmission-id'],
        transmission_sig: req.headers['paypal-transmission-sig'],
        transmission_time: req.headers['paypal-transmission-time'],
        webhook_id: PAYPAL_WEBHOOK_ID.value(),
        webhook_event: req.body,
      }),
    });
    const verification = await verifyRes.json();
    if (verification.verification_status !== 'SUCCESS') {
      logger.warn('Webhook-Signatur ungültig', verification);
      res.status(400).send('invalid signature');
      return;
    }

    const event = req.body;
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const capture = event.resource;
      const orderID = capture.supplementary_data?.related_ids?.order_id;
      const [uid, itemId] = (capture.custom_id || '').split(':');
      const item = CATALOG[itemId];
      if (orderID && uid && item) {
        const ref = db.collection('purchases').doc(orderID);
        if (!(await ref.get()).exists) {
          const amount = capture.amount;
          if (amount?.value === item.price && amount?.currency_code === item.currency) {
            await ref.set({
              uid, itemId, itemType: item.type,
              amount: amount.value, currency: amount.currency_code,
              status: 'COMPLETED', source: 'webhook',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await grantItem(uid, itemId, item);
            logger.info('Nachträglich per Webhook gutgeschrieben (Client hatte captureOrder nicht erreicht)', { orderID, uid, itemId });
          } else {
            logger.error('Webhook-Betrag stimmt nicht mit Katalog überein — nicht gutgeschrieben', { orderID, amount, item });
          }
        }
      } else {
        logger.warn('Webhook-Event konnte nicht zugeordnet werden (custom_id/order_id fehlt oder unbekanntes Item)', { orderID, custom_id: capture.custom_id });
      }
    }
    res.status(200).send('ok');
  } catch (err) {
    logger.error('Webhook-Verarbeitung fehlgeschlagen', err);
    res.status(500).send('error');
  }
});
