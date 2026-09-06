/* Firebase-Teil des GT3 Web Racer: Anmeldung, Bestenliste, Lizenzsystem,
   Shop, Stewards, Tutorial und Tagesherausforderung.
   Lag frueher als 75-KB-Inline-Block im HTML und wurde mitten im Parsen
   ausgefuehrt. Als eigene Datei mit defer: blockiert den Seitenaufbau nicht,
   wird zwischengespeichert und laeuft garantiert nach den Firebase-SDKs und
   vor DOMContentLoaded. Der Code war schon vorher eine gekapselte Funktion,
   an der Logik aendert sich nichts. */
(function(){
'use strict';

const FB_CONFIG = {
  apiKey: "AIzaSyDDDE9UVtMn40kGTm4R3-1uSoPQKoOPofk",
  authDomain: "gridline-bf8c9.firebaseapp.com",
  projectId: "gridline-bf8c9",
  storageBucket: "gridline-bf8c9.firebasestorage.app",
  messagingSenderId: "907704359886",
  appId: "1:907704359886:web:5f123aa225fa78293f699f"
};

/* Wenn die Firebase-SDKs nicht geladen wurden (Adblocker, kaputtes CDN, offline),
   wirft der Rest der Datei sofort und der Anmelde-Knopf reagiert dann gar nicht
   mehr - ohne jede Meldung. Darum hier abfangen und es dem Nutzer sagen. */
if(typeof firebase === 'undefined' || !firebase.initializeApp){
  console.error('[FB] Firebase-SDK wurde nicht geladen.');
  document.addEventListener('DOMContentLoaded', () => {
    const chip = document.getElementById('btn-fb-login-chip');
    if(chip) chip.onclick = () => alert(
      'Die Anmeldung kann gerade nicht geladen werden.\n\n' +
      'Meist blockiert ein Adblocker oder Tracking-Schutz die Google-Server ' +
      '(gstatic.com / googleapis.com). Deaktiviere ihn für grid-line.de und lade die Seite neu.'
    );
  });
  return;
}

const app  = firebase.initializeApp(FB_CONFIG);
const auth = firebase.auth();
const db   = firebase.firestore();
const fns  = firebase.functions();

// Buttons sofort sperren bis Auth-State bekannt ist
document.addEventListener('DOMContentLoaded', () => {
  ['btn-multiplayer','btn-leaderboard'].forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.classList.add('btn-login-required');
  });
  Shop.init();
  _handleStewardReplayDeepLink();
});

/* Einspruchs-Frist ab Streichung */
const STRIKE_APPEAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function _trackNm(id){
  try { const t = (typeof TRACKS !== 'undefined') ? TRACKS.find(x => x.id === id) : null; return t ? t.name : (id || '?'); }
  catch(e){ return id || '?'; }
}

/* ── Deep-Link: Replay direkt aus dem Stewards-Panel (stewards.html) öffnen ──
   URL: gt3-web-racer.html?stewardReplayDoc=<times-docId>&stewardReplayLap=<lapId>[&ev=<evId>]
   stewardReplayLap optional -> aktuelle Bestzeit des Docs.
   ev=<evId> -> spielt einen gespeicherten Beweis-Clip statt der ganzen Runde.
   Lesezugriff auf times/laps/evidence ist öffentlich (firestore.rules) — KEIN
   Login in diesem Tab nötig, um zu schauen. Für das Anlegen von Beweisen muss
   im selben Browser ein Steward-Konto bei grid-line.de angemeldet sein. */
function _handleStewardReplayDeepLink(){
  const qs = new URLSearchParams(location.search);
  const docId = qs.get('stewardReplayDoc');
  if(!docId) return;
  const lapId = qs.get('stewardReplayLap');
  const evId  = qs.get('ev');
  if(typeof Game !== 'undefined') Game._replayFromDeepLink = true;

  const parentRef = db.collection('times').doc(docId);
  const lapRef = lapId ? parentRef.collection('laps').doc(lapId) : null;

  let load;
  if(evId && lapRef){
    load = Promise.all([parentRef.get(), lapRef.collection('evidence').doc(evId).get()]).then(([ps, es]) => {
      if(!ps.exists || !es.exists) throw new Error('Aufnahme nicht gefunden.');
      const ev = es.data();
      if(ev.type !== 'clip' || !ev.clip || !ev.clip.flat) throw new Error('Diese Aufnahme ist kein Video-Clip.');
      const entry = Object.assign({}, ps.data());
      entry.replay = ev.clip;
      return { entry, allowEvidence: false };
    });
  } else {
    load = Promise.all([parentRef.get(), lapRef ? lapRef.get() : Promise.resolve(null)]).then(([ps, ls]) => {
      if(!ps.exists) throw new Error('Dieser Eintrag existiert nicht mehr.');
      const entry = Object.assign({}, ps.data());
      if(ls){
        if(!ls.exists) throw new Error('Diese Runde existiert nicht mehr (evtl. schon aufgeräumt).');
        const l = ls.data();
        entry.replay = l.replay || null;
        entry.timeMs = l.timeMs;
      }
      return { entry, allowEvidence: !!lapId };
    });
  }

  load.then(({ entry, allowEvidence }) => {
    if(!entry.replay || !entry.replay.flat) throw new Error('Für diese Runde ist kein Replay gespeichert.');
    const t0 = Date.now();
    const iv = setInterval(() => {
      const ready = typeof Game !== 'undefined' && typeof _watchLbReplay === 'function' && typeof Game.getTrackPool === 'function';
      if(ready){
        clearInterval(iv);
        _watchLbReplay(entry);
        if(allowEvidence){
          Game._stewardEvidenceCtx = { docId, lapId };
          _wireStewardEvidenceToolbar();
        }
      } else if(Date.now() - t0 > 20000){ clearInterval(iv); console.warn('[FB] Deep-Link: Spiel nicht rechtzeitig bereit.'); }
    }, 150);
  }).catch(e => { console.error('[FB] Deep-Link:', e); alert(e.message || 'Replay konnte nicht geladen werden.'); });
}

function _stewardOnline(){ return !!(fbUser && ADMIN_UIDS.includes(fbUser.uid)); }

function _evToast(msg){
  const el = document.getElementById('rpl-ev-toast');
  if(!el) return;
  el.textContent = msg; el.style.display = 'block';
  clearTimeout(_evToast._t);
  _evToast._t = setTimeout(() => { el.style.display = 'none'; }, 2600);
}

function _wireStewardEvidenceToolbar(){
  const box = document.getElementById('rpl-steward');
  if(!box) return;
  box.style.display = 'inline-flex';
  const clipBtn = document.getElementById('rpl-ev-clip');
  const shotBtn = document.getElementById('rpl-ev-shot');
  if(clipBtn && !clipBtn._wired){ clipBtn._wired = true; clipBtn.onclick = _captureStewardClip; }
  if(shotBtn && !shotBtn._wired){ shotBtn._wired = true; shotBtn.onclick = _captureStewardShot; }
}

function _evidenceRef(){
  const c = (typeof Game !== 'undefined') && Game._stewardEvidenceCtx;
  if(!c || !c.lapId) return null;
  return db.collection('times').doc(c.docId).collection('laps').doc(c.lapId).collection('evidence');
}

function _captureStewardClip(){
  if(!_stewardOnline()){ alert('Nur für eingeloggte Stewards. Melde dich im selben Browser bei grid-line.de an.'); return; }
  const ref = _evidenceRef(); if(!ref) return;
  const rep = (typeof Game !== 'undefined') && Game.replay;
  if(!rep || !rep.frames){ alert('Kein Replay aktiv.'); return; }
  const now = Game._replayT || 0;
  const frames = rep.frames.filter(f => f.t >= now - 3 && f.t <= now + 3).map(f => ({ t: f.t, cars: f.cars }));
  if(frames.length < 4){ alert('An dieser Stelle sind zu wenige Videodaten für einen Clip.'); return; }
  const clip = (typeof _encodeReplay === 'function') ? _encodeReplay(frames) : null;
  if(!clip){ alert('Clip konnte nicht kodiert werden.'); return; }
  const note = (prompt('Notiz zum Clip (optional):') || '').trim();
  _evToast('📎 Clip wird gespeichert…');
  ref.add({
    type: 'clip', at: Date.now(), by: fbUser.uid,
    byName: (fbUsername || fbUser.displayName || fbUser.email || ''),
    tSec: Math.round(now * 100) / 100, note, clip
  }).then(() => _evToast('📎 Clip gespeichert')).catch(e => { _evToast('Fehler'); alert('Speichern fehlgeschlagen: ' + e.message); });
}

function _captureStewardShot(){
  if(!_stewardOnline()){ alert('Nur für eingeloggte Stewards. Melde dich im selben Browser bei grid-line.de an.'); return; }
  const ref = _evidenceRef(); if(!ref) return;
  const note = (prompt('Notiz zum Screenshot (optional):') || '').trim();
  _evToast('📷 Screenshot…');
  Game._pendingShot = (dataUrl) => {
    if(!dataUrl){ _evToast('Screenshot fehlgeschlagen'); return; }
    ref.add({
      type: 'shot', at: Date.now(), by: fbUser.uid,
      byName: (fbUsername || fbUser.displayName || fbUser.email || ''),
      tSec: Math.round((Game._replayT || 0) * 100) / 100, note, shot: dataUrl
    }).then(() => _evToast('📷 Screenshot gespeichert')).catch(e => { _evToast('Fehler'); alert('Speichern fehlgeschlagen: ' + e.message); });
  };
}

/* Strike-Ledger-Zeile schreiben (eine pro gestrichener Runde) — vom Panel
   aufgerufen, damit der Fahrer die Streichung in "Meine Streichungen" sieht
   und binnen 30 Tagen Einspruch einlegen kann. */
async function _writeStrikeLedger(o){
  let evidenceCount = 0;
  try {
    const ev = await db.collection('times').doc(o.docId).collection('laps').doc(o.lapId).collection('evidence').get();
    evidenceCount = ev.size;
  } catch(e){}
  const struckAt = Date.now();
  return db.collection('strikes').add({
    uid: o.uid, username: o.username || null,
    docId: o.docId, lapId: o.lapId,
    trackId: o.trackId || null, carId: o.carId || null, timeMs: o.timeMs || null,
    reason: o.reason, evidenceCount,
    struckBy: fbUser ? fbUser.uid : null,
    struckByName: (fbUsername || (fbUser && (fbUser.displayName || fbUser.email)) || ''),
    struckAt,
    appealDeadline: struckAt + STRIKE_APPEAL_WINDOW_MS,
    status: 'active', restored: false, finalDeleted: false
  });
}

/* ── Helpers ── */
function fmtLap(ms){
  if(!ms || ms<=0) return '--:--.---';
  const m=Math.floor(ms/60000), s=Math.floor((ms%60000)/1000), ms3=Math.round(ms%1000);
  return `${m}:${String(s).padStart(2,'0')}.${String(ms3).padStart(3,'0')}`;
}

/* ── Auth state ── */
let fbUser = null;
let fbUsername = null; // confirmed username from Firestore

function _setAuthGatedButtons(loggedIn){
  const ids = ['btn-multiplayer','btn-leaderboard','btn-license'];
  ids.forEach(id => {
    const btn = document.getElementById(id);
    if(!btn) return;
    if(loggedIn){
      btn.classList.remove('btn-login-required');
      btn.onclick = id === 'btn-multiplayer'
        ? () => Game._openMpModal()
        : id === 'btn-leaderboard'
          ? () => openLeaderboard()
          : () => LicenseSystem.open();
    } else {
      btn.classList.add('btn-login-required');
      btn.onclick = e => { e.stopPropagation(); openAuthModal(); };
    }
  });
}

function _applyUser(name){
  // Legacy hidden elements
  const nameEl = document.getElementById('fb-user-name');
  if(nameEl){ nameEl.textContent = name; nameEl.style.display=''; }

  // New topbar UI
  const loginBtn   = document.getElementById('btn-fb-login-chip');
  const logoutBtn  = document.getElementById('btn-fb-logout-top');
  const playerInfo = document.getElementById('ms-player-info');
  const pname      = document.getElementById('ms-pname');
  if(loginBtn)   loginBtn.style.display   = 'none';
  if(logoutBtn)  logoutBtn.style.display  = '';
  if(playerInfo){ playerInfo.style.display = 'flex'; }
  if(pname) pname.textContent = name.toUpperCase();

  if(typeof MP !== 'undefined') MP.myName = name;
  _setAuthGatedButtons(true);
  LicenseSystem.load();
}

function _clearUser(){
  fbUsername = null;
  const nameEl = document.getElementById('fb-user-name');
  if(nameEl) nameEl.style.display='none';

  const loginBtn   = document.getElementById('btn-fb-login-chip');
  const logoutBtn  = document.getElementById('btn-fb-logout-top');
  const playerInfo = document.getElementById('ms-player-info');
  if(loginBtn)   loginBtn.style.display   = '';
  if(logoutBtn)  logoutBtn.style.display  = 'none';
  if(playerInfo) playerInfo.style.display = 'none';

  _setAuthGatedButtons(false);
  Shop._onAuthChanged(null);
}

// ═══════════════════════════════════════════════
// SHOP (Echtgeld-Käufe via PayPal, serverseitig über Cloud Functions verifiziert)
// ═══════════════════════════════════════════════
/* WICHTIG: Preise/Gutschriften kommen NIE von hier — SHOP_ITEMS ist nur die Anzeige-
   Vorlage. Die tatsächliche Kaufabwicklung läuft komplett über die Cloud Functions
   createOrder/captureOrder (functions/index.js), die serverseitig den Preis nachschlagen
   und erst nach verifizierter PayPal-Zahlung Guthaben/Freischaltungen in Firestore
   schreiben. Client liest wallets/entitlements nur lesend (Firestore-Regeln verbieten
   Client-Schreibzugriff komplett). */
const Shop = {
  wallet: { credits: 0, premium: false },
  localWallet: { rewardedCredits: 0, day:'', claimsToday:0, nextClaimAtMs:0 },
  entitlements: { unlockedCars: [], unlockedTracks: [], unlockedSkins: [] },
  rewarded: { busy:false, waitSeconds:0, remainingToday:10, dailyLimit:10 },
  _rewardedTimer: null,
  _walletUnsub: null,
  _userUnsub: null,
  _entUnsub: null,
  _pendingItem: null,

  // PayPal Client-ID ist öffentlich (kein Geheimnis), muss aber vom Nutzer nach dem
  // Anlegen einer PayPal-App im Developer Dashboard hier eingetragen werden.
  PAYPAL_CLIENT_ID: 'DEINE_PAYPAL_CLIENT_ID_HIER',

  isConfigured(){ return this.PAYPAL_CLIENT_ID && this.PAYPAL_CLIENT_ID !== 'DEINE_PAYPAL_CLIENT_ID_HIER'; },

  /* Nur Autos/Strecken/Liveries, die EXPLIZIT im Shop-Katalog gelistet sind, können
     überhaupt gesperrt sein — alles andere bleibt wie bisher frei nutzbar. Gilt auch für
     Skins: die bestehende freie "Classic"-Porsche-Livery ist nicht im Katalog gelistet
     und darf daher nie gesperrt erscheinen (identisches Prinzip wie bei Autos/Strecken,
     verhindert dieselbe Regressionsklasse). */
  isUnlocked(type, id){
    const catalogItem = SHOP_ITEMS.find(i => i.type === type && i.targetId === id);
    if(!catalogItem) return true; // nicht im Shop gelistet → weiterhin frei
    const arr = { car: this.entitlements.unlockedCars, track: this.entitlements.unlockedTracks, skin: this.entitlements.unlockedSkins }[type];
    return arr.includes(id);
  },

  /** Findet den Shop-Katalogeintrag für ein gesperrtes Auto/Strecke (für den
      Kaufen-Klick aus der Auswahl heraus). */
  findItemFor(type, targetId){
    return SHOP_ITEMS.find(i => i.type === type && i.targetId === targetId);
  },

  _onAuthChanged(user){
    if(this._walletUnsub){ this._walletUnsub(); this._walletUnsub=null; }
    if(this._userUnsub){ this._userUnsub(); this._userUnsub=null; }
    if(this._entUnsub){ this._entUnsub(); this._entUnsub=null; }
    if(!user){
      this.wallet = { credits:0, premium:false };
      this.localWallet = { rewardedCredits:0, day:'', claimsToday:0, nextClaimAtMs:0 };
      this.entitlements = { unlockedCars:[], unlockedTracks:[], unlockedSkins:[] };
      this._renderWallet();
      // Car-/Track-Listen wurden ggf. schon gerendert bevor der Auth-Status bekannt
      // war (Shop existierte zu dem Zeitpunkt noch nicht) — jetzt mit korrektem
      // (leerem) Entitlement-Stand neu zeichnen, damit Sperren korrekt erscheinen.
      this._refreshLocks();
      return;
    }
    this._walletUnsub = db.collection('wallets').doc(user.uid).onSnapshot(snap=>{
      this.wallet = Object.assign({credits:0,premium:false}, snap.data()||{});
      this._renderWallet();
      this._applyPremium();
    }, err=>console.warn('[Shop] wallet-Listener Fehler:', err));
    this._userUnsub = db.collection('users').doc(user.uid).onSnapshot(snap=>{
      const d = snap.data() || {};
      this.localWallet = {
        rewardedCredits: Number.isFinite(d.sparkRewardedCredits) ? d.sparkRewardedCredits : 0,
        day: d.sparkRewardedDay || '',
        claimsToday: Number.isFinite(d.sparkRewardedClaimsToday) ? d.sparkRewardedClaimsToday : 0,
        nextClaimAtMs: Number.isFinite(d.sparkRewardedNextClaimAtMs) ? d.sparkRewardedNextClaimAtMs : 0,
      };
      this._renderWallet();
    }, err=>console.warn('[Shop] user-Listener Fehler:', err));
    this._entUnsub = db.collection('entitlements').doc(user.uid).onSnapshot(snap=>{
      this.entitlements = Object.assign({unlockedCars:[],unlockedTracks:[],unlockedSkins:[]}, snap.data()||{});
      this._refreshLocks();
    }, err=>console.warn('[Shop] entitlements-Listener Fehler:', err));
  },

  _effectiveCredits(){
    return (this.wallet.credits||0) + (this.localWallet.rewardedCredits||0);
  },

  _renderWallet(){
    const c = document.getElementById('shop-wallet-credits');
    const p = document.getElementById('shop-wallet-premium');
    if(c) c.textContent = this._effectiveCredits().toLocaleString('de-DE') + ' Credits';
    if(p) p.classList.toggle('hidden', !this.wallet.premium);
    this._renderRewarded();
  },

  _utcDay(){
    const d=new Date();
    const y=d.getUTCFullYear();
    const m=String(d.getUTCMonth()+1).padStart(2,'0');
    const day=String(d.getUTCDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  },

  _fmtWait(sec){
    const s = Math.max(0, Math.floor(sec||0));
    const m = Math.floor(s/60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  },

  _renderRewarded(msg){
    const btn = document.getElementById('btn-shop-rewarded');
    const st = document.getElementById('shop-rewarded-status');
    const meta = document.getElementById('shop-rewarded-meta');
    if(!btn || !st || !meta) return;

    if(!auth.currentUser){
      btn.disabled = true;
      btn.textContent = 'Login noetig fuer Video-Bonus';
      st.textContent = 'Bitte zuerst einloggen.';
      meta.textContent = `Limit: ${this.rewarded.dailyLimit} pro Tag · Cooldown 5 Minuten`;
      return;
    }

    if(this.rewarded.busy){
      btn.disabled = true;
      btn.textContent = 'Video laeuft...';
      st.textContent = msg || 'Bitte bis zum Ende schauen.';
      meta.textContent = `Heute verfuegbar: ${this.rewarded.remainingToday}/${this.rewarded.dailyLimit}`;
      return;
    }

    if(this.rewarded.remainingToday <= 0){
      btn.disabled = true;
      btn.textContent = 'Tageslimit erreicht';
      st.textContent = msg || 'Heute sind keine weiteren Video-Boni mehr moeglich.';
      meta.textContent = `Heute verfuegbar: 0/${this.rewarded.dailyLimit}`;
      return;
    }

    if(this.rewarded.waitSeconds > 0){
      btn.disabled = true;
      btn.textContent = `Naechstes Video in ${this._fmtWait(this.rewarded.waitSeconds)}`;
      st.textContent = msg || 'Cooldown aktiv.';
      meta.textContent = `Heute verfuegbar: ${this.rewarded.remainingToday}/${this.rewarded.dailyLimit}`;
      return;
    }

    btn.disabled = false;
    btn.textContent = 'Video schauen (+500 Credits)';
    st.textContent = msg || 'Bereit: Bonus verfuegbar.';
    meta.textContent = `Heute verfuegbar: ${this.rewarded.remainingToday}/${this.rewarded.dailyLimit} · Cooldown 5 Minuten`;
  },

  _startRewardedCountdown(seconds){
    this.rewarded.waitSeconds = Math.max(0, Math.floor(seconds||0));
    if(this._rewardedTimer){ clearInterval(this._rewardedTimer); this._rewardedTimer = null; }
    this._renderRewarded();
    if(this.rewarded.waitSeconds <= 0) return;
    this._rewardedTimer = setInterval(()=>{
      this.rewarded.waitSeconds = Math.max(0, this.rewarded.waitSeconds - 1);
      this._renderRewarded();
      if(this.rewarded.waitSeconds <= 0){ clearInterval(this._rewardedTimer); this._rewardedTimer = null; }
    }, 1000);
  },

  async watchRewarded(){
    if(!auth.currentUser || this.rewarded.busy || this.rewarded.waitSeconds>0 || this.rewarded.remainingToday<=0) return;
    this.rewarded.busy = true;
    this._renderRewarded('Werbung wird abgespielt...');
    try{
      // Platzhalter bis echtes Rewarded-SDK angebunden ist.
      await new Promise(resolve=>setTimeout(resolve, 18000));
      let data = {};
      try{
        const res = await fns.httpsCallable('claimRewardedCredits')({});
        data = res && res.data ? res.data : {};
      }catch(err){
        console.warn('[Shop] Cloud Function nicht verfuegbar, nutze Spark-Fallback', err);
        data = await this._claimRewardedSpark();
      }
      if(!data.ok){
        this.rewarded.remainingToday = Number.isFinite(data.remainingToday) ? data.remainingToday : this.rewarded.remainingToday;
        if(data.reason === 'cooldown') this._startRewardedCountdown(data.waitSeconds || 0);
        if(data.reason === 'daily-limit'){ this.rewarded.remainingToday = 0; this._startRewardedCountdown(0); }
        this._renderRewarded('Bonus aktuell nicht verfuegbar.');
        return;
      }

      this.rewarded.dailyLimit = Number.isFinite(data.dailyLimit) ? data.dailyLimit : this.rewarded.dailyLimit;
      this.rewarded.remainingToday = Number.isFinite(data.remainingToday) ? data.remainingToday : this.rewarded.remainingToday;
      this._startRewardedCountdown(data.waitSeconds || 300);
      this._renderRewarded(`Bonus erhalten: +${(data.grantedCredits||500).toLocaleString('de-DE')} Credits`);
    }catch(err){
      console.error('[Shop] rewarded failed', err);
      this._renderRewarded('Fehler beim Bonus. Bitte erneut versuchen.');
    }finally{
      this.rewarded.busy = false;
      this._renderRewarded();
    }
  },

  async _claimRewardedSpark(){
    const user = auth.currentUser;
    if(!user) return { ok:false, reason:'unauthenticated' };
    const docRef = db.collection('users').doc(user.uid);
    const now = Date.now();
    const day = this._utcDay();
    const dailyLimit = this.rewarded.dailyLimit || 10;
    const cooldown = 300;

    const txRes = await db.runTransaction(async tx=>{
      const snap = await tx.get(docRef);
      const d = snap.data() || {};
      let curDay = d.sparkRewardedDay || day;
      let claimsToday = Number.isFinite(d.sparkRewardedClaimsToday) ? d.sparkRewardedClaimsToday : 0;
      let nextClaimAtMs = Number.isFinite(d.sparkRewardedNextClaimAtMs) ? d.sparkRewardedNextClaimAtMs : 0;
      let rewardedCredits = Number.isFinite(d.sparkRewardedCredits) ? d.sparkRewardedCredits : 0;

      if(curDay !== day){ curDay = day; claimsToday = 0; nextClaimAtMs = 0; }

      if(claimsToday >= dailyLimit){
        return { ok:false, reason:'daily-limit', remainingToday:0, waitSeconds:0 };
      }
      if(nextClaimAtMs > now){
        return {
          ok:false,
          reason:'cooldown',
          remainingToday: Math.max(dailyLimit-claimsToday,0),
          waitSeconds: Math.ceil((nextClaimAtMs-now)/1000),
        };
      }

      claimsToday += 1;
      nextClaimAtMs = now + cooldown*1000;
      rewardedCredits += 500;

      tx.set(docRef, {
        sparkRewardedCredits: rewardedCredits,
        sparkRewardedDay: curDay,
        sparkRewardedClaimsToday: claimsToday,
        sparkRewardedNextClaimAtMs: nextClaimAtMs,
      }, { merge:true });

      return {
        ok:true,
        reason:'granted',
        grantedCredits:500,
        claimsToday,
        remainingToday: Math.max(dailyLimit-claimsToday,0),
        waitSeconds: cooldown,
        dailyLimit,
      };
    });

    return txRes;
  },

  /* Werbefrei-Premium durchsetzen: AdSense-Anzeigen ausblenden/pausieren, falls gekauft. */
  _applyPremium(){
    if(!this.wallet.premium) return;
    document.querySelectorAll('.adsbygoogle, ins.adsbygoogle').forEach(el=>{ el.style.display='none'; });
    if(window.adsbygoogle) window.adsbygoogle.pauseAdRequests = 1;
  },

  /* Wird von der Car-/Track-Auswahl aufgerufen, um Lock-Overlays neu zu bewerten
     (z.B. direkt nach einem erfolgreichen Kauf, ohne dass ein Screen-Wechsel nötig ist). */
  _refreshLocks(){
    if(typeof Game !== 'undefined' && typeof Game._refreshShopLocks === 'function') Game._refreshShopLocks();
  },

  init(){
    const grid = document.getElementById('shop-grid');
    if(!grid) return;
    grid.innerHTML = SHOP_ITEMS.map(it=>`
      <div class="card" data-shop-id="${it.id}">
        <div class="ms-card-title">${it.name}</div>
        <div class="ms-card-desc">${it.desc}</div>
        <div style="margin-top:8px;font-family:var(--mono);color:var(--green);font-weight:700">${it.price} €</div>
        <button class="btn primary" style="margin-top:10px;width:100%" data-buy="${it.id}">Kaufen</button>
      </div>
    `).join('');
    grid.querySelectorAll('[data-buy]').forEach(btn=>{
      btn.onclick = () => this.openCheckout(btn.getAttribute('data-buy'));
    });
    const backBtn = document.getElementById('btn-back-shop');
    if(backBtn) backBtn.onclick = () => Game.showScreen('screen-start');
    const closeBtn = document.getElementById('btn-shop-checkout-close');
    if(closeBtn) closeBtn.onclick = () => this.closeCheckout();
    const rewardedBtn = document.getElementById('btn-shop-rewarded');
    if(rewardedBtn) rewardedBtn.onclick = () => this.watchRewarded();
    this._renderRewarded();
  },

  openCheckout(itemId){
    const item = SHOP_ITEMS.find(i=>i.id===itemId);
    if(!item) return;
    const hint = document.getElementById('shop-login-hint');
    if(!auth.currentUser){ if(hint) hint.style.display=''; return; }
    if(hint) hint.style.display='none';

    this._pendingItem = item;
    document.getElementById('shop-checkout-title').textContent = item.name;
    document.getElementById('shop-checkout-desc').textContent = item.desc + ' — ' + item.price + ' €';
    const statusEl = document.getElementById('shop-checkout-status');
    statusEl.textContent = '';
    const btnWrap = document.getElementById('shop-paypal-buttons');
    btnWrap.innerHTML = '';
    document.getElementById('shop-checkout').classList.remove('hidden');

    if(!this.isConfigured()){
      statusEl.textContent = 'Shop ist noch nicht eingerichtet (PayPal Client-ID fehlt).';
      return;
    }
    this._ensurePaypalSdk().then(()=>{
      if(!window.paypal){ statusEl.textContent = 'PayPal SDK konnte nicht geladen werden.'; return; }
      window.paypal.Buttons({
        createOrder: () => fns.httpsCallable('createOrder')({ itemId: item.id })
          .then(res => res.data.orderID)
          .catch(err => { statusEl.textContent = 'Fehler beim Erstellen der Bestellung.'; console.error(err); throw err; }),
        onApprove: (data) => fns.httpsCallable('captureOrder')({ orderID: data.orderID, itemId: item.id })
          .then(() => { statusEl.textContent = 'Kauf erfolgreich!'; setTimeout(()=>this.closeCheckout(), 1200); })
          .catch(err => { statusEl.textContent = 'Zahlung konnte nicht abgeschlossen werden.'; console.error(err); }),
        onError: (err) => { statusEl.textContent = 'PayPal-Fehler.'; console.error(err); },
      }).render('#shop-paypal-buttons');
    });
  },

  closeCheckout(){
    document.getElementById('shop-checkout').classList.add('hidden');
    this._pendingItem = null;
  },

  _ensurePaypalSdk(){
    if(window.paypal) return Promise.resolve();
    if(this._sdkPromise) return this._sdkPromise;
    this._sdkPromise = new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(this.PAYPAL_CLIENT_ID)}&currency=EUR`;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return this._sdkPromise;
  },
};

// ═══════════════════════════════════════════════
// STEWARDS SYSTEM
// ═══════════════════════════════════════════════
const ADMIN_UIDS = ['qg9FDw4TZWhxX7en6JHuOI6GqZt2', '25Mc4Wuwp4YxFFwNz8gtMkNI2n93'];
const ADMIN_UID = ADMIN_UIDS[0]; // kept for compat
let _stewardsUnsub = null;

function _showStewardsBanner(type, reason, penalty){
  const banner = document.getElementById('stewards-banner');
  const inner  = document.getElementById('stewards-inner');
  const typeEl = document.getElementById('stewards-type');
  const reasonEl = document.getElementById('stewards-reason');
  if(!banner) return;

  const configs = {
    investigation: { bg:'#b8860b', text:'UNDER INVESTIGATION', color:'#fff' },
    no_action:     { bg:'#1a5c2a', text:'STEWARDS DECISION — NO FURTHER ACTION', color:'#4eff8a' },
    penalty:       { bg:'#8b0000', text:'PENALTY', color:'#ff6b6b' },
  };
  const cfg = configs[type] || configs.investigation;
  inner.style.background = cfg.bg;
  typeEl.style.color = cfg.color;
  typeEl.textContent = cfg.text;
  reasonEl.textContent = penalty ? reason + ' · ' + penalty : reason;
  banner.style.display = 'block';

  // Auto-hide nach 12s (außer investigation bleibt bis nächste Nachricht)
  if(type !== 'investigation'){
    setTimeout(()=>{ banner.style.display='none'; }, 12000);
  }
}

let _stewardsLastShownTs = 0;
let _stewardsPollTimer = null;

function _handleStewardsDoc(d){
  if(!d || !d.type) return;
  const ts = d.ts || 0;
  const lastSeen = Math.max(
    parseInt(localStorage.getItem('stewards_last')||'0'),
    _stewardsLastShownTs
  );
  if(ts <= lastSeen) return;
  _stewardsLastShownTs = ts;
  localStorage.setItem('stewards_last', String(ts));
  _showStewardsBanner(d.type, d.reason||'', d.penalty||'');
  const lpDelta = parseFloat(d.lpDelta);
  if(lpDelta && !isNaN(lpDelta) && typeof LicenseSystem!=='undefined' && LicenseSystem._data){
    LicenseSystem._save({ licensePoints: lpDelta });
    console.log('[Stewards] LP geändert:', lpDelta, '→ neu:', LicenseSystem._data.licensePoints);
  }
}

function _initStewardsListener(uid){
  // Altes Polling stoppen
  if(_stewardsPollTimer){ clearInterval(_stewardsPollTimer); _stewardsPollTimer = null; }
  if(_stewardsUnsub){ try{ _stewardsUnsub(); }catch(e){} _stewardsUnsub = null; }

  const restUrl = `https://firestore.googleapis.com/v1/projects/gridline-bf8c9/databases/(default)/documents/steward_msgs/${uid}`;

  async function _poll(){
    try {
      const r = await fetch(restUrl);
      if(!r.ok) return;
      const json = await r.json();
      if(json.fields) _handleStewardsDoc(_fsDoc(json.fields));
    } catch(e) { /* Netzwerkfehler ignorieren */ }
  }

  // Sofort + alle 6 Sekunden pollen
  _poll();
  _stewardsPollTimer = setInterval(_poll, 6000);

  // Zusätzlich onSnapshot versuchen (fällt still durch wenn WebChannel kaputt)
  try {
    _stewardsUnsub = db.collection('steward_msgs').doc(uid)
      .onSnapshot(snap => {
        if(snap.exists) _handleStewardsDoc(snap.data());
      }, () => { /* WebChannel-Fehler ignorieren, Polling läuft weiter */ });
  } catch(e) {}
}

// Admin Panel
function _initAdminPanel(){
  const panel = document.getElementById('admin-panel');
  const send  = document.getElementById('adm-send');
  const close = document.getElementById('adm-close');
  const status= document.getElementById('adm-status');
  if(!panel || !send) return;

  close.onclick = () => { panel.style.display='none'; };

  // Spieler-Dropdown laden
  const loadBtn = document.getElementById('adm-load-players');
  const sel     = document.getElementById('adm-username');
  if(loadBtn) loadBtn.onclick = async () => {
    loadBtn.disabled = true;
    loadBtn.textContent = '...';
    try {
      const snap = await db.collection('usernames').get();
      sel.innerHTML = '<option value="">— Spieler wählen —</option>';
      snap.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.id;
        sel.appendChild(opt);
      });
      loadBtn.textContent = '✓';
    } catch(e) {
      loadBtn.textContent = '✗';
      status.textContent = '❌ Laden: ' + e.message;
    } finally { loadBtn.disabled = false; }
  };

  send.onclick = async () => {
    const username = sel ? sel.value.trim().toLowerCase() : '';
    const type     = document.getElementById('adm-type').value;
    const reason   = document.getElementById('adm-reason').value.trim();
    const penStr   = document.getElementById('adm-penalty').value.trim();
    const lpStr    = (document.getElementById('adm-lp-delta')?.value || '').trim();
    if(!username){ status.textContent='❌ Spieler auswählen'; return; }

    status.style.color='#8b95a1';
    status.textContent = '⏳ Sende...';
    try {
      const uSnap = await db.collection('usernames').doc(username).get();
      if(!uSnap.exists){ status.textContent='❌ Spieler nicht gefunden'; return; }
      const targetUid = uSnap.data().uid;

      const lpDelta = lpStr !== '' ? parseFloat(lpStr) : 0;
      if(lpStr !== '' && isNaN(lpDelta)){ status.textContent='❌ LP muss eine Zahl sein (z.B. -5 oder +3)'; return; }

      await db.collection('steward_msgs').doc(targetUid).set({
        type, reason, penalty: penStr, lpDelta, ts: Date.now()
      });

      status.style.color='#4eff8a';
      status.textContent = `✓ Gesendet an ${username}` + (lpDelta !== 0 ? ` · LP: ${lpDelta > 0 ? '+' : ''}${lpDelta}` : '');
    } catch(e){
      status.style.color='#ff6b6b';
      status.textContent = '❌ Fehler: ' + e.message;
      console.error('[Admin] send error:', e);
    }
  };

  /* ── Rundenzeiten-Kontrolle: alle Bestzeiten eines Spielers laden, nach
     Strecke filtern (schnellste zuerst), Replay ansehen, mit protokolliertem
     Grund streichen ── */
  const loadTimesBtn  = document.getElementById('adm-load-times');
  const timesList     = document.getElementById('adm-times-list');
  const timesTrackSel = document.getElementById('adm-times-track-sel');
  const _isAdmin = () => !!(fbUser && ADMIN_UIDS.includes(fbUser.uid));

  const _btn = (a, title, txt, col, bg, bd) =>
    `<button data-a="${a}" title="${title}" style="padding:5px 9px;background:${bg};border:1px solid ${bd};border-radius:4px;color:${col};font:700 11px var(--mono);cursor:pointer">${txt}</button>`;

  const _trackName = (id) => {
    try { const t = (typeof TRACKS !== 'undefined') ? TRACKS.find(x => x.id === id) : null; return t ? t.name : (id || '?'); }
    catch(e){ return id || '?'; }
  };

  const _playReplay = (obj, evCtx) => {
    if(!(obj && obj.replay && obj.replay.flat && obj.replay.flat.length > 5)) return;
    const p = document.getElementById('admin-panel'); if(p) p.style.display = 'none';
    // Merken, dass die Runde aus dem Stewards-Panel kam -> beim Verlassen des
    // Replays soll das Panel wieder aufgehen statt im Hauptmenü zu landen.
    if(typeof Game !== 'undefined'){
      Game._replayFromSteward = true;
      if(evCtx && evCtx.lapId){
        Game._stewardEvidenceCtx = evCtx;
        // Toolbar einblenden, sobald das Replay wirklich läuft
        const t0 = Date.now();
        const iv = setInterval(() => {
          if(Game._replayMode){ clearInterval(iv); _wireStewardEvidenceToolbar(); }
          else if(Date.now() - t0 > 15000) clearInterval(iv);
        }, 200);
      } else {
        Game._stewardEvidenceCtx = null;
      }
    }
    try { _watchLbReplay(obj); } catch(e){ console.error('[Admin] replay:', e); }
  };

  // Zustand des zuletzt geladenen Spielers — von loadTimesBtn befüllt,
  // von timesTrackSel.onchange und den Zeilen-Handlern gelesen.
  let _timesRows = [], _timesUsername = '', _timesTargetUid = '';

  function _renderTimeRow(r, rank, trackIdForRerender){
    const wrap = document.createElement('div');
    wrap.style.cssText = 'border-bottom:1px solid #1c2733;padding:7px 0';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:8px';
    const hasRep = !!(r.replay && r.replay.flat && r.replay.flat.length > 5);
    head.innerHTML =
      `<span style="width:26px;color:${rank===1?'#ffd400':'#8b95a1'};font-weight:700">P${rank}</span>`+
      `<span style="flex:1;color:#e8ecef;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(r.name||_timesUsername||'?')} · ${_esc(r.carName||r.carId||'?')}</span>`+
      `<span style="color:#8bd3ff;font-variant-numeric:tabular-nums;min-width:74px;text-align:right">${fmtLap(r.timeMs)}</span>`+
      _btn('rep', 'Replay der Bestzeit', '▶', hasRep?'#8bd3ff':'#445', '#1a2533', '#2a3a4a')+
      _btn('hist', 'Runden-Historie', '▾', '#8b95a1', '#1a2533', '#2a3a4a');
    head.querySelector('[data-a="rep"]').onclick = () => _playReplay(r);

    const histBox = document.createElement('div');
    histBox.style.cssText = 'display:none;margin:6px 0 2px 10px;padding-left:10px;border-left:2px solid #2a3a4a';
    let histLoaded = false;

    async function renderHist(){
      histBox.innerHTML = '<div style="color:#8b95a1;padding:4px 0;font-size:10px">⏳ Runden laden…</div>';
      const lapsRef = db.collection('times').doc(r._id).collection('laps');
      let lapsSnap = await lapsRef.orderBy('timeMs').get();
      // Migration: alte Bestzeit hat noch keine Historie -> aus dem Parent seeden
      if(lapsSnap.empty && r.timeMs){
        const seed = { timeMs: r.timeMs, at: r.updatedAt || firebase.firestore.FieldValue.serverTimestamp(), struck:false };
        if(r.replay) seed.replay = r.replay;
        try { await lapsRef.add(seed); lapsSnap = await lapsRef.orderBy('timeMs').get(); }
        catch(e){ histBox.innerHTML = '<div style="color:#ff6b6b;font-size:10px">Historie anlegen fehlgeschlagen: '+_esc(e.message)+'</div>'; return; }
      }
      const laps = [];
      lapsSnap.forEach(d => laps.push(Object.assign({ _id:d.id }, d.data())));
      if(!laps.length){ histBox.innerHTML = '<div style="color:#8b95a1;font-size:10px;padding:4px 0">Keine Runden gespeichert.</div>'; return; }
      histBox.innerHTML = '';
      let hrank = 0;
      laps.forEach(l => {
        const struck = !!l.struck;
        if(!struck) hrank++;
        const lr = document.createElement('div');
        lr.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px'+(struck?';opacity:.55':'');
        const lhasRep = !!(l.replay && l.replay.flat && l.replay.flat.length > 5);
        lr.innerHTML =
          `<span style="width:26px;color:#8b95a1">${struck ? '—' : '#'+hrank}</span>`+
          `<span style="flex:1;color:${struck?'#ff8a94':'#e8ecef'};font-variant-numeric:tabular-nums">${fmtLap(l.timeMs)}${struck?` · <span style="font-size:10px">GESTRICHEN: ${_esc(l.struckReason||'—')}</span>`:''}</span>`+
          (lhasRep ? _btn('lrep','Replay dieser Runde','▶','#8bd3ff','#1a2533','#2a3a4a') : '')+
          (struck ? '' : _btn('lstr','Diese Runde streichen','✕','#ff8a94','#3a0d12','#ff2e3d'));
        if(lhasRep) lr.querySelector('[data-a="lrep"]').onclick = () => _playReplay(l, { docId: r._id, lapId: l._id });
        const strBtn = lr.querySelector('[data-a="lstr"]');
        if(strBtn) strBtn.onclick = async () => {
          if(!_isAdmin()) return;
          const reason = prompt(`Grund für die Streichung dieser Runde?\n\n${_trackName(r.trackId)} · ${fmtLap(l.timeMs)}\n\nz.B. "Corner Cut Kurve 3"`);
          if(reason == null || !reason.trim()) return;
          const rsn = reason.trim();
          lr.style.opacity = '0.4';
          const errs = [];
          let okStrike = false;
          try {
            await lapsRef.doc(l._id).update({ struck:true, struckReason:rsn, struckBy:(fbUser?fbUser.uid:null), struckAt:Date.now() });
            okStrike = true;
          } catch(e){ errs.push('Streichen: '+e.message); console.error('[Admin] lap strike:', e); }

          let newBest = null;
          if(okStrike){
            try { newBest = await _recomputeParentTime(r._id, {
              name:r.name, uid:_timesTargetUid, carName:r.carName||r.carId, classType:r.classType, trackId:r.trackId, carId:r.carId
            }); }
            catch(e){ errs.push('Neuberechnung: '+e.message); console.error('[Admin] recompute:', e); }
          }
          try {
            await db.collection('steward_actions').add({
              type:'lap_struck', targetUid:_timesTargetUid, username:_timesUsername, docId:r._id, lapId:l._id,
              trackId:r.trackId||null, carId:r.carId||null, timeMs:l.timeMs||null,
              reason:rsn, by:(fbUser?fbUser.uid:null), at:Date.now()
            });
          } catch(e){ errs.push('Protokoll: '+e.message); }
          try {
            await db.collection('steward_msgs').doc(_timesTargetUid).set({
              type:'penalty',
              reason: `Rundenzeit gestrichen · ${_trackName(r.trackId)}: ${rsn}. ` + (newBest ? `Neue Bestzeit: ${fmtLap(newBest.timeMs)}` : 'Keine gültige Zeit mehr auf dieser Strecke.'),
              penalty:'Zeit annulliert', lpDelta:0, ts:Date.now()
            });
          } catch(e){ errs.push('Benachrichtigung: '+e.message); }
          if(okStrike){
            try {
              await _writeStrikeLedger({
                uid:_timesTargetUid, username:_timesUsername, docId:r._id, lapId:l._id,
                trackId:r.trackId, carId:r.carId, timeMs:l.timeMs, reason:rsn
              });
            } catch(e){ errs.push('Strike-Ledger: '+e.message); }
          }

          if(okStrike){
            if(newBest){ r.timeMs = newBest.timeMs; r.replay = newBest.replay || null; }
            else {
              r.timeMs = null;
              const i = _timesRows.indexOf(r); if(i >= 0) _timesRows.splice(i, 1);
            }
            _renderTimesForTrack(trackIdForRerender);   // Ränge + Bestzeiten neu ordnen
            try {
              const lbSel = document.getElementById('lb-track-sel');
              const lbScreen = document.getElementById('screen-leaderboard');
              if(lbSel && lbScreen && !lbScreen.classList.contains('hidden') && lbSel.value === r.trackId) _loadLbForTrack(r.trackId);
            } catch(e){}
            status.style.color = errs.length ? '#ffb020' : '#4eff8a';
            status.textContent = (newBest ? `✓ Gestrichen · neue Bestzeit ${fmtLap(newBest.timeMs)}` : '✓ Gestrichen · keine gültige Zeit mehr')
              + (errs.length ? `  ⚠ ${errs.join(' | ')}` : '');
          } else {
            lr.style.opacity = '1';
            status.style.color = '#ff6b6b';
            status.textContent = '❌ ' + errs.join(' | ') + '  (Regeln deployed? firebase deploy --only firestore:rules)';
          }
        };
        histBox.appendChild(lr);

        // Beweismaterial zu dieser Runde (Clips ±3s / Screenshots)
        const evRow = document.createElement('div');
        evRow.style.cssText = 'margin:0 0 4px 26px';
        histBox.appendChild(evRow);
        const evCol = db.collection('times').doc(r._id).collection('laps').doc(l._id).collection('evidence');
        evCol.orderBy('at').get().then(es => {
          if(es.empty) return;
          const toggle = document.createElement('button');
          toggle.style.cssText = 'padding:3px 8px;background:#2d0057;border:1px solid #7c3aed;border-radius:4px;color:#d8b4fe;font:700 9px var(--mono);cursor:pointer';
          toggle.textContent = `📎 ${es.size} BEWEIS${es.size===1?'':'E'}`;
          const box = document.createElement('div');
          box.style.display = 'none';
          box.style.cssText = 'display:none;margin:6px 0';
          toggle.onclick = () => {
            const open = box.style.display !== 'none';
            box.style.display = open ? 'none' : 'block';
            if(open || box._built) return;
            box._built = true;
            const parts = [];
            es.forEach(d => {
              const e = d.data();
              const when = _fmtDate(new Date(e.at || 0));
              if(e.type === 'shot' && e.shot){
                parts.push(`<div style="margin:6px 0"><img src="${e.shot}" style="max-width:320px;width:100%;border-radius:6px;border:1px solid #2a3a4a"><div style="color:#8b95a1;font-size:9px">📷 ${when}${e.note?' · '+_esc(e.note):''}</div></div>`);
              } else if(e.type === 'clip'){
                const url = `gt3-web-racer.html?stewardReplayDoc=${encodeURIComponent(r._id)}&stewardReplayLap=${encodeURIComponent(l._id)}&ev=${encodeURIComponent(d.id)}`;
                parts.push(`<div style="margin:6px 0"><a href="${url}" target="_blank" style="padding:4px 9px;background:#2d0057;border:1px solid #7c3aed;border-radius:4px;color:#d8b4fe;font:700 9px var(--mono);text-decoration:none">▶ CLIP ±3s</a><span style="color:#8b95a1;font-size:9px;margin-left:6px">${when}${e.note?' · '+_esc(e.note):''}</span></div>`);
              }
            });
            box.innerHTML = parts.join('');
          };
          evRow.appendChild(toggle);
          evRow.appendChild(box);
        }).catch(()=>{});
      });
    }

    head.querySelector('[data-a="hist"]').onclick = async () => {
      const open = histBox.style.display !== 'none';
      histBox.style.display = open ? 'none' : 'block';
      head.querySelector('[data-a="hist"]').textContent = open ? '▾' : '▴';
      if(!open && !histLoaded){ histLoaded = true; try { await renderHist(); } catch(e){ histBox.innerHTML = '<div style="color:#ff6b6b;font-size:10px">'+_esc(e.message)+'</div>'; } }
    };

    wrap.appendChild(head);
    wrap.appendChild(histBox);
    timesList.appendChild(wrap);
  }

  // Rendert die Zeiten des geladenen Spielers auf EINER Strecke, schnellste zuerst.
  function _renderTimesForTrack(trackId){
    timesList.innerHTML = '';
    if(!trackId){ timesList.innerHTML = '<div style="color:#8b95a1;padding:8px 0">Strecke wählen.</div>'; return; }
    const rows = _timesRows.filter(r => r.trackId === trackId).sort((a,b) => (a.timeMs||0) - (b.timeMs||0));
    if(!rows.length){ timesList.innerHTML = '<div style="color:#8b95a1;padding:8px 0">Keine gültige Zeit mehr auf dieser Strecke.</div>'; return; }
    rows.forEach((r, i) => _renderTimeRow(r, i + 1, trackId));
  }

  if(timesTrackSel) timesTrackSel.onchange = () => _renderTimesForTrack(timesTrackSel.value);

  if(loadTimesBtn && timesList) loadTimesBtn.onclick = async () => {
    if(!_isAdmin()){ status.style.color='#ff6b6b'; status.textContent='❌ Keine Berechtigung'; return; }
    const username = sel ? sel.value.trim().toLowerCase() : '';
    if(!username){ status.style.color='#ff6b6b'; status.textContent='❌ Erst oben einen Spieler wählen'; return; }
    timesList.innerHTML = '<div style="color:#8b95a1;padding:8px 0">⏳ Laden…</div>';
    if(timesTrackSel) timesTrackSel.innerHTML = '<option value="">— lädt —</option>';
    try {
      const uSnap = await db.collection('usernames').doc(username).get();
      if(!uSnap.exists){ timesList.innerHTML = '<div style="color:#ff6b6b;padding:8px 0">Spieler nicht gefunden</div>'; return; }
      const targetUid = uSnap.data().uid;
      const snap = await db.collection('times').where('uid','==',targetUid).get();
      const rows = [];
      snap.forEach(d => rows.push(Object.assign({ _id: d.id }, d.data())));
      _timesRows = rows; _timesUsername = username; _timesTargetUid = targetUid;

      if(!rows.length){
        if(timesTrackSel) timesTrackSel.innerHTML = '<option value="">— keine Zeiten —</option>';
        timesList.innerHTML = '<div style="color:#8b95a1;padding:8px 0">Keine Rundenzeiten für diesen Spieler.</div>';
        return;
      }

      // Strecken-Dropdown: eine Strecke wählen -> nur deren Zeiten sehen (schnellste zuerst)
      const counts = {};
      rows.forEach(r => { counts[r.trackId] = (counts[r.trackId]||0) + 1; });
      const trackIds = Object.keys(counts).sort((a,b) => _trackName(a).localeCompare(_trackName(b)));
      if(timesTrackSel){
        timesTrackSel.innerHTML = '';
        trackIds.forEach(id => {
          const o = document.createElement('option');
          o.value = id; o.textContent = `${_trackName(id)} (${counts[id]})`;
          timesTrackSel.appendChild(o);
        });
        timesTrackSel.value = trackIds[0];
      }
      _renderTimesForTrack(trackIds[0]);
      status.style.color = '#8b95a1';
      status.textContent = `${rows.length} Zeit(en) über ${trackIds.length} Strecke(n) für ${username} — Strecke oben wählen`;
    } catch(e){
      timesList.innerHTML = '<div style="color:#ff6b6b;padding:8px 0">Fehler: ' + _esc(e.message) + '</div>';
      console.error('[Admin] load times:', e);
    }
  };
}

// Tastenkombination: Ctrl+Shift+A
document.addEventListener('keydown', e => {
  if(e.ctrlKey && e.shiftKey && e.key === 'A'){
    if(fbUser && ADMIN_UIDS.includes(fbUser.uid)){
      const p = document.getElementById('admin-panel');
      if(p) p.style.display = p.style.display==='flex' ? 'none' : 'flex';
    }
  }
  // Replay controls
  if(typeof Game !== 'undefined' && Game._replayMode){
    if(e.code === 'ArrowRight'){
      e.preventDefault();
      Game._replayT = Math.min(Game._replayT + 5, Game.replay.maxT);
    } else if(e.code === 'ArrowLeft'){
      e.preventDefault();
      Game._replayT = Math.max(Game._replayT - 5, Game.replay.minT);
    } else if(e.code === 'F2'){
      e.preventDefault();
      const bar = document.getElementById('replay-bar');
      const ov  = document.getElementById('replay-overlay');
      if(bar) bar.classList.toggle('hidden');
      if(ov)  ov.classList.toggle('hidden');
    } else if(e.code === 'KeyC'){
      e.preventDefault();
      Game._replayCam = (Game._replayCam + 1) % 5;
      Game._replayBroadcastT = 0;
      Game._replayCamSnap = true;
    }
  }
});

// Ergebnis einer Google-Anmeldung per Weiterleitung einsammeln (Fallback zum Pop-up).
auth.getRedirectResult().then(res => {
  if(res && res.user) closeAuthModal();
}).catch(e => {
  document.addEventListener('DOMContentLoaded', () => {
    openAuthModal();
    zeigeAuthFehler(e);
  });
});

auth.onAuthStateChanged(user => {
  fbUser = user;
  if(!user){ _clearUser(); return; }

  // Sofort Buttons entsperren mit Fallback-Name — kein Warten auf Firestore
  const fallbackName = user.displayName || user.email?.split('@')[0] || 'Fahrer';
  _applyUser(fallbackName);
  Shop._onAuthChanged(user);

  // Stewards Listener starten
  _initStewardsListener(user.uid);
  _initMyStrikes(user.uid);
  if(ADMIN_UIDS.includes(user.uid)){
    _initAdminPanel();
    const adminBtn = document.getElementById('btn-admin-panel');
    if(adminBtn){
      adminBtn.style.display = 'inline-block';
      adminBtn.onclick = () => {
        const p = document.getElementById('admin-panel');
        if(p) p.style.display = 'flex';
      };
    }
  }

  // Dann Firestore-Profil nachladen (Username + Lizenz-Stats)
  db.collection('users').doc(user.uid).get().then(snap => {
    if(snap.exists && snap.data().username){
      fbUsername = snap.data().username;
      // Update name display, keep buttons unlocked
      const pname = document.getElementById('ms-pname');
      if(pname) pname.textContent = fbUsername.toUpperCase();
      const nameEl = document.getElementById('fb-user-name');
      if(nameEl) nameEl.textContent = fbUsername;
      if(typeof MP !== 'undefined') MP.myName = fbUsername;
      LicenseSystem.load();
    } else if(!snap.exists || !snap.data()?.username) {
      // Kein Username gesetzt → Username-Modal anzeigen
      document.getElementById('fb-username-modal').classList.remove('hidden');
      document.getElementById('fb-auth-modal').classList.add('hidden');
      const inp = document.getElementById('fb-username-input');
      if(user.displayName) inp.value = user.displayName.replace(/[^a-zA-Z0-9_]/g,'').slice(0,20);
      inp.dispatchEvent(new Event('input'));
      inp.focus();
    }
  }).catch(err => {
    console.warn('[FB] Profil laden fehlgeschlagen:', err.message);
    // Buttons bleiben entsperrt mit Fallback-Name
  });
});

/* ══════════════════════════════════════════════════════
   FAHRER-DASHBOARD: "MEINE STREICHUNGEN" + EINSPRÜCHE
   ══════════════════════════════════════════════════════ */
let _myStrikesData = { strikes: [], appeals: {} };

function _carNm(id){
  try { const c = (typeof CARS !== 'undefined') ? CARS.find(x => x.id === id) : null; return c ? (c.name || c.id) : (id || '?'); }
  catch(e){ return id || '?'; }
}

function _initMyStrikes(uid){
  const btn = document.getElementById('btn-my-strikes');
  const modal = document.getElementById('strikes-modal');
  if(!btn || !modal) return;

  const closeBtn = document.getElementById('strikes-close');
  if(closeBtn && !closeBtn._wired){ closeBtn._wired = true; closeBtn.onclick = () => { modal.style.display = 'none'; }; }
  if(!modal._wired){ modal._wired = true; modal.addEventListener('click', e => { if(e.target === modal) modal.style.display = 'none'; }); }
  if(!btn._wired){
    btn._wired = true;
    btn.onclick = () => { modal.style.display = 'flex'; _renderMyStrikes(); };
  }

  const reload = () => {
    Promise.all([
      db.collection('strikes').where('uid', '==', uid).get(),
      db.collection('appeals').where('uid', '==', uid).get()
    ]).then(([sSnap, aSnap]) => {
      const strikes = [];
      sSnap.forEach(d => strikes.push(Object.assign({ _id: d.id }, d.data())));
      strikes.sort((a, b) => (b.struckAt || 0) - (a.struckAt || 0));
      const appeals = {};
      aSnap.forEach(d => { const a = d.data(); appeals[a.strikeId] = Object.assign({ _id: d.id }, a); });
      _myStrikesData = { strikes, appeals };

      const active = strikes.filter(s => !s.restored);
      if(active.length){
        btn.style.display = 'inline-block';
        const badge = document.getElementById('my-strikes-badge');
        const pending = active.filter(s => {
          const ap = appeals[s._id];
          return !s.finalDeleted && (!ap || ap.status === 'open');
        }).length;
        if(badge){
          if(pending){ badge.style.display = 'inline-block'; badge.textContent = pending; }
          else badge.style.display = 'none';
        }
      } else {
        btn.style.display = 'none';
      }
      if(modal.style.display === 'flex') _renderMyStrikes();
    }).catch(e => console.warn('[FB] Streichungen laden:', e.message));
  };
  reload();
  _initMyStrikes._reload = reload;
}

function _renderMyStrikes(){
  const list = document.getElementById('strikes-list');
  if(!list) return;
  const { strikes, appeals } = _myStrikesData;
  if(!strikes.length){
    list.innerHTML = '<div style="color:#8b95a1;padding:24px 0;text-align:center">Keine gestrichenen Zeiten. Sauber gefahren. 🏁</div>';
    return;
  }
  list.innerHTML = strikes.map(s => {
    const ap = appeals[s._id];
    const now = Date.now();
    const deadline = s.appealDeadline || ((s.struckAt || now) + STRIKE_APPEAL_WINDOW_MS);
    const daysLeft = Math.ceil((deadline - now) / 86400000);
    const canAppeal = !s.restored && !s.finalDeleted && !ap && daysLeft > 0;

    let statusHtml;
    if(s.restored){
      statusHtml = '<span style="color:#39d98a;font-weight:700">✔ WIEDERHERGESTELLT</span>';
    } else if(s.finalDeleted){
      statusHtml = '<span style="color:#ff2e3d;font-weight:700">✖ ENDGÜLTIG GELÖSCHT</span>';
    } else if(ap && ap.status === 'open'){
      statusHtml = '<span style="color:#ffcc00;font-weight:700">⏳ EINSPRUCH IN PRÜFUNG</span>';
    } else if(ap && ap.status === 'upheld'){
      statusHtml = '<span style="color:#39d98a;font-weight:700">✔ EINSPRUCH STATTGEGEBEN</span>';
    } else if(ap && ap.status === 'rejected'){
      statusHtml = '<span style="color:#ff2e3d;font-weight:700">✖ EINSPRUCH ABGELEHNT</span>';
    } else if(daysLeft > 0){
      statusHtml = `<span style="color:#ff8a94;font-weight:700">GESTRICHEN</span> · <span style="color:#8b95a1">noch ${daysLeft} Tag${daysLeft===1?'':'e'} für Einspruch</span>`;
    } else {
      statusHtml = '<span style="color:#ff8a94;font-weight:700">GESTRICHEN</span> · <span style="color:#8b95a1">Einspruchsfrist abgelaufen</span>';
    }

    return `<div style="border:1px solid #2a3a4a;border-radius:8px;padding:14px;margin-bottom:12px;background:#0a1420">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="font-weight:700;color:#e8edf2">${_esc(_trackNm(s.trackId))} · ${_esc(_carNm(s.carId))}</div>
        <div style="font-family:var(--mono);color:#ff8a94;font-weight:700">${s.timeMs ? _esc(fmtLap(s.timeMs)) : '—'}</div>
      </div>
      <div style="color:#8b95a1;font-size:11px;margin-top:6px">Gestrichen am ${_fmtDate(new Date(s.struckAt || 0))}${s.struckByName ? ' von ' + _esc(s.struckByName) : ''}</div>
      <div style="margin-top:8px;color:#c9d1d9;font-size:12px"><b style="color:#8b95a1">Begründung:</b> ${_esc(s.reason || '—')}</div>
      <div style="margin-top:8px;font-size:11px">${statusHtml}</div>
      ${ap && ap.driverReason ? `<div style="margin-top:6px;font-size:11px;color:#8b95a1"><b>Dein Einspruch:</b> ${_esc(ap.driverReason)}</div>` : ''}
      ${ap && ap.decisionNote ? `<div style="margin-top:6px;font-size:11px;color:#8b95a1"><b>Steward-Entscheid:</b> ${_esc(ap.decisionNote)}</div>` : ''}
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        ${(s.evidenceCount ? `<button data-ev="${s._id}" style="padding:6px 12px;background:#2d0057;border:1px solid #7c3aed;border-radius:4px;color:#d8b4fe;font:700 10px var(--mono);cursor:pointer">📎 ${s.evidenceCount} BEWEIS${s.evidenceCount===1?'':'E'} ANSEHEN</button>` : '')}
        ${(canAppeal ? `<button data-appeal="${s._id}" style="padding:6px 12px;background:#3a0d12;border:1px solid #ff2e3d;border-radius:4px;color:#ff8a94;font:700 10px var(--mono);cursor:pointer">⚖ EINSPRUCH EINLEGEN</button>` : '')}
      </div>
      <div data-evbox="${s._id}"></div>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-appeal]').forEach(b => {
    b.onclick = () => _fileAppeal(b.getAttribute('data-appeal'));
  });
  list.querySelectorAll('[data-ev]').forEach(b => {
    b.onclick = () => _showMyEvidence(b.getAttribute('data-ev'), b);
  });
}

function _showMyEvidence(strikeId, btn){
  const s = _myStrikesData.strikes.find(x => x._id === strikeId);
  if(!s) return;
  const box = document.querySelector(`[data-evbox="${strikeId}"]`);
  if(!box) return;
  if(box._open){ box.innerHTML = ''; box._open = false; return; }
  box._open = true;
  box.innerHTML = '<div style="color:#8b95a1;font-size:10px;padding:8px 0">Beweise laden…</div>';
  db.collection('times').doc(s.docId).collection('laps').doc(s.lapId).collection('evidence')
    .orderBy('at').get().then(snap => {
      if(snap.empty){ box.innerHTML = '<div style="color:#8b95a1;font-size:10px;padding:8px 0">Keine Beweise gespeichert.</div>'; return; }
      const parts = [];
      snap.forEach(d => {
        const e = d.data();
        const when = _fmtDate(new Date(e.at || 0));
        if(e.type === 'shot' && e.shot){
          parts.push(`<div style="margin:8px 0"><img src="${e.shot}" style="width:100%;border-radius:6px;border:1px solid #2a3a4a"><div style="color:#8b95a1;font-size:10px;margin-top:3px">📷 ${when}${e.note ? ' · ' + _esc(e.note) : ''}</div></div>`);
        } else if(e.type === 'clip'){
          const url = `?stewardReplayDoc=${encodeURIComponent(s.docId)}&stewardReplayLap=${encodeURIComponent(s.lapId)}&ev=${encodeURIComponent(d.id)}`;
          parts.push(`<div style="margin:8px 0"><a href="${url}" target="_blank" style="display:inline-block;padding:6px 12px;background:#2d0057;border:1px solid #7c3aed;border-radius:4px;color:#d8b4fe;font:700 10px var(--mono);text-decoration:none">▶ CLIP ±3s ABSPIELEN</a><span style="color:#8b95a1;font-size:10px;margin-left:8px">${when}${e.note ? ' · ' + _esc(e.note) : ''}</span></div>`);
        }
      });
      box.innerHTML = parts.join('');
    }).catch(e => { box.innerHTML = `<div style="color:#ff8a94;font-size:10px;padding:8px 0">Fehler: ${_esc(e.message)}</div>`; });
}

function _fileAppeal(strikeId){
  const s = _myStrikesData.strikes.find(x => x._id === strikeId);
  if(!s || !fbUser) return;
  const deadline = s.appealDeadline || ((s.struckAt || 0) + STRIKE_APPEAL_WINDOW_MS);
  if(Date.now() > deadline){ alert('Die Einspruchsfrist (30 Tage ab Streichung) ist abgelaufen.'); return; }
  if(_myStrikesData.appeals[strikeId]){ alert('Für diese Streichung liegt bereits ein Einspruch vor.'); return; }
  const why = (prompt('Warum sollte diese Zeit wiederhergestellt werden? Begründe deinen Einspruch — ein Steward prüft ihn erneut:') || '').trim();
  if(!why){ return; }
  if(why.length < 10){ alert('Bitte gib eine kurze Begründung an (mind. 10 Zeichen).'); return; }
  db.collection('appeals').add({
    uid: fbUser.uid,
    username: fbUsername || null,
    strikeId,
    docId: s.docId, lapId: s.lapId,
    trackId: s.trackId || null, carId: s.carId || null, timeMs: s.timeMs || null,
    strikeReason: s.reason || null,
    driverReason: why,
    status: 'open',
    createdAt: Date.now(),
    struckAt: s.struckAt || null
  }).then(() => {
    alert('Einspruch eingereicht. Du siehst den Status hier im Dashboard.');
    if(_initMyStrikes._reload) _initMyStrikes._reload();
  }).catch(e => alert('Einspruch fehlgeschlagen: ' + e.message));
}

/* ── Replay-Frames -> kompaktes flaches Array (nur Spieler-Car) ── */
function _encodeReplay(replayFrames){
  if(!replayFrames || replayFrames.length <= 5) return null;
  const base = replayFrames[0].t;
  const flat = [];
  replayFrames.forEach(f => {
    const c = f.cars[0];
    if(!c) return;
    flat.push(
      /* Zeit auf 10 statt 100 ms runden: Aufnahme läuft mit ~40 Hz (~25 ms
         Frameabstand). Mit 100-ms-Rundung landeten ~4 aufeinanderfolgende
         Frames auf demselben Zeitstempel -> beim Abspielen fielen effektiv
         3 von 4 Frames weg (~10 fps statt ~40 fps) = das Ruckeln. */
      Math.round((f.t - base) * 100) / 100,
      Math.round(c.x * 10) / 10,
      Math.round(c.z * 10) / 10,
      Math.round(c.y * 100) / 100,
      Math.round(c.h * 1000) / 1000,
      Math.round((c.vx || 0) * 10) / 10,
      Math.round((c.thr || 0) * 100) / 100,
      Math.round((c.brk || 0) * 100) / 100,
      Math.round((c.str || 0) * 100) / 100
    );
  });
  return { base, color: replayFrames[0].cars[0]?.color || 0xff2e3d, flat, v:2 };
}

const LAPS_MAX_VALID  = 50;  // so viele gültige Runden bleiben nachrückbar
const LAPS_MAX_STRUCK = 50;  // Audit-Historie gestrichener Runden

/* ── Parent times/{docId} = schnellste NICHT gestrichene Runde aus laps/.
   Bleibt keine gültige Runde übrig -> Parent löschen (Fahrer fällt aus der
   Bestenliste). Anschließend prunen: LAPS_MAX_VALID schnellste gültige +
   bis LAPS_MAX_STRUCK gestrichene (Audit) behalten — bei nur einer PB pro
   Session reicht das für sehr viele Streichungen in Folge, bevor eine
   Strecke wirklich leerläuft. `meta` liefert name/uid/carName/... — fehlt
   es, wird der bestehende Parent gelesen. Gibt die neue Bestzeit (oder
   null) zurück. ── */
async function _recomputeParentTime(docId, meta){
  const parentRef = db.collection('times').doc(docId);
  const lapsRef   = parentRef.collection('laps');
  if(!meta){
    const p = await parentRef.get();
    meta = p.exists ? p.data() : null;
  }
  const snap = await lapsRef.orderBy('timeMs').get();
  const laps = [];
  snap.forEach(d => laps.push(Object.assign({ _id: d.id }, d.data())));
  const valid = laps.filter(l => !l.struck);

  if(valid.length === 0){
    await parentRef.delete().catch(()=>{});
  } else if(meta){
    const best = valid[0];
    const doc = {
      name: meta.name, uid: meta.uid, timeMs: best.timeMs,
      carName: meta.carName || meta.carId, classType: meta.classType || 'unknown',
      trackId: meta.trackId, carId: meta.carId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if(best.replay) doc.replay = best.replay;
    await parentRef.set(doc);
  }
  // Prune
  const keep = new Set(valid.slice(0, LAPS_MAX_VALID).map(l => l._id));
  laps.filter(l => l.struck).slice(0, LAPS_MAX_STRUCK).forEach(l => keep.add(l._id));
  await Promise.all(laps.filter(l => !keep.has(l._id)).map(l => lapsRef.doc(l._id).delete().catch(()=>{})));

  return valid.length ? valid[0] : null;
}

/* ── Save best lap to Firestore (mit Runden-Historie) ── */
window.FB_saveBestLap = async function(trackId, carId, timeMs, carName, classType, replayFrames){
  if(!fbUser){ console.log('[FB] saveBestLap skip: nicht eingeloggt'); return; }
  if(!timeMs || timeMs <= 0){ console.log('[FB] saveBestLap skip: ungültige Zeit', timeMs); return; }

  const docId = `${fbUser.uid}_${trackId}_${carId}`;
  const name  = fbUsername || fbUser.displayName || fbUser.email?.split('@')[0] || 'Fahrer';
  const meta  = { name, uid: fbUser.uid, carName: carName || carId, classType: classType || 'unknown', trackId, carId };
  const replayData = _encodeReplay(replayFrames);

  const parentRef = db.collection('times').doc(docId);
  const lapsRef   = parentRef.collection('laps');

  try {
    const [parentSnap, lapsSnap] = await Promise.all([parentRef.get(), lapsRef.limit(1).get()]);
    const oldTimeMs = parentSnap.exists ? (parentSnap.data().timeMs || null) : null;

    // Migration: alte Bestzeit ohne Historie -> als erste Runde sichern
    if(parentSnap.exists && lapsSnap.empty){
      const p = parentSnap.data();
      if(p && p.timeMs){
        const seed = { timeMs: p.timeMs, at: p.updatedAt || firebase.firestore.FieldValue.serverTimestamp(), struck: false };
        if(p.replay) seed.replay = p.replay;
        await lapsRef.add(seed);
      }
    }

    // Neue Runde ablegen
    const lap = { timeMs, at: firebase.firestore.FieldValue.serverTimestamp(), struck: false };
    if(replayData) lap.replay = replayData;
    await lapsRef.add(lap);

    // Parent neu berechnen (schnellste gültige = i.d.R. die neue) + prunen
    await _recomputeParentTime(docId, meta);

    // Weltrang-Reveal: großes Banner mit Position in der Klassen-Weltrangliste.
    // Nur im Zeitfahren (nicht im Rennen/Replay) — sonst nur ein kurzer Flash.
    const inTT = typeof Game !== 'undefined' && Game.mode === 'tt' && !Game._replayMode;
    if(inTT){
      _showWorldRankReveal({ trackId, classType: classType || 'unknown', timeMs, oldTimeMs, name })
        .catch(e => console.warn('[FB] Weltrang-Reveal:', e.message));
    } else {
      try {
        const wrSnap = await db.collection('times')
          .where('trackId','==',trackId).where('classType','==',classType||'unknown')
          .orderBy('timeMs').limit(1).get();
        const currentWR = wrSnap.empty ? null : wrSnap.docs[0].data();
        const isWR = !currentWR || timeMs <= currentWR.timeMs;
        if(isWR && typeof Game !== 'undefined' && Game._showFlash) Game._showFlash('🏆 WORLD RECORD!', '#7c3aed', 4000);
        const el = document.getElementById('fl-driver');
        if(el){ const prev = el.textContent; el.textContent = isWR ? '🏆 World Record!' : '☁ Zeit gespeichert'; setTimeout(()=>{ el.textContent = prev; }, 3000); }
      } catch(e){ console.warn('[FB] WR-Check:', e.message); }
    }
  } catch(e){
    console.error('[FB] saveBestLap Fehler:', e);
  }
};

/* ── Weltrang-Reveal: nach neuer persönlicher Bestzeit die eigene Position in
   der Klassen-Weltrangliste dieser Strecke groß einblenden. ── */
async function _showWorldRankReveal({ trackId, classType, timeMs, oldTimeMs, name }){
  const box = document.getElementById('wr-reveal');
  if(!box || !fbUser) return;

  const entries = await _lbFetch(trackId);   // alle times-Docs dieser Strecke (öffentlich lesbar)
  const cls = (classType || 'unknown').toLowerCase();

  const best = new Map();
  entries.forEach(e => {
    if((e.classType || 'unknown').toLowerCase() !== cls) return;
    if(!e.uid || !e.timeMs) return;
    if(!best.has(e.uid) || e.timeMs < best.get(e.uid).timeMs) best.set(e.uid, e);
  });
  // Die soeben gespeicherte Zeit sicher einbeziehen (Query könnte minimal nachhinken)
  const mine = best.get(fbUser.uid);
  if(!mine || timeMs < mine.timeMs) best.set(fbUser.uid, { uid: fbUser.uid, timeMs, classType: cls, name });

  const board = [...best.values()].sort((a, b) => a.timeMs - b.timeMs);
  const total = board.length;
  const myRank = board.findIndex(e => e.uid === fbUser.uid) + 1;
  if(myRank < 1) return;

  const isWR    = myRank === 1;
  const wr      = board[0];
  const ahead   = myRank > 1 ? board[myRank - 2] : null;
  const gapWR   = isWR ? 0 : (timeMs - wr.timeMs) / 1000;
  const gapAh   = ahead ? (timeMs - ahead.timeMs) / 1000 : null;

  let oldRank = null;
  if(oldTimeMs && oldTimeMs > 0)
    oldRank = 1 + board.filter(e => e.uid !== fbUser.uid && e.timeMs < oldTimeMs).length;
  const gained = oldRank != null ? (oldRank - myRank) : null;

  const clsLabel = cls === 'hypercar' ? 'HYPERCAR' : cls.toUpperCase();
  box.classList.remove('wr', 'p2', 'p3');
  if(isWR) box.classList.add('wr');
  else if(myRank === 2) box.classList.add('p2');
  else if(myRank === 3) box.classList.add('p3');

  const set = (id, txt) => { const el = document.getElementById(id); if(el) el.textContent = txt; };
  set('wrr-eyebrow', `${isWR ? '🏆 WORLD RECORD' : 'WELTRANG'} · ${_trackNm(trackId)} · ${clsLabel}`);
  set('wrr-rank', 'P' + myRank);
  set('wrr-of', total > 1 ? `von ${total} Fahrern in der Klasse` : 'erste Zeit in dieser Klasse');
  set('wrr-time', fmtLap(timeMs));

  const dbox = document.getElementById('wrr-deltas');
  if(dbox){
    dbox.innerHTML = '';
    if(ahead && gapAh != null){
      const d = document.createElement('span');
      d.className = 'wrr-d up';
      d.textContent = `▲ P${myRank - 1}  −${gapAh.toFixed(3)}s`;
      dbox.appendChild(d);
    }
    if(!isWR){
      const d = document.createElement('span');
      d.className = 'wrr-d';
      d.textContent = `Bestzeit  +${gapWR.toFixed(3)}s`;
      dbox.appendChild(d);
    }
  }

  const mv = document.getElementById('wrr-move');
  if(mv){
    mv.classList.remove('neutral');
    if(oldRank == null){ mv.textContent = '★ ERSTE ZEIT AUF DIESER STRECKE'; }
    else if(gained > 0){ mv.textContent = `▲ ${gained} ${gained === 1 ? 'PLATZ' : 'PLÄTZE'} GUT GEMACHT · VORHER P${oldRank}`; }
    else { mv.textContent = 'PERSÖNLICHE BESTZEIT VERBESSERT'; mv.classList.add('neutral'); }
  }

  // Reveal zeigen + Progress-Bar-Animation neu starten
  box.classList.remove('show');
  void box.offsetWidth;
  box.classList.add('show');
  box.style.pointerEvents = 'auto';
  function onKey(){ close(); }
  function close(){
    box.classList.remove('show');
    box.style.pointerEvents = 'none';
    box.removeEventListener('click', close);
    document.removeEventListener('keydown', onKey, true);
    clearTimeout(_showWorldRankReveal._t);
  }
  box.addEventListener('click', close);
  // Beim ersten Tastendruck (z.B. Gas geben) sofort wegblenden — verdeckt nix beim Fahren
  setTimeout(() => document.addEventListener('keydown', onKey, true), 600);
  clearTimeout(_showWorldRankReveal._t);
  _showWorldRankReveal._t = setTimeout(close, 8000);
}

/* ── Auth Modal ── */
let fbAuthMode = 'login'; // 'login' | 'register'

/* Firebase liefert seine Fehlertexte auf Englisch und teils sehr technisch
   ("Firebase: Error (auth/unauthorized-domain)."). Fuer die Anmeldemaske
   uebersetzen wir sie in verstaendliches Deutsch und sagen, was zu tun ist. */
const AUTH_FEHLER = {
  'auth/invalid-email':            'Diese E-Mail-Adresse sieht nicht gültig aus.',
  'auth/missing-email':            'Bitte gib eine E-Mail-Adresse ein.',
  'auth/missing-password':         'Bitte gib ein Passwort ein.',
  'auth/user-disabled':            'Dieses Konto wurde gesperrt.',
  'auth/user-not-found':           'Zu dieser E-Mail gibt es kein Konto. Registriere dich zuerst.',
  'auth/wrong-password':           'Passwort falsch.',
  'auth/invalid-credential':       'E-Mail oder Passwort stimmt nicht.',
  'auth/invalid-login-credentials':'E-Mail oder Passwort stimmt nicht.',
  'auth/email-already-in-use':     'Für diese E-Mail gibt es schon ein Konto. Melde dich stattdessen an.',
  'auth/weak-password':            'Das Passwort ist zu kurz – mindestens 6 Zeichen.',
  'auth/too-many-requests':        'Zu viele Versuche. Warte einen Moment und probiere es erneut.',
  'auth/network-request-failed':   'Keine Verbindung zu Firebase. Prüfe deine Internetverbindung oder deinen Adblocker.',
  'auth/popup-blocked':            'Dein Browser hat das Google-Fenster blockiert. Erlaube Pop-ups für grid-line.de.',
  'auth/popup-closed-by-user':     'Das Google-Fenster wurde geschlossen.',
  'auth/cancelled-popup-request':  'Anmeldung abgebrochen.',
  'auth/account-exists-with-different-credential':
    'Diese E-Mail ist bereits mit einer anderen Anmeldeart verknüpft. Melde dich so an, wie beim ersten Mal.',
  'auth/operation-not-allowed':
    'Diese Anmeldeart ist im Firebase-Projekt nicht aktiviert (Authentication → Sign-in method).',
  'auth/unauthorized-domain':
    'Diese Domain ist bei Firebase nicht freigegeben. In der Firebase Console unter Authentication → Settings → Authorized domains muss grid-line.de (und www.grid-line.de) eingetragen sein.',
  'auth/api-key-not-valid':        'Der Firebase-API-Schlüssel wird abgelehnt. Bitte die Konfiguration prüfen.',
  'auth/internal-error':           'Firebase meldet einen internen Fehler. Bitte später erneut versuchen.'
};

function authFehler(e){
  if(!e) return 'Unbekannter Fehler.';
  const code = e.code || '';
  if(AUTH_FEHLER[code]) return AUTH_FEHLER[code];
  // Code trotzdem mitgeben, sonst ist der Fehler nicht diagnostizierbar
  console.error('[FB] Auth-Fehler:', code, e.message);
  return (e.message || 'Anmeldung fehlgeschlagen.') + (code ? ' (' + code + ')' : '');
}

function zeigeAuthFehler(e){
  const el = document.getElementById('fb-error-msg');
  if(el) el.textContent = authFehler(e);
}

function openAuthModal(){
  document.getElementById('fb-auth-modal').classList.remove('hidden');
  document.getElementById('fb-error-msg').textContent='';
}
function closeAuthModal(){
  document.getElementById('fb-auth-modal').classList.add('hidden');
}

document.getElementById('btn-fb-login-chip').onclick = openAuthModal;
document.getElementById('btn-fb-logout').onclick = () => auth.signOut();
const _logoutTopBtn = document.getElementById('btn-fb-logout-top');
if(_logoutTopBtn) _logoutTopBtn.onclick = () => auth.signOut();
document.getElementById('btn-fb-close').onclick = closeAuthModal;

/* ── Username Modal ── */
const _unameRe = /^[a-zA-Z0-9_]{3,20}$/;

document.getElementById('fb-username-input').addEventListener('input', e => {
  const val = e.target.value.trim();
  const btn = document.getElementById('btn-fb-username-save');
  const err = document.getElementById('fb-username-err');
  if(!val){ btn.disabled=true; err.textContent=''; return; }
  if(!_unameRe.test(val)){
    btn.disabled=true;
    err.textContent = val.length < 3 ? 'Mindestens 3 Zeichen' : 'Nur Buchstaben, Zahlen und _ erlaubt';
  } else {
    btn.disabled=false;
    err.textContent='';
  }
});

document.getElementById('btn-fb-username-save').onclick = async () => {
  const val = document.getElementById('fb-username-input').value.trim();
  const err = document.getElementById('fb-username-err');
  const btn = document.getElementById('btn-fb-username-save');
  if(!fbUser || !_unameRe.test(val)) return;
  btn.disabled=true; btn.textContent='…';

  // Check uniqueness
  try {
    const taken = await db.collection('usernames').doc(val.toLowerCase()).get();
    if(taken.exists && taken.data().uid !== fbUser.uid){
      err.textContent = 'Dieser Name ist bereits vergeben';
      btn.disabled=false; btn.textContent='SPEICHERN';
      return;
    }
    // Reserve username + save to user profile
    const batch = db.batch();
    batch.set(db.collection('usernames').doc(val.toLowerCase()), {uid: fbUser.uid});
    batch.set(db.collection('users').doc(fbUser.uid), {
      username: val,
      displayName: val,
      email: fbUser.email||'',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    await batch.commit();
    // Update Firebase Auth display name
    await fbUser.updateProfile({displayName: val}).catch(()=>{});
    fbUsername = val;
    _applyUser(val);
    document.getElementById('fb-username-modal').classList.add('hidden');
  } catch(e){
    err.textContent = 'Fehler: ' + e.message;
    btn.disabled=false; btn.textContent='SPEICHERN';
  }
};

/* Safari - und damit jeder Browser auf iPhone und iPad - blockiert die
   Cross-Origin-Speicherung, auf die signInWithPopup angewiesen ist. Das Pop-up
   geht dann auf, kommt aber nie zurueck; beim zweiten Tippen meldet Firebase
   auth/cancelled-popup-request, weil die erste Anfrage noch offen haengt.
   Auf diesen Geraeten deshalb gleich per Seitenweiterleitung anmelden - das
   funktioniert dort zuverlaessig und ist auch Googles Empfehlung. */
const BRAUCHT_REDIRECT = (() => {
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS meldet sich seit Version 13 als Mac, hat aber einen Touchscreen.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const safari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
  return iOS || safari;
})();

let googleLaeuft = false;

document.getElementById('btn-fb-google').onclick = () => {
  // Zweites Tippen ignorieren, solange die erste Anfrage noch laeuft -
  // sonst bricht Firebase beide ab (auth/cancelled-popup-request).
  if(googleLaeuft) return;
  googleLaeuft = true;

  const provider = new firebase.auth.GoogleAuthProvider();
  const fertig = () => { googleLaeuft = false; };
  const perWeiterleitung = () => auth.signInWithRedirect(provider)
    .catch(e => { fertig(); zeigeAuthFehler(e); });

  if(BRAUCHT_REDIRECT){ perWeiterleitung(); return; }

  auth.signInWithPopup(provider).then(() => { fertig(); closeAuthModal(); }).catch(e => {
    const code = e && e.code;
    // Pop-up wurde blockiert oder haengt: auf die Weiterleitung ausweichen.
    if(code === 'auth/popup-blocked' ||
       code === 'auth/cancelled-popup-request' ||
       code === 'auth/operation-not-supported-in-this-environment'){
      perWeiterleitung();
      return;
    }
    fertig();
    // Selbst geschlossenes Fenster ist kein Fehler, den man anmeckern muss.
    if(code === 'auth/popup-closed-by-user'){
      document.getElementById('fb-error-msg').textContent = '';
      return;
    }
    zeigeAuthFehler(e);
  });
};

document.getElementById('btn-fb-toggle').onclick = () => {
  fbAuthMode = fbAuthMode === 'login' ? 'register' : 'login';
  document.getElementById('fb-auth-title').textContent = fbAuthMode === 'login' ? 'ANMELDEN' : 'REGISTRIEREN';
  document.getElementById('btn-fb-email').textContent  = fbAuthMode === 'login' ? 'ANMELDEN' : 'KONTO ERSTELLEN';
  document.getElementById('btn-fb-toggle').textContent = fbAuthMode === 'login'
    ? 'Noch kein Konto? Registrieren'
    : 'Bereits registriert? Anmelden';
  document.getElementById('fb-error-msg').textContent='';
};

document.getElementById('btn-fb-email').onclick = () => {
  const email = document.getElementById('fb-email-input').value.trim();
  const pw    = document.getElementById('fb-pw-input').value;
  const errEl = document.getElementById('fb-error-msg');
  const btn   = document.getElementById('btn-fb-email');
  errEl.textContent = '';
  if(!email){ errEl.textContent = 'Bitte gib eine E-Mail-Adresse ein.'; return; }
  if(!pw){    errEl.textContent = 'Bitte gib ein Passwort ein.'; return; }
  if(fbAuthMode === 'register' && pw.length < 6){
    errEl.textContent = 'Das Passwort muss mindestens 6 Zeichen haben.'; return;
  }
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  const fertig = () => { btn.disabled = false; btn.textContent = label; };
  const p = fbAuthMode === 'login'
    ? auth.signInWithEmailAndPassword(email, pw)
    : auth.createUserWithEmailAndPassword(email, pw);
  p.then(() => { fertig(); closeAuthModal(); })
   .catch(e => { fertig(); zeigeAuthFehler(e); });
};

/* ── Leaderboard Screen ── */
let lbUnsub = null;

let lbClassFilter = 'all'; // 'all' | 'gt3' | 'lmp2' | 'hypercar'
let lbAllEntries  = [];   // raw Firestore entries for current track

function openLeaderboard(){
  if(typeof Game !== 'undefined') Game.showScreen('screen-leaderboard');
  switchLbMode('times');
  _populateLbTrackSel();
}

function _populateLbTrackSel(){
  const sel = document.getElementById('lb-track-sel');
  if(!sel || typeof TRACKS === 'undefined') return;
  const prev = sel.value;
  sel.innerHTML = '';
  TRACKS.forEach(t => {
    const o = document.createElement('option');
    o.value = t.id; o.textContent = t.name;
    sel.appendChild(o);
  });
  if(prev && [...sel.options].some(o=>o.value===prev)) sel.value = prev;
  _loadLbForTrack(sel.value);
}

const _FS_BASE = 'https://firestore.googleapis.com/v1/projects/gridline-bf8c9/databases/(default)/documents';

function _fsVal(v) {
  if(!v) return undefined;
  if(v.stringValue   !== undefined) return v.stringValue;
  if(v.doubleValue   !== undefined) return parseFloat(v.doubleValue);
  if(v.integerValue  !== undefined) return parseFloat(v.integerValue);
  if(v.timestampValue!== undefined) return new Date(v.timestampValue);
  if(v.booleanValue  !== undefined) return v.booleanValue;
  if(v.mapValue      !== undefined) return _fsDoc(v.mapValue.fields);
  if(v.arrayValue    !== undefined) return (v.arrayValue.values||[]).map(_fsVal);
  return undefined;
}

function _fsDoc(fields) {
  const out = {};
  if(!fields) return out;
  Object.entries(fields).forEach(([k,v]) => { out[k] = _fsVal(v); });
  return out;
}

async function _lbFetch(trackId) {
  const url = `${_FS_BASE}:runQuery`;
  const body = {
    structuredQuery: {
      from: [{collectionId:'times'}],
      where: {
        fieldFilter: {
          field: {fieldPath:'trackId'},
          op: 'EQUAL',
          value: {stringValue: trackId}
        }
      },
      limit: 500
    }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = await res.json();
  return rows
    .filter(r => r.document)
    .map(r => _fsDoc(r.document.fields));
}

function _loadLbForTrack(trackId){
  if(lbUnsub){ lbUnsub(); lbUnsub=null; }
  const list = document.getElementById('lb-list');
  list.innerHTML = '<div id="lb-loading">Laden…</div>';
  lbAllEntries = [];

  if(!trackId){ list.innerHTML='<div id="lb-empty-msg">Keine Strecke gewählt</div>'; return; }

  _lbFetch(trackId)
    .then(entries => {
      lbAllEntries = entries;
      console.log(`[LB] ${entries.length} Einträge für ${trackId}`);
      _renderLb();
    })
    .catch(err => {
      console.error('[LB] Fehler:', err);
      list.innerHTML = `<div id="lb-empty-msg">⚠ Fehler: ${err.message}</div>`;
    });
}

function _renderLb(){
  const list = document.getElementById('lb-list');
  list.innerHTML = '';

  // Filter by class
  let entries = lbAllEntries;
  if(lbClassFilter !== 'all'){
    entries = entries.filter(e => (e.classType||'').toLowerCase() === lbClassFilter);
  }

  if(lbClassFilter === 'all'){
    // Multi-class: best time per uid (across all cars) but keep classType for badge
    const best = new Map();
    entries.forEach(e => {
      if(!best.has(e.uid) || e.timeMs < best.get(e.uid).timeMs) best.set(e.uid, e);
    });
    entries = [...best.values()].sort((a,b)=>{
      const dt = a.timeMs - b.timeMs;
      if(dt !== 0) return dt;
      const ta = a.updatedAt instanceof Date ? a.updatedAt.getTime() : (a.updatedAt || 0);
      const tb = b.updatedAt instanceof Date ? b.updatedAt.getTime() : (b.updatedAt || 0);
      return ta - tb;
    });
  } else {
    // Single class: best time per uid within that class
    const best = new Map();
    entries.forEach(e => {
      if(!best.has(e.uid) || e.timeMs < best.get(e.uid).timeMs) best.set(e.uid, e);
    });
    entries = [...best.values()].sort((a,b)=>{
      const dt = a.timeMs - b.timeMs;
      if(dt !== 0) return dt;
      const ta = a.updatedAt instanceof Date ? a.updatedAt.getTime() : (a.updatedAt || 0);
      const tb = b.updatedAt instanceof Date ? b.updatedAt.getTime() : (b.updatedAt || 0);
      return ta - tb;
    });
  }

  const podium  = document.getElementById('lb-podium');
  const youStrip = document.getElementById('lb-you-strip');
  if(podium)  { podium.classList.remove('show'); podium.innerHTML = ''; }
  if(youStrip){ youStrip.classList.remove('show'); youStrip.innerHTML = ''; }

  if(entries.length === 0){
    const cls = lbClassFilter === 'all' ? '' : ` in der Klasse ${lbClassFilter.toUpperCase()}`;
    list.innerHTML = `<div id="lb-empty-msg">🏁 Noch keine Rundenzeit${cls} gesetzt.<br><span style="font-size:10px;color:#444;margin-top:6px;display:block">Fahre ein Zeitfahren um in der Bestenliste zu erscheinen.</span></div>`;
    return;
  }

  const leaderMs = entries[0].timeMs;
  const meIdx = fbUser ? entries.findIndex(e => e.uid === fbUser.uid) : -1;

  // ── Podium (Top 3), visuell P2 · P1 · P3 ──
  if(podium && entries.length >= 3){
    [1, 0, 2].forEach(idx => {
      const e = entries[idx];
      const pos = idx + 1;
      const isMe = fbUser && e.uid === fbUser.uid;
      const hasRep = !!(e.replay && e.replay.flat && e.replay.flat.length > 5);
      const card = document.createElement('div');
      card.className = `lb-pod p${pos}` + (isMe ? ' lb-me' : '');
      card.innerHTML =
        `<div class="lb-pod-pos">${pos === 1 ? '🏆 P1' : 'P' + pos}</div>`+
        `<div class="lb-pod-name">${_esc(e.name || 'Fahrer')}</div>`+
        `<div class="lb-pod-time">${fmtLap(e.timeMs)}</div>`+
        `<div class="lb-pod-car">${_esc(e.carName || '—')}</div>`+
        (hasRep ? `<button class="lb-pod-replay">▶ REPLAY</button>` : '');
      if(hasRep) card.querySelector('.lb-pod-replay').onclick = () => _watchLbReplay(e);
      podium.appendChild(card);
    });
    podium.classList.add('show');
  }

  // ── "Deine Position"-Strip ──
  if(youStrip){
    if(meIdx >= 0){
      const gap = (entries[meIdx].timeMs - leaderMs) / 1000;
      youStrip.innerHTML =
        `<span class="lys-rank">P${meIdx + 1}</span>`+
        `<span class="lys-sep">│</span><span>von ${entries.length} Fahrern</span>`+
        `<span class="lys-sep">│</span>`+
        (meIdx === 0
          ? `<span>🏆 Weltbestzeit</span>`
          : `<span class="lys-dim">+${gap.toFixed(3)}s auf die Bestzeit</span>`)+
        `<button id="lb-scroll-me">ZU MEINER ZEIT ▾</button>`;
      youStrip.classList.add('show');
      const jb = document.getElementById('lb-scroll-me');
      if(jb) jb.onclick = () => {
        const row = list.children[meIdx];
        if(row){ row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.classList.add('lb-flash'); setTimeout(() => row.classList.remove('lb-flash'), 2400); }
      };
    } else if(fbUser){
      youStrip.innerHTML = `<span class="lys-dim">Noch keine Zeit auf dieser Strecke — fahr ein Zeitfahren.</span>`;
      youStrip.classList.add('show');
    }
  }

  entries.forEach((entry, i) => {
    const rank = i + 1;
    const isMe = fbUser && entry.uid === fbUser.uid;
    const cls  = (entry.classType||'unknown').toLowerCase();
    const clsLabel = cls === 'hypercar' ? 'HYP' : cls.toUpperCase();
    const date = entry.updatedAt?.toDate
      ? _fmtDate(entry.updatedAt.toDate())
      : (entry.updatedAt ? _fmtDate(new Date(entry.updatedAt)) : '—');

    const rankClass = rank===1?'p1':rank===2?'p2':rank===3?'p3':'';
    const timeClass = rank===1?'lb-wr':'';
    const isWR = rank === 1;
    const gapMs = entry.timeMs - leaderMs;
    const gapStr = isWR ? 'Bestzeit' : '+' + (gapMs / 1000).toFixed(3);
    const upd = entry.updatedAt instanceof Date ? entry.updatedAt : (entry.updatedAt ? new Date(entry.updatedAt) : null);
    const isFresh = upd && (Date.now() - upd.getTime() < 864e5);

    const div = document.createElement('div');
    div.className = 'lb-entry' + (isMe?' lb-me':'');
    div.style.animationDelay = Math.min(i, 20) * 22 + 'ms';
    const hasReplay = !!(entry.replay && entry.replay.flat && entry.replay.flat.length > 5);
    div.innerHTML =
      `<span class="lb-rank ${rankClass}">${rank}</span>`+
      `<span class="lb-entry-name">`+
        `<span class="lb-cls-badge ${cls}">${clsLabel}</span>`+
        `<span class="lb-driver">${_esc(entry.name||'Fahrer')}</span>`+
        (isWR ? `<span class="lb-wr-badge">🏆 World Record</span>` : '')+
        (isFresh && !isWR ? `<span class="lb-new-badge">NEU</span>` : '')+
      `</span>`+
      `<span class="lb-time-cell ${timeClass}">${fmtLap(entry.timeMs)}<span class="lb-gap">${gapStr}</span></span>`+
      `<span class="lb-car-cell">${_esc(entry.carName||'—')}</span>`+
      `<span class="lb-date-cell">${date}</span>`+
      `<span class="lb-replay-cell">${hasReplay?'<button class="lb-replay-btn" title="Runde anschauen">▶</button>':''}</span>`+
      `<span class="lb-ghost-cell">${hasReplay?'<button class="lb-ghost-btn" title="Als Ghost setzen">👻</button>':''}</span>`;
    if(hasReplay){
      div.querySelector('.lb-replay-btn').onclick = () => _watchLbReplay(entry);
      div.querySelector('.lb-ghost-btn').onclick = () => _setOpponentGhost(entry);
    }
    list.appendChild(div);
  });
}

function _watchLbReplay(entry){
  if(!entry.replay || !entry.replay.flat) return;
  if(typeof Game === 'undefined') return;
  const { base, color, flat, v } = entry.replay;
  const stride = (v >= 2) ? 9 : 6;
  const frames = [];
  for(let i = 0; i < flat.length; i += stride){
    frames.push({ t: base + flat[i], cars: [{ x:flat[i+1], z:flat[i+2], y:flat[i+3]||0, h:flat[i+4], vx:flat[i+5]||0, color,
      thr: stride>=9 ? flat[i+6] : undefined,
      brk: stride>=9 ? flat[i+7] : undefined,
      str: stride>=9 ? flat[i+8] : undefined,
    }] });
  }
  if(frames.length < 5) return;

  const blr = new ReplayRecorder();
  blr.frames = frames;
  blr.lapTimes = [];

  function _launchReplay(){
    if(!Game.allCars || !Game.allCars.length) return;
    Game._lbReplayHiddenCars = [];
    Game.allCars.forEach((c, i) => {
      if(i > 0 && c.group && c.group.visible){
        c.group.visible = false;
        Game._lbReplayHiddenCars.push(c);
      }
    });
    if(Game.allCars[0]?.group) Game.allCars[0].group.visible = true;
    Game._savedReplay = Game.replay;
    Game.replay = blr;
    Game._replayIsBestLap = true;
    Game._replayFromLb = true;
    Game.startReplay(false);
  }

  document.getElementById('screen-leaderboard')?.classList.add('hidden');
  document.getElementById('menus')?.classList.add('hidden');

  if(Game.allCars && Game.allCars.length){
    _launchReplay();
  } else {
    const trackIdx = (typeof TRACKS !== 'undefined') ? TRACKS.findIndex(t => t.id === entry.trackId) : -1;
    const carIdx   = (typeof CARS   !== 'undefined') ? CARS.findIndex(c => c.id === entry.carId)     : -1;
    if(trackIdx >= 0) Game.selTrack = trackIdx;
    if(carIdx   >= 0) Game.selCar   = carIdx;
    Game.mode = 'tt';
    Game._showFlash('REPLAY WIRD GELADEN…', '#58d7ff', 3000);
    Game.startRace().then(() => {
      Game.state = 'race';
      const box = document.getElementById('lights');
      if(box) box.classList.add('hidden');
      _launchReplay();
    }).catch(() => {});
  }
}

function _setOpponentGhost(entry){
  if(!entry.replay || !entry.replay.flat) return;
  if(typeof Game === 'undefined') return;
  const { base, color, flat, v } = entry.replay;
  const stride = (v >= 2) ? 9 : 6;
  const rawFrames = [];
  for(let i = 0; i < flat.length; i += stride){
    rawFrames.push({ t: base + flat[i], x: flat[i+1], z: flat[i+2], y: flat[i+3]||0, h: flat[i+4] });
  }
  if(rawFrames.length < 5) return;
  const t0 = rawFrames[0].t;
  const lapTime = rawFrames[rawFrames.length-1].t - t0;
  // Convert to {progress, time} format by mapping rel-time to track progress
  // Approximate: use uniform distribution along frames as progress proxy
  const samples = rawFrames.map((f, i) => ({
    progress: i / (rawFrames.length - 1),
    time: f.t - t0,
    x: f.x, z: f.z, y: f.y, h: f.h
  }));
  Game.ghostLapRef = samples;
  Game._ghostLapTime = lapTime;
  Game._ghostDriverName = entry.name || 'Ghost';
  // Re-init ghost car with new data
  if(Game.mode === 'tt' && Game.settings?.ghostReplay) Game.initGhostReplay();
  const timeStr = fmtLap(entry.timeMs);
  if(typeof Game._showFlash === 'function')
    Game._showFlash(`GHOST: ${(entry.name||'?').substring(0,10)} ${timeStr}`, '#a855f7', 2500);
}

function _fmtDate(d){
  if(!(d instanceof Date) || isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}
function _esc(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

/* ══════════════════════════════════════════════════════
   WELTRANGLISTE
   ══════════════════════════════════════════════════════ */
let _lbMode = 'times'; // 'times' | 'world'

const _LIC_ORDER = ['bronze','silver','gold','platinum'];
const _LIC_ICON  = {bronze:'🟤', silver:'⚪', gold:'🟡', platinum:'🔵'};
function _licImg(id, size=22){
  const file = id==='platinum'?'platin':id;
  return `<img src="assets/img/${file}.png" style="width:${size}px;height:${size}px;object-fit:contain;vertical-align:middle;filter:drop-shadow(0 1px 3px rgba(0,0,0,.6))">`;
}

function switchLbMode(mode){
  _lbMode = mode;
  const isTimes = mode === 'times';

  document.getElementById('lb-tab-times').classList.toggle('active', isTimes);
  document.getElementById('lb-tab-world').classList.toggle('active', !isTimes);
  document.getElementById('lb-filters').style.display    = isTimes ? '' : 'none';
  document.getElementById('lb-table-head').style.display = isTimes ? '' : 'none';
  document.getElementById('lb-list').style.display       = isTimes ? '' : 'none';
  document.getElementById('lb-world-head').style.display = isTimes ? 'none' : 'grid';
  document.getElementById('lb-world-list').style.display = isTimes ? 'none' : 'flex';

  // Podium + "Deine Position"-Strip gehören zum Rundenzeiten-Modus
  ['lb-podium', 'lb-you-strip'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.display = isTimes ? '' : 'none';
  });

  if(isTimes){ if(lbAllEntries.length) _renderLb(); }
  else _loadWorldRanking();
}

window.switchLbMode = switchLbMode;

async function _fetchCollection(collId, pageSize=200){
  const url = `${_FS_BASE}/${collId}?pageSize=${pageSize}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.documents || []).map(doc => {
    const name = doc.name.split('/').pop();
    return {_id: name, ..._fsDoc(doc.fields)};
  });
}

async function _loadWorldRanking(){
  const list = document.getElementById('lb-world-list');
  list.innerHTML = '<div id="lb-loading" style="padding:20px;color:#555;font:12px var(--mono)">Lade Weltrangliste…</div>';

  try {
    // Fetch users + usernames in parallel
    const [users, usernames] = await Promise.all([
      _fetchCollection('users', 300),
      _fetchCollection('usernames', 300),
    ]);

    // Build uid → username map
    const uidToName = {};
    usernames.forEach(u => { if(u.uid) uidToName[u.uid] = u._id; });

    // Build ranking entries
    const entries = users
      .filter(u => uidToName[u._id])  // must have a username
      .map(u => ({
        uid:     u._id,
        name:    uidToName[u._id] || '—',
        license: u.license || 'bronze',
        lp:      parseFloat(u.licensePoints) || 0,
        km:      parseFloat(u.kmDriven)      || 0,
        races:   parseInt(u.racesCompleted)  || 0,
      }));

    // Sort: higher tier first, then higher LP, then more km
    entries.sort((a, b) => {
      const ta = _LIC_ORDER.indexOf(a.license), tb = _LIC_ORDER.indexOf(b.license);
      if(ta !== tb) return tb - ta;
      if(b.lp !== a.lp) return b.lp - a.lp;
      return b.km - a.km;
    });

    list.innerHTML = '';
    if(entries.length === 0){
      list.innerHTML = '<div style="padding:20px;color:#555;font:12px var(--mono)">Keine Fahrer gefunden.</div>';
      return;
    }

    // "Dein Rang"-Kopfzeile
    const myIdx = (typeof fbUser !== 'undefined' && fbUser) ? entries.findIndex(e => e.uid === fbUser.uid) : -1;
    if(myIdx >= 0){
      const me = entries[myIdx];
      const head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;gap:9px;padding:10px 16px;background:#120a0c;border-bottom:1px solid #2a1417;font:700 10px var(--mono);letter-spacing:.05em;color:#ff8a94;position:sticky;top:0;z-index:2';
      head.innerHTML =
        `<span style="font:900 15px var(--mono);color:#ff2e3d">P${myIdx + 1}</span>`+
        `<span style="color:#3a2a2e">│</span><span>von ${entries.length} Fahrern weltweit</span>`+
        `<span style="color:#3a2a2e">│</span>`+
        `<span style="color:#9a7a80;font-weight:600">${me.lp.toFixed(1)} LP · ${Math.round(me.km).toLocaleString()} km</span>`;
      list.appendChild(head);
    }

    entries.forEach((e, i) => {
      const rank     = i + 1;
      const isMe     = typeof fbUser !== 'undefined' && fbUser && e.uid === fbUser.uid;
      const rankCls  = rank===1?'p1':rank===2?'p2':rank===3?'p3':'';
      const icon     = _licImg(e.license || 'bronze', 20);

      const div = document.createElement('div');
      div.className = 'lb-wr-entry' + (isMe ? ' lb-me' : '');
      div.innerHTML =
        `<span class="lb-rank ${rankCls}">${rank}</span>`+
        `<span class="lb-lic-badge" title="${e.license}">${icon}</span>`+
        `<span class="lb-wr-name">${_esc(e.name)}</span>`+
        `<span class="lb-wr-lp">${e.lp.toFixed(1)}</span>`+
        `<span class="lb-wr-km">${Math.round(e.km).toLocaleString()} km</span>`+
        `<span class="lb-wr-races">${e.races}</span>`;
      list.appendChild(div);
    });
  } catch(err){
    console.error('[WR] Fehler:', err);
    list.innerHTML = `<div style="padding:20px;color:#ff2e3d;font:12px var(--mono)">⚠ Fehler: ${err.message}</div>`;
  }
}

// Class filter tabs
document.querySelectorAll('.lb-cls-tab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.lb-cls-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    lbClassFilter = btn.dataset.cls;
    _renderLb();
  };
});

document.getElementById('lb-track-sel').onchange = e => _loadLbForTrack(e.target.value);
document.getElementById('btn-lb-back').onclick = () => {
  if(lbUnsub){ lbUnsub(); lbUnsub=null; }
  if(typeof Game !== 'undefined') Game.showScreen('screen-start');
};
// btn-leaderboard onclick is managed by _setAuthGatedButtons

/* ══════════════════════════════════════════════════════
   LICENSE SYSTEM
   ══════════════════════════════════════════════════════ */
const LICENSE_TIERS = [
  {
    id: 'bronze', label: 'Bronze', icon: '🟤', color: '#cd7f32',
    req: null // starting license
  },
  {
    id: 'silver', label: 'Silber', icon: '⚪', color: '#b0bec5',
    req: { km: 200, pts: 10, allTracks: false }
  },
  {
    id: 'gold', label: 'Gold', icon: '🟡', color: '#f5c518',
    req: { km: 750, pts: 50, allTracks: true }
  },
  {
    id: 'platinum', label: 'Platin', icon: '🔵', color: '#60b4ff',
    req: { km: 3000, pts: 150, allTracks: false, special: true }
  }
];

const LicenseSystem = {
  _data: null,  // local copy of Firestore data
  _unsub: null,
  _lastWall: 0,
  _lastCar: 0,

  /* ── Default stats ── */
  _default() {
    return {
      license: 'bronze',
      licensePoints: 0,
      kmDriven: 0,
      validLaps: 0,
      invalidLaps: 0,
      wins: 0, p2: 0, p3: 0,
      wallHits: 0, carHits: 0,
      tracksVisited: [],
      racesCompleted: 0,
    };
  },

  /* ── Load from Firestore ── */
  load() {
    if(!fbUser) return;
    db.collection('users').doc(fbUser.uid).get().then(snap => {
      const d = snap.exists ? (snap.data()||{}) : {};
      if(!snap.exists) db.collection('users').doc(fbUser.uid).set({license:'bronze',licensePoints:0,kmDriven:0,racesCompleted:0},{merge:true}).catch(()=>{});
      this._data = Object.assign(this._default(), {
        license:        d.license        || 'bronze',
        licensePoints:  d.licensePoints  || 0,
        kmDriven:       d.kmDriven       || 0,
        validLaps:      d.validLaps      || 0,
        invalidLaps:    d.invalidLaps    || 0,
        wins:           d.wins           || 0,
        p2:             d.p2             || 0,
        p3:             d.p3             || 0,
        wallHits:       d.wallHits       || 0,
        carHits:        d.carHits        || 0,
        tracksVisited:  d.tracksVisited  || [],
        racesCompleted: d.racesCompleted || 0,
      });
      this._updateBadge();
      const s = document.getElementById('screen-license');
      if(s && !s.classList.contains('hidden')) this.renderCard();
      // Popup anzeigen wenn schon beim Laden upgrade-bereit
      if(this._canUpgrade()) setTimeout(() => this._showUpgradePopup(), 2000);
    }).catch(err => console.warn('[License] load failed:', err.message));
  },

  /* ── Save delta to Firestore ── */
  _save(delta) {
    if(!fbUser || !this._data) return;
    const couldUpgradeBefore = this._canUpgrade();
    Object.keys(delta).forEach(k => {
      if(typeof delta[k] === 'number') this._data[k] = (this._data[k]||0) + delta[k];
      else this._data[k] = delta[k];
    });
    this._data.licensePoints = Math.max(0, this._data.licensePoints);
    this._updateBadge();
    // Popup anzeigen wenn Bedingungen neu erfüllt wurden
    if(!couldUpgradeBefore && this._canUpgrade()) this._showUpgradePopup();

    const update = {};
    Object.keys(delta).forEach(k => { update[k] = this._data[k]; });
    db.collection('users').doc(fbUser.uid).set(update, {merge:true}).catch(console.error);
  },

  _showUpgradePopup() {
    const idx = LICENSE_TIERS.findIndex(t => t.id === this._data.license);
    const next = LICENSE_TIERS[idx + 1];
    if(!next) return;
    const popup = document.getElementById('lic-upgrade-popup');
    const text  = document.getElementById('lic-popup-text');
    const btn   = document.getElementById('lic-popup-upgrade');
    if(!popup) return;
    if(text) text.textContent = `Bereit für ${next.icon} ${next.label.toUpperCase()} Lizenz!`;
    if(btn) btn.onclick = () => { this.upgrade(); popup.style.display = 'none'; };
    popup.style.display = 'block';
    // Auch beim nächsten Öffnen der Lizenz-Seite direkt zeigen
    setTimeout(() => { if(this._canUpgrade()) popup.style.display = 'block'; }, 100);
  },

  /* ── On lap complete (hooked from game) ── */
  onLap({valid, trackId, wallContacts, carContacts}) {
    if(!this._data) return;
    const wallNew = Math.max(0, wallContacts - this._lastWall);
    const carNew  = Math.max(0, carContacts  - this._lastCar);
    this._lastWall = wallContacts;
    this._lastCar  = carContacts;

    const delta = { licensePoints: 0 };
    if(valid) {
      delta.licensePoints += 0.04;
      delta.validLaps = 1;
      // Track visited
      const visited = [...(this._data.tracksVisited||[])];
      if(trackId && !visited.includes(trackId)){
        visited.push(trackId);
        delta.tracksVisited = visited;
      }
    } else {
      delta.licensePoints -= 0.02;
      delta.invalidLaps = 1;
    }
    delta.licensePoints -= wallNew * 0.05;
    delta.wallHits = wallNew;
    delta.carHits  = carNew;

    this._save(delta);
  },

  /* ── On race finish ── */
  onRaceFinish({pos, total, wallContacts, carContacts, kmDriven}) {
    if(!this._data) return;
    const wallNew = Math.max(0, wallContacts - this._lastWall);
    const carNew  = Math.max(0, carContacts  - this._lastCar);
    this._lastWall = 0; this._lastCar = 0; // reset for next race

    const pts = pos===1 ? 0.10 : pos===2 ? 0.06 : pos===3 ? 0.03 : 0;
    const delta = {
      licensePoints: pts - wallNew*0.05,
      racesCompleted: 1,
      wallHits: wallNew,
      carHits: carNew,
    };
    if(pos===1) delta.wins = 1;
    if(pos===2) delta.p2 = 1;
    if(pos===3) delta.p3 = 1;

    // Sync km
    const currentKm = parseFloat(Store.get('totalKm')) || kmDriven || 0;
    if(currentKm > (this._data.kmDriven||0)){
      delta.kmDriven = currentKm - (this._data.kmDriven||0);
    }

    this._save(delta);
  },

  /* ── Sync km (called from Store.set totalKm hook) ── */
  syncKm(totalKm) {
    if(!this._data) return;
    const diff = totalKm - (this._data.kmDriven||0);
    if(diff > 0.1) this._save({ kmDriven: diff });
  },

  /* ── Check if upgrade is possible ── */
  _canUpgrade() {
    if(!this._data) return false;
    const idx = LICENSE_TIERS.findIndex(t => t.id === this._data.license);
    if(idx >= LICENSE_TIERS.length - 1) return false;
    const next = LICENSE_TIERS[idx + 1];
    return this._meetsReq(next.req);
  },

  _meetsReq(req) {
    if(!req || !this._data) return false;
    const d = this._data;
    const allTrackIds = typeof TRACKS !== 'undefined' ? TRACKS.map(t=>t.id) : [];
    const visited = d.tracksVisited || [];
    return (d.kmDriven||0) >= req.km
      && (d.licensePoints||0) >= req.pts
      && (!req.allTracks || allTrackIds.every(id => visited.includes(id)))
      && !req.special; // placeholder
  },

  /* ── Upgrade license ── */
  upgrade() {
    if(!this._data || !this._canUpgrade()) return;
    const idx = LICENSE_TIERS.findIndex(t => t.id === this._data.license);
    const next = LICENSE_TIERS[idx + 1];
    this._data.license = next.id;
    db.collection('users').doc(fbUser.uid).set({license: next.id}, {merge:true}).catch(console.error);
    this._updateBadge();
    this.renderCard();
    // Celebration
    const btn = document.getElementById('btn-lic-upgrade');
    if(btn){ btn.textContent = `✓ ${next.icon} ${next.label} aktiviert!`; btn.disabled = true; }
  },

  /* ── Update badge in menu ── */
  _updateBadge() {
    const nameEl = document.getElementById('fb-user-name');
    if(!this._data) return;
    const tier = LICENSE_TIERS.find(t => t.id === this._data.license) || LICENSE_TIERS[0];
    const name = fbUsername || fbUser?.displayName || 'Fahrer';
    if(nameEl) nameEl.innerHTML = `${_esc(name)} <span class="lic-badge lic-${tier.id}">${tier.icon} ${tier.label}</span>`;

    // Update new topbar stats
    const licLabel = document.getElementById('ms-lic-label');
    const licIcon  = document.getElementById('ms-lic-icon');
    const statLp   = document.getElementById('ms-stat-lp');
    const statKm   = document.getElementById('ms-stat-km');
    if(licLabel) licLabel.textContent = `${tier.label.toUpperCase()} RANK`;
    if(licIcon)  licIcon.textContent  = tier.icon;
    if(statLp)   statLp.textContent   = `${(this._data.licensePoints||0).toFixed(1)} / ${LICENSE_TIERS[Math.min(LICENSE_TIERS.findIndex(t=>t.id===this._data.license)+1, LICENSE_TIERS.length-1)]?.req?.pts || '∞'}`;
    if(statKm)   statKm.textContent   = `${Math.round(this._data.kmDriven||0)} km`;
    // HUD LP display
    const hudLp = document.getElementById('stat-lp');
    if(hudLp){
      hudLp.style.display = '';
      hudLp.textContent = `${tier.icon} ${(this._data.licensePoints||0).toFixed(1)} LP`;
    }
  },

  /* ── Render license card ── */
  renderCard() {
    if(!this._data) return;
    const d = this._data;
    const tier = LICENSE_TIERS.find(t => t.id === d.license) || LICENSE_TIERS[0];
    const name = fbUsername || fbUser?.displayName || 'Fahrer';
    const idx  = LICENSE_TIERS.findIndex(t => t.id === d.license);
    const next = LICENSE_TIERS[idx + 1] || null;

    // Main card
    const card = document.getElementById('lic-card');
    const allTrackIds = typeof TRACKS !== 'undefined' ? TRACKS.map(t=>t.id) : [];
    const visited = d.tracksVisited || [];

    card.innerHTML = `
      <div class="lic-card-top">
        <div class="lic-avatar ${tier.id}">${_licImg(tier.id, 32)}</div>
        <div>
          <div class="lic-name">${_esc(name)}</div>
          <span class="lic-badge lic-${tier.id}" style="margin-top:6px;display:inline-flex">${tier.icon} ${tier.label.toUpperCase()} LIZENZ</span>
        </div>
      </div>
      <div class="lic-stats">
        <div class="lic-stat">
          <div class="lic-stat-label">Kilometer</div>
          <div class="lic-stat-value">${Math.floor(d.kmDriven||0)} km</div>
        </div>
        <div class="lic-stat">
          <div class="lic-stat-label">Lizenzpunkte</div>
          <div class="lic-stat-value ${(d.licensePoints||0)<0?'red':(d.licensePoints||0)>=50?'green':'amber'}">${(d.licensePoints||0).toFixed(1)}</div>
        </div>
        <div class="lic-stat">
          <div class="lic-stat-label">Gültige Runden</div>
          <div class="lic-stat-value">${d.validLaps||0}</div>
        </div>
        <div class="lic-stat">
          <div class="lic-stat-label">Siege</div>
          <div class="lic-stat-value green">${d.wins||0}</div>
        </div>
        <div class="lic-stat">
          <div class="lic-stat-label">Podien (P2/P3)</div>
          <div class="lic-stat-value">${(d.p2||0) + (d.p3||0)}</div>
        </div>
        <div class="lic-stat">
          <div class="lic-stat-label">Strecken besucht</div>
          <div class="lic-stat-value">${visited.length} / ${allTrackIds.length}</div>
        </div>
      </div>
      <div class="lic-penalties">
        <div class="lic-pen">
          <div class="lic-pen-label">Wandkontakte</div>
          <div class="lic-pen-value">${d.wallHits||0}</div>
        </div>
        <div class="lic-pen">
          <div class="lic-pen-label">Auto-Kollisionen</div>
          <div class="lic-pen-value">${d.carHits||0}</div>
        </div>
        <div class="lic-pen">
          <div class="lic-pen-label">Ungültige Runden</div>
          <div class="lic-pen-value">${d.invalidLaps||0}</div>
        </div>
      </div>
    `;

    // Next license
    const nextWrap = document.getElementById('lic-next-wrap');
    const nextInner = document.getElementById('lic-next-inner');
    if(!next){
      nextInner.innerHTML = '<div class="lic-maxed">🏆 Maximale Lizenz erreicht!</div>';
      document.getElementById('btn-lic-upgrade')?.remove();
      return;
    }

    const req = next.req;
    const rows = [];

    // km
    const kmOk = (d.kmDriven||0) >= req.km;
    const kmPct = Math.min(100, ((d.kmDriven||0)/req.km)*100);
    rows.push({ ok: kmOk, text: `${Math.floor(d.kmDriven||0)} / ${req.km} km gefahren`,
      bar: kmPct });

    // pts
    const ptsOk = (d.licensePoints||0) >= req.pts;
    const ptsPct = Math.min(100, ((d.licensePoints||0)/req.pts)*100);
    rows.push({ ok: ptsOk, text: `${(d.licensePoints||0).toFixed(1)} / ${req.pts} Lizenzpunkte`,
      bar: ptsPct });

    // all tracks
    if(req.allTracks){
      const tracksOk = allTrackIds.every(id => visited.includes(id));
      const trackPct = allTrackIds.length ? (visited.length/allTrackIds.length*100) : 0;
      rows.push({ ok: tracksOk, text: `${visited.length} / ${allTrackIds.length} Strecken besucht`,
        bar: trackPct });
    }

    // special
    if(req.special) rows.push({ ok: false, text: 'Sonderbedingungen (folgt)', bar: 0 });

    const allMet = rows.every(r => r.ok);
    const nextTier = LICENSE_TIERS.find(t=>t.id===next.id);

    nextInner.innerHTML = `
      <h3>Nächste Lizenz</h3>
      <div class="lic-next-name"><span class="lic-badge lic-${next.id}">${nextTier.icon} ${next.label.toUpperCase()}</span></div>
      <div class="lic-req">
        ${rows.map(r=>`
          <div class="lic-req-row ${r.ok?'met':''}">
            <span class="lic-req-icon">${r.ok?'🟢':'🔴'}</span>
            <span class="lic-req-text">${r.text}</span>
          </div>
          <div class="lic-progress-bar">
            <div class="lic-progress-fill" style="width:${r.bar}%;background:${r.ok?'var(--green)':nextTier.color}"></div>
          </div>
        `).join('')}
      </div>
      <button id="btn-lic-upgrade"${allMet?'':' style="display:none"'}>⬆ LIZENZ UPGRADEN → ${nextTier.icon} ${next.label}</button>
    `;

    if(allMet){
      const upgradeBtn = document.getElementById('btn-lic-upgrade');
      if(upgradeBtn){
        upgradeBtn.style.display='';
        upgradeBtn.onclick = () => this.upgrade();
      }
    }
  },

  open() {
    if(typeof Game !== 'undefined') Game.showScreen('screen-license');
    if(this._data) this.renderCard();
    else document.getElementById('lic-card').innerHTML =
      '<div style="color:#555;font:12px var(--mono);text-align:center;padding:32px">Bitte zuerst anmelden</div>';
  }
};

/* ── Ingenieur initialisieren ── */
RaceEngineer.init();

/* ── Wire license back button ── */
document.getElementById('btn-lic-back').onclick = () => {
  if(typeof Game !== 'undefined') Game.showScreen('screen-start');
};

/* ── Game hooks ── */
window.onGameLapComplete = (info) => {
  LicenseSystem.onLap(info);
  RaceEngineer.onLapComplete(info);
};
window.onGameRaceFinish = (info) => {
  LicenseSystem.onRaceFinish(info);
  RaceEngineer.hideWidget();
};

/* ── Hook into game's best lap save ── */
// Patch is called after Game.boot() so CARS/TRACKS exist
// We intercept the Store.set for best lap
const _origStoreSet = Store.set.bind(Store);
Store.set = function(key, val){
  _origStoreSet(key, val);
  if(key === 'totalKm'){
    LicenseSystem.syncKm(parseFloat(val)||0);
  }
  if(key.startsWith('best_') && typeof Game !== 'undefined'){
    // key = 'best_{trackId}_{carId}'
    const parts = key.slice(5).split('_');
    if(parts.length >= 2){
      const carId   = parts[parts.length-1];
      const trackId = parts.slice(0,-1).join('_');
      const carDef   = (typeof CARS !== 'undefined') ? CARS.find(c=>c.id===carId) : null;
      const carName  = carDef ? carDef.name : carId;
      const classType = carDef ? carDef.classType : 'unknown';
      const replayFrames = (typeof Game !== 'undefined' && Game.bestLapReplay) ? Game.bestLapReplay.frames : null;
      window.FB_saveBestLap(trackId, carId, parseFloat(val)*1000, carName, classType, replayFrames);
    }
  }
};

/* ══════════════════════════════════════════════════════
   DAILY CHALLENGE SYSTEM
   ══════════════════════════════════════════════════════ */
const DailyChallenge = (() => {
  const DC_LAPS       = 5;
  const DC_AI_COUNT   = 15;
  const DC_AI_DIFF    = 92;   // 0-100, very hard
  const DC_TOP_N      = 3;    // must finish top 3

  function todayKey(){
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  }
  function storageKey(){ return 'dc_done_' + todayKey(); }

  function isDone(){ return !!localStorage.getItem(storageKey()); }
  function markDone(){ localStorage.setItem(storageKey(), '1'); }

  /* Deterministic pseudo-random pick by date string */
  function dateHash(str){
    let h = 0;
    for(let i=0;i<str.length;i++) h = (Math.imul(31,h) + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function getDailyTrackIdx(){
    if(typeof Game === 'undefined') return 0;
    const pool = Game.getTrackPool();
    return dateHash(todayKey()) % pool.length;
  }

  function render(){
    const elName   = document.getElementById('dc-track-name');
    const elDesc   = document.getElementById('dc-desc');
    const elStatus = document.getElementById('dc-status');
    const elBtn    = document.getElementById('dc-start-btn');
    if(!elName) return;

    if(typeof Game === 'undefined' || !Game.getTrackPool){ return; }
    const pool = Game.getTrackPool();
    const idx  = getDailyTrackIdx();
    const track = pool[idx];
    if(!track){ return; }

    elName.textContent   = track.name || 'Unbekannte Strecke';
    elDesc.textContent   = `${DC_LAPS} Runden · ${DC_AI_COUNT} Gegner (Stärke ${DC_AI_DIFF}) · Top ${DC_TOP_N} Ziel`;

    if(isDone()){
      elStatus.textContent       = '✅ Abgeschlossen';
      elStatus.style.background  = '#1e5c2a';
      elStatus.style.borderColor = '#2e8b57';
      elStatus.style.display     = '';
      elBtn.style.display        = 'none';
    } else {
      elStatus.textContent       = `Top ${DC_TOP_N} erreichen`;
      elStatus.style.background  = '';
      elStatus.style.borderColor = '';
      elStatus.style.display     = '';
      elBtn.style.display        = '';
    }
  }

  function applySettings(){
    if(typeof Game === 'undefined') return;
    Game.selTrack            = getDailyTrackIdx();
    Game.mode                = 'race3';
    Game.raceLaps            = DC_LAPS;
    Game.numAI               = DC_AI_COUNT;
    Game.aiDifficulty        = DC_AI_DIFF;
    Game.scEnabled           = false;
    Game.vscEnabled          = false;
    Game.pitStopsEnabled     = false;
    Game.championshipEnabled = false;
    Game.rollingStart        = true;
    Game._dailyChallengeActive = true;
  }

  function start(){
    if(typeof Game === 'undefined') return;
    applySettings();
    // Go through car selection, then skip the mode screen and start directly.
    // We patch showScreen once to detect when screen-mode appears and redirect.
    const _origShowScreen = Game.showScreen.bind(Game);
    Game._dcShowScreenPatch = true;
    const _patchedShow = function(id){
      if(id === 'screen-mode' && Game._dcShowScreenPatch){
        Game._dcShowScreenPatch = false;
        Game.showScreen = _origShowScreen;
        applySettings();
        Game.startRace();
        return;
      }
      _origShowScreen(id);
    };
    Game.showScreen = _patchedShow;
    Game.showScreen('screen-car');
  }

  /* Hook into race finish */
  const _prevOnRaceFinish = window.onGameRaceFinish;
  window.onGameRaceFinish = function(info){
    if(typeof _prevOnRaceFinish === 'function') _prevOnRaceFinish(info);
    if(typeof Game !== 'undefined' && Game._dailyChallengeActive){
      Game._dailyChallengeActive = false;
      if(info.pos && info.pos <= DC_TOP_N){
        markDone();
        render();
        // small toast
        const toast = document.createElement('div');
        toast.textContent = `🏆 Tagesherausforderung abgeschlossen! P${info.pos}`;
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e5c2a;color:#fff;padding:12px 24px;border-radius:8px;font:700 15px Rajdhani,sans-serif;z-index:9999;letter-spacing:.05em';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
      }
    }
  };

  /* Wire the start button */
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('dc-start-btn');
    if(btn) btn.onclick = () => { if(!isDone()) start(); };
  });
  // Also try immediately in case DOM is ready
  (() => {
    const btn = document.getElementById('dc-start-btn');
    if(btn) btn.onclick = () => { if(!isDone()) start(); };
  })();

  /* Re-render whenever main screen is shown */
  const _origShow = typeof Game !== 'undefined' && Game.showScreen ? Game.showScreen.bind(Game) : null;
  // We patch showScreen after Game is available — use a MutationObserver trick on screen-start
  const _dcObs = new MutationObserver(() => {
    const el = document.getElementById('screen-start');
    if(el && !el.classList.contains('hidden')) render();
  });
  const _startScreen = document.getElementById('screen-start');
  if(_startScreen) _dcObs.observe(_startScreen, { attributes: true, attributeFilter: ['class'] });

  return { render, isDone, start };
})();

// Initial render attempt (Game may not be ready yet — render() guards this)
setTimeout(() => DailyChallenge.render(), 500);

/* ═══════════════════════════════════════════════
   TUTORIAL (Erststart-Einführung für neue Spieler)
   ═══════════════════════════════════════════════
   Läuft komplett lokal über Store/localStorage — Solo-Spiel ist nicht
   login-gated, daher darf das Tutorial nicht von einem Firebase-Account
   abhängen. Patcht Game.showScreen/Game._afterCarSelect nur temporär
   (Muster aus DailyChallenge.start() oben), keine Kern-Eingriffe. */
const Tutorial = (() => {
  const FLAG_KEY = 'tutorial_done_v1';
  const RECOMMENDED_TRACK_ID = 'flat'; // "Flugfeld Nord" — flach, breit, viel Auslauf

  let active = false;
  let timers = [];
  let _origShowScreen = null;
  let _origAfterCarSelect = null;

  function isDone(){ return !!Store.get(FLAG_KEY); }
  function markDone(){ Store.set(FLAG_KEY, '1'); }

  function clearTimers(){ timers.forEach(id => { clearTimeout(id); clearInterval(id); }); timers = []; }

  function highlightEl(el){
    const hl = document.getElementById('tut-highlight');
    if(!hl) return;
    if(!el){ hl.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    hl.style.display = 'block';
    hl.style.top = (r.top - 4) + 'px';
    hl.style.left = (r.left - 4) + 'px';
    hl.style.width = (r.width + 8) + 'px';
    hl.style.height = (r.height + 8) + 'px';
  }

  /** Kurzer Hinweis am unteren Bildschirmrand. opts.dismiss=false blendet den
      "Verstanden"-Button aus (für Menü-Schritte, die durch den echten Klick
      des Spielers fortschreiten, nicht durch einen Tutorial-Button). */
  function showCoach(text, opts = {}){
    const box = document.getElementById('tut-coach');
    if(!box) return;
    box.querySelector('.tut-body').textContent = text;
    const btn = document.getElementById('tut-next');
    if(opts.dismiss === false){
      btn.style.display = 'none';
    } else {
      btn.style.display = '';
      btn.onclick = () => hideCoach();
    }
    box.classList.remove('hidden');
    if(opts.autoHideMs){
      const id = setTimeout(() => hideCoach(), opts.autoHideMs);
      timers.push(id);
    }
  }
  function hideCoach(){
    const box = document.getElementById('tut-coach');
    if(box) box.classList.add('hidden');
  }

  function finish(){
    if(!active) return;
    active = false;
    clearTimers();
    if(_origShowScreen){ Game.showScreen = _origShowScreen; _origShowScreen = null; }
    if(_origAfterCarSelect){ Game._afterCarSelect = _origAfterCarSelect; _origAfterCarSelect = null; }
    hideCoach();
    highlightEl(null);
    document.getElementById('tut-skip-global')?.classList.add('hidden');
    document.getElementById('tut-welcome')?.classList.add('hidden');
    document.getElementById('tut-final')?.classList.add('hidden');
    markDone();
    if(typeof Achievements !== 'undefined') Achievements.unlock('tutorial_done');
  }

  function patchNavigation(){
    _origShowScreen = Game.showScreen.bind(Game);
    Game.showScreen = function(id){
      _origShowScreen(id);
      if(!active) return;
      if(id === 'screen-mode-select') onModeSelectScreen();
      else if(id === 'screen-track') onTrackScreen();
      else if(id === 'screen-car') onCarScreen();
    };
    _origAfterCarSelect = Game._afterCarSelect.bind(Game);
    Game._afterCarSelect = function(){
      _origAfterCarSelect();
      if(active && Game.mode === 'tt') waitForRaceStart();
    };
  }

  function onModeSelectScreen(){
    highlightEl(document.getElementById('btn-msel-tt'));
    showCoach('Wähle „Zeitfahren" — frei fahren, ohne Gegner und ohne Zeitdruck.', { dismiss:false });
  }
  function onTrackScreen(){
    const pool = Game.getTrackPool();
    const idx = pool.findIndex(t => t.id === RECOMMENDED_TRACK_ID);
    const list = document.getElementById('tracklist');
    let target = null;
    if(idx >= 0 && list?.children[idx]) target = list.children[idx].querySelector('.card') || list.children[idx];
    highlightEl(target);
    showCoach('Wähle am besten „Flugfeld Nord" — breit, flach, viel Auslauf zum Üben.', { dismiss:false });
  }
  function onCarScreen(){
    highlightEl(null);
    showCoach('Wähle ein beliebiges Auto — für den Einstieg spielt das keine Rolle.', { dismiss:false });
  }

  /** Wartet bis startRace() (async, lädt Szene) tatsächlich state='race' erreicht
      hat, bevor In-Race-Hinweise eingeblendet werden. */
  function waitForRaceStart(){
    hideCoach();
    highlightEl(null);
    let waited = 0;
    const id = setInterval(() => {
      waited += 200;
      if(!active){ clearInterval(id); return; }
      if(Game.state === 'race'){ clearInterval(id); armRaceHints(); }
      else if(waited > 20000){ clearInterval(id); } // Sicherheitsabbruch, falls Ladevorgang fehlschlägt
    }, 200);
    timers.push(id);
  }

  function armRaceHints(){
    const t0 = performance.now();
    // Fahrhilfen für den Einstieg auf Maximum, falls vorhanden
    if(Game.car){ Game.absLevel = 6; Game.tcLevel = 6; }

    timers.push(setTimeout(() => {
      if(active) showCoach('Oben links: Rundenzeit. Unten rechts: Tempo & Gang. Rechts: Minikarte.', { autoHideMs:6000 });
    }, 2000));

    timers.push(setTimeout(() => {
      if(!active) return;
      const isMobile = Game.deviceMode === 'mobile';
      showCoach(isMobile
        ? 'Steuere über die Touch-Pedale/das Lenkrad am Bildschirmrand.'
        : 'Gas: W · Bremse: S · Lenken: A/D (oder Pfeiltasten).',
        { autoHideMs:6000 });
    }, 8000));

    // Stuck-Erkennung nutzt car._stuckT, das ohnehin pro Frame für alle Autos
    // inkl. Spieler mitgezählt wird — keine neue Erkennungslogik nötig.
    let stuckHintShown = false;
    const stuckId = setInterval(() => {
      if(!active){ clearInterval(stuckId); return; }
      if(!stuckHintShown && (Game.car?._stuckT || 0) > 3){
        stuckHintShown = true;
        showCoach('Festgefahren? Drück E, um zurückgesetzt zu werden.', { autoHideMs:6000 });
      }
    }, 500);
    timers.push(stuckId);

    // Abschluss nach 1 Runde oder 45s
    const doneId = setInterval(() => {
      if(!active){ clearInterval(doneId); return; }
      if(Game.state !== 'race') return;
      const lapDone = (Game.race?.lap || 0) >= 2;
      const timeUp = (performance.now() - t0) > 45000;
      if(lapDone || timeUp){ clearInterval(doneId); showFinalPanel(); }
    }, 1000);
    timers.push(doneId);
  }

  function showFinalPanel(){
    hideCoach();
    const el = document.getElementById('tut-final');
    if(!el){ finish(); return; }
    el.classList.remove('hidden');
    document.getElementById('tut-final-close').onclick = () => {
      el.classList.add('hidden');
      finish();
      Game.toMenu();
    };
  }

  function start(){
    active = true;
    clearTimers();
    patchNavigation();
    document.getElementById('tut-skip-global')?.classList.remove('hidden');
    const skipBtn = document.getElementById('tut-skip-global');
    if(skipBtn) skipBtn.onclick = () => finish();

    const el = document.getElementById('tut-welcome');
    if(!el){ beginNavigation(); return; }
    el.classList.remove('hidden');
    document.getElementById('tut-welcome-start').onclick = () => {
      el.classList.add('hidden');
      beginNavigation();
    };
    document.getElementById('tut-welcome-skip').onclick = () => finish();
  }

  function beginNavigation(){
    Game._pendingMode = 'tt';
    Game.showScreen('screen-mode-select');
  }

  return { start, finish, isDone };
})();

/* Tutorial erneut aufrufbar aus den Einstellungen */
document.addEventListener('DOMContentLoaded', () => {
  const replayBtn = document.getElementById('btn-tutorial-replay');
  if(replayBtn) replayBtn.onclick = () => Tutorial.start();
});

})();
