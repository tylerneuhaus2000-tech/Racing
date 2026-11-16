/* Firestore-Synchronisierung für Race Control.
   Lokal bleibt der Spielstand in rc_saves_v1; Cloud-Slots sind pro Firebase-UID
   getrennt und überschreiben nicht den GT3-Karrierestand. */
(function () {
  'use strict';

  const SAVE_KEY = 'rc_saves_v1';
  const DELETE_KEY = 'rc_cloud_deleted_v1';
  const SLOTS = ['auto', 's1', 's2', 's3'];
  const CONFIG = {
    apiKey: 'AIzaSyDDDE9UVtMn40kGTm4R3-1uSoPQKoOPofk',
    authDomain: 'gridline-bf8c9.firebaseapp.com',
    projectId: 'gridline-bf8c9',
    storageBucket: 'gridline-bf8c9.firebasestorage.app',
    messagingSenderId: '907704359886',
    appId: '1:907704359886:web:5f123aa225fa78293f699f'
  };

  const button = document.getElementById('rcCloudButton');
  const status = document.getElementById('rcCloudState');
  let auth = null;
  let db = null;
  let user = null;
  let syncing = false;
  let syncGeneration = 0;
  const pending = Object.create(null);
  const timers = Object.create(null);
  const lastWrite = Object.create(null);

  function setStatus(message, state) {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state || 'local';
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function writeLocal(saves) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(saves)); return true; }
    catch (e) { return false; }
  }

  function readDeleted() {
    try { return JSON.parse(localStorage.getItem(DELETE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function writeDeleted(deleted) {
    try { localStorage.setItem(DELETE_KEY, JSON.stringify(deleted)); }
    catch (e) {}
  }

  function slotRef(slot, uid) {
    return db.collection('race_control_saves').doc(uid || user.uid)
      .collection('slots').doc(slot);
  }

  function validSlot(slot) { return SLOTS.includes(slot); }

  function remoteEntry(raw) {
    return { name: raw.name || 'Race Control', date: raw.date || '',
      updatedAtMs: Number(raw.updatedAtMs) || 0, data: raw.data };
  }

  function remotePayload(slot, entry) {
    const payload = { slot, deleted: false, name: entry.name || '',
      date: entry.date || '', updatedAtMs: Number(entry.updatedAtMs) || Date.now(),
      data: entry.data };
    const bytes = new Blob([JSON.stringify(payload)]).size;
    if (bytes > 850 * 1024) throw new Error('Der Spielstand ist für den Cloud-Speicher zu groß.');
    return payload;
  }

  async function putSave(slot, entry) {
    await slotRef(slot).set(remotePayload(slot, entry), { merge: false });
    lastWrite[slot] = Date.now();
  }

  async function putTombstone(slot, updatedAtMs) {
    await slotRef(slot).set({ slot, deleted: true, updatedAtMs }, { merge: false });
    lastWrite[slot] = Date.now();
  }

  function flush(slot) {
    clearTimeout(timers[slot]);
    delete timers[slot];
    if (!user || syncing || !pending[slot]) return;
    const job = pending[slot];
    delete pending[slot];
    const work = job.deleted
      ? putTombstone(slot, job.updatedAtMs)
      : putSave(slot, job.entry);
    work.then(() => setStatus('Cloud-Speicher synchronisiert', 'ready'))
      .catch(error => {
        pending[slot] = job;
        setStatus(error && error.code === 'permission-denied'
          ? 'Cloud-Speicher nicht freigegeben · lokal gespeichert'
          : 'Cloud nicht erreichbar · lokal gespeichert', 'error');
        console.warn('[Race Control] Cloud-Speichern fehlgeschlagen:', error);
      });
  }

  function schedule(slot) {
    if (!user || syncing || !pending[slot]) return;
    clearTimeout(timers[slot]);
    const elapsed = Date.now() - (lastWrite[slot] || 0);
    const delay = lastWrite[slot] ? Math.max(1200, 25000 - elapsed) : 1200;
    timers[slot] = setTimeout(() => flush(slot), delay);
  }

  function save(slot, entry) {
    if (!validSlot(slot) || !entry) return;
    const deleted = readDeleted();
    delete deleted[slot];
    writeDeleted(deleted);
    pending[slot] = { entry, deleted: false };
    schedule(slot);
  }

  function remove(slot) {
    if (!validSlot(slot)) return;
    const updatedAtMs = Date.now();
    const deleted = readDeleted();
    deleted[slot] = updatedAtMs;
    writeDeleted(deleted);
    pending[slot] = { deleted: true, updatedAtMs };
    schedule(slot);
  }

  async function syncCloud(currentUser) {
    if (!currentUser) return;
    const generation = ++syncGeneration;
    syncing = true;
    setStatus('Spielstände werden geladen …', 'syncing');
    try {
      const refs = SLOTS.map(slot => slotRef(slot, currentUser.uid).get());
      const snapshots = await Promise.all(refs);
      if (!user || user.uid !== currentUser.uid || generation !== syncGeneration) {
        syncing = false;
        return;
      }
      const local = readLocal();
      const deleted = readDeleted();
      const uploads = [];

      for (let i = 0; i < SLOTS.length; i++) {
        const slot = SLOTS[i];
        const snap = snapshots[i];
        const remote = snap.exists ? snap.data() : null;
        const localEntry = local[slot];
        const localDeleteAt = Number(deleted[slot]) || 0;
        const remoteAt = remote ? Number(remote.updatedAtMs) || 0 : 0;
        const localAt = localEntry ? Number(localEntry.updatedAtMs) || 0 : 0;

        if (localDeleteAt && localDeleteAt >= remoteAt && localDeleteAt >= localAt) {
          delete local[slot];
          if (!remote || !remote.deleted || remoteAt < localDeleteAt) {
            uploads.push(putTombstone(slot, localDeleteAt));
          }
          continue;
        }

        if (remote && remote.deleted) {
          if (localEntry && localAt > remoteAt) {
            delete deleted[slot];
            uploads.push(putSave(slot, localEntry));
          } else {
            delete local[slot];
            deleted[slot] = remoteAt;
          }
          continue;
        }

        if (remote && remote.data !== undefined && (!localEntry || remoteAt > localAt)) {
          local[slot] = remoteEntry(remote);
          delete deleted[slot];
        } else if (localEntry && (!remote || localAt > remoteAt)) {
          delete deleted[slot];
          uploads.push(putSave(slot, localEntry));
        } else if (remote && remote.data !== undefined) {
          delete deleted[slot];
        }
      }

      writeLocal(local);
      writeDeleted(deleted);
      await Promise.all(uploads);
      syncing = false;
      Object.keys(pending).forEach(schedule);
      setStatus('Cloud-Speicher synchronisiert', 'ready');
      window.dispatchEvent(new Event('rc-cloud-updated'));
    } catch (error) {
      syncing = false;
      Object.keys(pending).forEach(schedule);
      setStatus(error && error.code === 'permission-denied'
        ? 'Cloud-Speicher nicht freigegeben · lokal gespeichert'
        : 'Cloud nicht erreichbar · lokal gespeichert', 'error');
      console.warn('[Race Control] Cloud-Synchronisierung fehlgeschlagen:', error);
      window.dispatchEvent(new Event('rc-cloud-updated'));
    }
  }

  function isSafariOrIOS() {
    const ua = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const safari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
    return ios || safari;
  }

  async function signIn() {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const provider = new firebase.auth.GoogleAuthProvider();
    if (isSafariOrIOS()) {
      await auth.signInWithRedirect(provider);
      return;
    }
    try { await auth.signInWithPopup(provider); }
    catch (error) {
      if (error && ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment',
          'auth/web-storage-unsupported'].includes(error.code)) {
        await auth.signInWithRedirect(provider);
        return;
      }
      throw error;
    }
  }

  function authButton() {
    if (!button) return;
    button.disabled = false;
    button.textContent = user
      ? (status && status.dataset.state === 'error' ? 'Erneut synchronisieren' : 'Abmelden')
      : 'Spielstände synchronisieren';
    button.title = user ? 'Von der Cloud abmelden' : 'Mit Google anmelden und Spielstände synchronisieren';
  }

  if (!button || !status) return;
  if (typeof firebase === 'undefined' || !firebase.initializeApp) {
    setStatus('Nur auf diesem Gerät · Firebase nicht geladen', 'error');
    button.addEventListener('click', () => alert('Der Cloud-Speicher konnte gerade nicht geladen werden. Deine Spielstände bleiben lokal auf diesem Gerät.'));
    return;
  }

  try {
    const app = firebase.apps.find(item => item.name === '[DEFAULT]') || firebase.initializeApp(CONFIG);
    auth = app.auth();
    db = app.firestore();
  } catch (error) {
    setStatus('Nur auf diesem Gerät · Cloud nicht verfügbar', 'error');
    button.addEventListener('click', () => alert('Der Cloud-Speicher konnte gerade nicht geladen werden. Deine Spielstände bleiben lokal auf diesem Gerät.'));
    console.warn('[Race Control] Firebase konnte nicht gestartet werden:', error);
    return;
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      if (user && status.dataset.state === 'error') await syncCloud(user);
      else if (user) await auth.signOut();
      else await signIn();
    } catch (error) {
      setStatus('Anmeldung fehlgeschlagen · lokal gespeichert', 'error');
      alert('Die Anmeldung für die Spielstand-Synchronisierung ist fehlgeschlagen. Deine lokalen Spielstände bleiben erhalten.');
      console.warn('[Race Control] Anmeldung fehlgeschlagen:', error);
    } finally {
      button.disabled = false;
      authButton();
    }
  });

  auth.onAuthStateChanged(currentUser => {
    user = currentUser || null;
    if (!user) {
      syncGeneration++;
      syncing = false;
    }
    authButton();
    if (user) syncCloud(user);
    else {
      setStatus('Nur auf diesem Gerät', 'local');
      window.dispatchEvent(new Event('rc-cloud-updated'));
    }
  });

  window.RCCloud = Object.freeze({ save, remove, getUser: () => user });
})();
