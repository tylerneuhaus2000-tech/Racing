/* Firestore-Synchronisierung für Race Control.
   Lokal bleibt der Spielstand in rc_saves_v1; Cloud-Slots sind pro Firebase-UID
   getrennt und überschreiben nicht den GT3-Karrierestand. */
(function () {
  'use strict';

  const SAVE_KEY = 'rc_saves_v1';
  const DELETE_KEY = 'rc_cloud_deleted_v1';
  const TEMPLATE_KEY = 'rc_season_templates_v1';
  const TEMPLATE_COLLECTION = 'race_control_calendar_templates';
  const TEMPLATE_FORMATS = ['full', 'sprint', 'quali', 'race'];
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

  function normalizeTemplateState(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const items = Array.isArray(source.items) ? source.items : [];
    const deleted = Array.isArray(source.deleted) ? source.deleted : [];
    const cleanItems = items.map(item => {
      if (!item || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string'
          || !Array.isArray(item.cal) || !item.cal.length || item.cal.length > 24) return null;
      const cal = item.cal.filter(key => typeof key === 'string' && key.length <= 64);
      if (!cal.length || cal.length !== item.cal.length) return null;
      const formats = cal.map((_, i) => TEMPLATE_FORMATS.includes(item.formats && item.formats[i])
        ? item.formats[i] : 'full');
      const name = item.name.trim().slice(0, 32);
      if (!name) return null;
      return { id: item.id.slice(0, 100), name, cal, formats,
        updatedAtMs: Number(item.updatedAtMs) || 0 };
    }).filter(Boolean).sort((a, b) => b.updatedAtMs - a.updatedAtMs).slice(0, 12);
    const latestDeletes = new Map();
    deleted.forEach(item => {
      if (!item || typeof item.id !== 'string' || !item.id) return;
      const updatedAtMs = Number(item.updatedAtMs) || 0;
      latestDeletes.set(item.id, Math.max(latestDeletes.get(item.id) || 0, updatedAtMs));
    });
    const cleanDeleted = Array.from(latestDeletes, ([id, updatedAtMs]) => ({ id, updatedAtMs }))
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs).slice(0, 100);
    return { items: cleanItems, deleted: cleanDeleted,
      updatedAtMs: Number(source.updatedAtMs) || 0 };
  }

  function readTemplateState() {
    try { return normalizeTemplateState(JSON.parse(localStorage.getItem(TEMPLATE_KEY)) || {}); }
    catch (e) { return normalizeTemplateState({}); }
  }

  function writeTemplateState(state) {
    try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(normalizeTemplateState(state))); return true; }
    catch (e) { return false; }
  }

  function visibleTemplates(state) {
    const normalized = normalizeTemplateState(state);
    const deleted = new Map(normalized.deleted.map(item => [item.id, item.updatedAtMs]));
    return normalized.items.filter(item => !deleted.has(item.id) || item.updatedAtMs > deleted.get(item.id));
  }

  function mergeTemplateStates(localState, remoteState) {
    const local = normalizeTemplateState(localState), remote = normalizeTemplateState(remoteState);
    const items = new Map();
    local.items.concat(remote.items).forEach(item => {
      const current = items.get(item.id);
      if (!current || item.updatedAtMs > current.updatedAtMs) items.set(item.id, item);
    });
    const deleted = new Map();
    local.deleted.concat(remote.deleted).forEach(item => {
      deleted.set(item.id, Math.max(deleted.get(item.id) || 0, item.updatedAtMs));
    });
    const cleanItems = Array.from(items.values())
      .filter(item => !deleted.has(item.id) || item.updatedAtMs > deleted.get(item.id))
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs).slice(0, 12);
    const cleanDeleted = Array.from(deleted, ([id, updatedAtMs]) => ({ id, updatedAtMs }))
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs).slice(0, 100);
    return { items: cleanItems, deleted: cleanDeleted,
      updatedAtMs: Math.max(local.updatedAtMs, remote.updatedAtMs) };
  }

  function templateRef(uid) { return db.collection(TEMPLATE_COLLECTION).doc(uid || user.uid); }

  async function syncSeasonTemplates(currentUser) {
    if (!currentUser || !db) return;
    try {
      const ref = templateRef(currentUser.uid), snapshot = await ref.get();
      if (!user || user.uid !== currentUser.uid) return;
      const local = readTemplateState(), remote = snapshot.exists ? snapshot.data() : {};
      const merged = mergeTemplateStates(local, remote);
      writeTemplateState(merged);
      if (!snapshot.exists || JSON.stringify(normalizeTemplateState(remote)) !== JSON.stringify(merged)) {
        await ref.set(merged, { merge: false });
      }
    } catch (error) {
      console.warn('[Race Control] Saisonvorlagen konnten nicht synchronisiert werden:', error);
    }
  }

  async function listSeasonTemplates() {
    if (!user || !db) return visibleTemplates(readTemplateState());
    await syncSeasonTemplates(user);
    return visibleTemplates(readTemplateState());
  }

  async function saveSeasonTemplate(template) {
    if (!template || typeof template.name !== 'string' || !template.name.trim()
        || template.name.trim().length > 32 || !Array.isArray(template.cal)
        || !template.cal.length || template.cal.length > 24 || !Array.isArray(template.formats)) {
      throw new Error('Ungültige Saisonvorlage.');
    }
    let state = readTemplateState(), ref = null, canSync = false;
    if (user && db) {
      try {
        ref = templateRef();
        const snapshot = await ref.get();
        state = mergeTemplateStates(state, snapshot.exists ? snapshot.data() : {});
        canSync = true;
      } catch (error) {
        setStatus('Vorlage lokal gespeichert · Cloud nicht erreichbar', 'error');
        console.warn('[Race Control] Saisonvorlagen konnten vor dem Speichern nicht geladen werden:', error);
      }
    }
    const visible = visibleTemplates(state), name = template.name.trim();
    const existing = visible.find(item => item.id === template.id
      || item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (!existing && visible.length >= 12) throw new Error('Du kannst höchstens 12 Saisonvorlagen speichern.');
    const cal = template.cal.filter(key => typeof key === 'string' && key.length <= 64);
    if (cal.length !== template.cal.length) throw new Error('Ungültige Strecke in der Saisonvorlage.');
    const updatedAtMs = Math.max(Date.now(), (existing && existing.updatedAtMs || 0) + 1);
    const item = { id: template.id || existing && existing.id ||
      (self.crypto && crypto.randomUUID ? crypto.randomUUID() : 'sc_' + updatedAtMs.toString(36) + '_' + Math.random().toString(36).slice(2, 9)),
      name, cal, formats: cal.map((_, i) => TEMPLATE_FORMATS.includes(template.formats[i]) ? template.formats[i] : 'full'), updatedAtMs };
    state.items = state.items.filter(row => row.id !== item.id && row.name.toLocaleLowerCase() !== name.toLocaleLowerCase()).concat(item);
    state.deleted = state.deleted.filter(row => row.id !== item.id);
    state.updatedAtMs = updatedAtMs;
    if (!writeTemplateState(state)) throw new Error('Auf diesem Gerät ist nicht genug Speicher frei.');
    let cloud = false;
    if (canSync) {
      try {
        await ref.set(state, { merge: false });
        cloud = true;
      } catch (error) {
        setStatus('Vorlage lokal gespeichert · Cloud nicht erreichbar', 'error');
        console.warn('[Race Control] Saisonvorlage konnte nicht in Firestore gespeichert werden:', error);
      }
    }
    return { item, cloud };
  }

  async function deleteSeasonTemplate(id) {
    if (typeof id !== 'string' || !id) throw new Error('Ungültige Saisonvorlage.');
    let state = readTemplateState(), ref = null, canSync = false;
    if (user && db) {
      try {
        ref = templateRef();
        const snapshot = await ref.get();
        state = mergeTemplateStates(state, snapshot.exists ? snapshot.data() : {});
        canSync = true;
      } catch (error) {
        setStatus('Vorlage lokal gelöscht · Cloud nicht erreichbar', 'error');
        console.warn('[Race Control] Saisonvorlagen konnten vor dem Löschen nicht geladen werden:', error);
      }
    }
    const oldItem = state.items.find(item => item.id === id);
    const oldDelete = state.deleted.find(item => item.id === id);
    const updatedAtMs = Math.max(Date.now(), (oldItem && oldItem.updatedAtMs || 0) + 1,
      (oldDelete && oldDelete.updatedAtMs || 0) + 1);
    state.items = state.items.filter(item => item.id !== id);
    state.deleted = state.deleted.filter(item => item.id !== id).concat({ id, updatedAtMs });
    state.updatedAtMs = updatedAtMs;
    if (!writeTemplateState(state)) throw new Error('Auf diesem Gerät ist nicht genug Speicher frei.');
    let cloud = false;
    if (canSync) {
      try {
        await ref.set(state, { merge: false });
        cloud = true;
      } catch (error) {
        setStatus('Vorlage lokal gelöscht · Cloud nicht erreichbar', 'error');
        console.warn('[Race Control] Saisonvorlage konnte nicht aus Firestore gelöscht werden:', error);
      }
    }
    return { cloud };
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
    if (user) {
      syncCloud(user);
      syncSeasonTemplates(user);
    }
    else {
      setStatus('Nur auf diesem Gerät', 'local');
      window.dispatchEvent(new Event('rc-cloud-updated'));
    }
  });

  window.RCCloud = Object.freeze({ save, remove, getUser: () => user,
    listSeasonTemplates, saveSeasonTemplate, deleteSeasonTemplate });
})();
