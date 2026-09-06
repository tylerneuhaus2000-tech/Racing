/* ============================================================================
   GRID LINE — KARRIEREMODUS
   ----------------------------------------------------------------------------
   Eigenständiges Modul (window.Career). Lädt NACH gt3-web-racer.html (Game,
   CARS, TRACKS) und NACH assets/gt3-firebase.js (db, fbUser).

   Speichert nach localStorage (Quelle der Wahrheit, offline nutzbar) und
   spiegelt bei Login nach Firestore careers/{uid}.

   Leiter:  kart_bumper -> kart -> f4 -> PFADWAHL
              formula:   f3 -> f2 -> f1
              endurance: gt3 -> lmp2 -> hyp

   Aufstieg: Saison-Meisterschaft <= promoteCutoff. Punkte entstehen aus
   Qualifying-Startplatz (3 Versuche gegen feste Zielzeiten) + Rennergebnis.

   Qualifying ist standardmäßig SIMULIERT (aus der Pace-Historie); mit
   "Selbst fahren" öffnet sich ein normales Zeitfahren und die neue Bestzeit
   wird als Quali-Referenz übernommen.

   Balancing-Rechnung: docs/gt3-prep/career-mode.md
   ============================================================================ */
(function () {
  'use strict';

  const LS_KEY = 'gl_career_v2';
  const SCHEMA = 2;

  /* ── F1-Punktesystem ── */
  const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

  /* ── Leiter-Definition ─────────────────────────────────────────────────────
     car:      feste Fahrzeug-ID (String) ODER 'contract' -> Ladder unten
     rivals:   Anzahl KI-Gegner in Quali/Rennen
     laps:     Renndistanz (Runden)
     calN:     Kalenderlänge (Anzahl Events)
     cutoff:   Saison-Meisterschaftsplatz, um aufzusteigen (<=)
     diff:     KI-Grundstärke 0..100 (Rennpace)  */
  const LADDER = {
    kart_bumper: { label: 'Kart · Rammschutz', car: 'kart-rental-bumper', rivals: 7,  laps: 6,  calN: 4, cutoff: 4, diff: 46, kart: true },
    kart:        { label: 'Kart',              car: 'kart-rental',         rivals: 9,  laps: 8,  calN: 5, cutoff: 5, diff: 55, kart: true },
    f4:          { label: 'Formel 4',          car: 'tatuus-ft60',         rivals: 13, laps: 8,  calN: 6, cutoff: 5, diff: 62 },
    f3:          { label: 'Formel 3',          car: 'dallara-f312',        rivals: 15, laps: 9,  calN: 8, cutoff: 3, diff: 70 },
    f2:          { label: 'Formel 2',          car: 'f2-2024',             rivals: 17, laps: 10, calN: 8, cutoff: 3, diff: 78 },
    f1:          { label: 'Formel 1',          car: 'contract',            rivals: 19, laps: 12, calN: 10, cutoff: 3, diff: 88 },
    gt3:         { label: 'GT3',               car: 'contract',            rivals: 15, laps: 10, calN: 8, cutoff: 3, diff: 72 },
    lmp2:        { label: 'LMP2',              car: 'contract',            rivals: 13, laps: 10, calN: 8, cutoff: 3, diff: 80 },
    hyp:         { label: 'Hypercar',          car: 'contract',            rivals: 15, laps: 12, calN: 10, cutoff: 3, diff: 88 }
  };
  const STAGE_ORDER_BASE = ['kart_bumper', 'kart', 'f4'];
  const PATHS = {
    formula:   ['f3', 'f2', 'f1'],
    endurance: ['gt3', 'lmp2', 'hyp']
  };

  /* ── Contract-Ladders (nur Klassen mit mehreren Autos) ────────────────────
     [0] = Einstiegs-/Basisvertrag (immer fahrbar). Danach aufsteigend.
     cost = Credits, um DIESE Stufe freizuschalten. */
  const CONTRACTS = {
    gt3: [
      { car: 'dacia',        name: 'Dacia — Ollis Garage Racing', cost: 0 },
      { car: 'bmw',          name: 'BMW M4 GT3',                   cost: 12000 },
      { car: 'audi',         name: 'Audi R8 LMS GT3',             cost: 24000 },
      { car: 'amg',          name: 'Mercedes-AMG GT3',            cost: 42000 },
      { car: 'porsche',      name: 'Porsche 911 GT3 R',           cost: 66000 },
      { car: 'lamborghini',  name: 'Lamborghini Huracán GT3',     cost: 96000 },
      { car: 'ferrari296gt3',name: 'Ferrari 296 GT3',             cost: 135000 }
    ],
    lmp2: [
      { car: 'oreca07',    name: 'Oreca 07 LMP2',   cost: 0 },
      { car: 'alpine-lmp2',name: 'Alpine A470 LMP2', cost: 70000 }
    ],
    hyp: [
      { car: 'porsche963-penske', name: 'Porsche 963',        cost: 0 },
      { car: 'cadillac-vseriesr', name: 'Cadillac V-Series.R', cost: 32000 },
      { car: 'alpinea424',        name: 'Alpine A424',         cost: 68000 },
      { car: 'genesis-magma',     name: 'Genesis Magma Racing',cost: 115000 },
      { car: 'peugeot9x8',        name: 'Peugeot 9X8 EVO',     cost: 175000 },
      { car: 'toyota-gr010',      name: 'Toyota GR010 Hybrid', cost: 250000 },
      { car: 'ferrari499p',       name: 'Ferrari 499P',        cost: 340000 }
    ],
    f1: [
      { car: 'williams-fw48', name: 'Williams FW48',     cost: 0 },
      { car: 'aston-amr26',   name: 'Aston Martin AMR26', cost: 95000 },
      { car: 'redbull-rb22',  name: 'Red Bull RB22',     cost: 230000 },
      { car: 'ferrari-sf25',  name: 'Ferrari SF-25',     cost: 420000 }
    ]
  };

  /* ── Credits ──────────────────────────────────────────────────────────────
     Rennauszahlung = base[stage] * posFaktor + Bonus.  posFaktor: P1=1.0 …
     letzter ≈ 0.28.  Fastest Lap +8%.  Saison-Abschluss = seasonBonus[stage]
     (x1.6 bei Aufstieg).  Herleitung + Zeitrechnung: docs/gt3-prep/career-mode.md */
  const CREDIT_BASE = {
    kart_bumper: 260, kart: 320, f4: 620, f3: 1100, f2: 1700, f1: 3200,
    gt3: 1500, lmp2: 2400, hyp: 3600
  };
  const SEASON_BONUS = {
    kart_bumper: 900, kart: 1200, f4: 2600, f3: 5200, f2: 8200, f1: 16000,
    gt3: 7000, lmp2: 11000, hyp: 17000
  };

  /* ── Kalender: nur bereits im Spiel funktionierende Strecken ──────────────
     Wird beim Saisonstart aus dem verfügbaren TRACKS-Pool gefüllt. Reihenfolge
     ~ nach Referenzrundenzeit (kurz -> lang) für "leicht -> schwer".
     karts nutzen bevorzugt kartOnly-Strecken. */
  const CAL_TIERS = {
    kart: ['kartbahn-lider', 'norisring', 'stadtring', 'superspeedway', 'alpen', 'veloce', 'flat'],
    low:  ['norisring', 'stadtring', 'hockenheim-alt', 'silberpfeil', 'veloce', 'alpen',
           'redbullring-custom', 'highspeed-pro', 'inselring'],
    mid:  ['hockenheim-alt', 'silberpfeil', 'redbullring-custom', 'bahrain-custom', 'monza',
           'custom_1782749661475', 'custom_1782746264191', 'silverstone-gp', 'oasis', 'riviera', 'bergkristall'],
    high: ['redbullring-custom', 'bahrain-custom', 'monza', 'silverstone-gp', 'custom_1782749661475',
           'custom_1782746264191', 'custom_1782743640261', 'inselring', 'bergkristall', 'highspeed-pro',
           'riviera', 'lemans-long']
  };
  const STAGE_TIER = {
    kart_bumper: 'kart', kart: 'kart', f4: 'low', f3: 'mid', f2: 'mid', f1: 'high',
    gt3: 'low', lmp2: 'mid', hyp: 'high'
  };

  /* ── Referenz-Rundenzeiten (Sekunden) je Strecke — GROBWERTE, an realen
     Layouts orientiert und für die GT3-Klasse skaliert. Werden zur Quali-
     Simulation genutzt; die tatsächliche Balance passt sich zusätzlich an die
     nachgewiesene Spieler-Pace an (siehe _qualiTargets).
     ⚠ NICHT im Spiel gemessen — Kalibrier-Kandidaten. */
  const REF_LAP_GT3 = {
    'kartbahn-lider': 52, 'norisring': 49, 'stadtring': 74, 'hockenheim-alt': 78,
    'silberpfeil': 86, 'redbullring-custom': 90, 'bahrain-custom': 103,
    'silverstone-gp': 118, 'monza': 108, 'lemans-long': 218,
    'custom_1782743640261': 138, 'custom_1782746264191': 100, 'custom_1782749661475': 92,
    'veloce': 70, 'alpen': 64, 'flat': 66, 'highspeed-pro': 96, 'superspeedway': 44,
    'inselring': 88, 'oasis': 92, 'bergkristall': 95, 'riviera': 99, 'monza-alt': 105
  };
  const REF_LAP_FALLBACK = 95;
  /* Klassen-Pace relativ zu GT3 (kleiner = schneller). Grobwerte. */
  const CLASS_PACE = {
    kart_bumper: 1.30, kart: 1.22, f4: 1.12, f3: 1.03, f2: 0.965, f1: 0.86,
    gt3: 1.00, lmp2: 0.945, hyp: 0.90
  };

  /* ══════════════════════════════════════════════════════════════════════════
     STATE
     ══════════════════════════════════════════════════════════════════════════ */
  let S = null;          // aktueller Karriere-State
  let _fsSynced = false;

  function _defaultState() {
    return {
      schema: SCHEMA,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stageKey: 'kart_bumper',
      path: null,                 // 'formula' | 'endurance' (nach F4)
      credits: 0,
      contracts: { gt3: 0, lmp2: 0, hyp: 0, f1: 0 },   // Index in CONTRACTS[key]
      season: null,              // { stageKey, round, calendar[], points, standings{}, results[] }
      stageSeasons: {},          // wie oft eine Stufe bereits eine Saison beendet hat (Kalender-Rotation)
      completed: [],             // abgeschlossene Stufen [{stageKey, champPos, at}]
      stats: { races: 0, wins: 0, podiums: 0, seasons: 0, poles: 0 },
      qualiRef: {}               // { "<trackId>_<carId>": bestMs }  aus "selbst fahren"
    };
  }

  function _load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.schema === SCHEMA) return p;
      }
    } catch (e) {}
    return null;
  }

  function _save() {
    if (!S) return;
    S.updatedAt = Date.now();
    try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {}
    _pushFirestore();
  }

  function _pushFirestore() {
    try {
      if (typeof db === 'undefined' || typeof fbUser === 'undefined' || !fbUser) return;
      db.collection('careers').doc(fbUser.uid).set(S, { merge: false }).catch(() => {});
    } catch (e) {}
  }

  async function _pullFirestore() {
    try {
      if (typeof db === 'undefined' || typeof fbUser === 'undefined' || !fbUser) return;
      const snap = await db.collection('careers').doc(fbUser.uid).get();
      if (snap.exists) {
        const remote = snap.data();
        if (remote && remote.schema === SCHEMA) {
          // Neuere Version gewinnt
          if (!S || (remote.updatedAt || 0) > (S.updatedAt || 0)) {
            S = remote;
            try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {}
          } else {
            _pushFirestore();
          }
        }
      } else {
        _pushFirestore();
      }
    } catch (e) {}
    _fsSynced = true;
    render();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     LEITER-LOGIK
     ══════════════════════════════════════════════════════════════════════════ */
  function stageOrder() {
    return S.path ? STAGE_ORDER_BASE.concat(PATHS[S.path]) : STAGE_ORDER_BASE.concat(['f4']); // f4 = letzte bekannte
  }
  function fullLadderForDisplay() {
    // Zeigt beide Pfade bis zur Wahl, danach nur den gewählten
    if (S.path) return STAGE_ORDER_BASE.concat(PATHS[S.path]);
    return STAGE_ORDER_BASE.concat(['f4']).filter((v, i, a) => a.indexOf(v) === i);
  }
  function stageIndex(key) { return fullLadderForDisplay().indexOf(key); }
  function isLastStage(key) {
    const o = S.path ? STAGE_ORDER_BASE.concat(PATHS[S.path]) : null;
    return o ? o[o.length - 1] === key : false;
  }
  function nextStageKey(key) {
    if (key === 'f4') return null;             // -> Pfadwahl
    const o = S.path ? STAGE_ORDER_BASE.concat(PATHS[S.path]) : STAGE_ORDER_BASE.concat(['f4']);
    const i = o.indexOf(key);
    return i >= 0 && i < o.length - 1 ? o[i + 1] : null;
  }

  function contractKeyFor(stageKey) {
    return CONTRACTS[stageKey] ? stageKey : null;
  }
  function currentCarId(stageKey) {
    const L = LADDER[stageKey];
    if (!L) return 'bmw';
    if (L.car !== 'contract') return L.car;
    const ck = contractKeyFor(stageKey);
    const idx = Math.min(S.contracts[ck] || 0, CONTRACTS[ck].length - 1);
    return CONTRACTS[ck][idx].car;
  }
  function nextContract(stageKey) {
    const ck = contractKeyFor(stageKey);
    if (!ck) return null;
    const idx = (S.contracts[ck] || 0) + 1;
    return idx < CONTRACTS[ck].length ? Object.assign({ index: idx }, CONTRACTS[ck][idx]) : null;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     KALENDER + QUALI-SIMULATION
     ══════════════════════════════════════════════════════════════════════════ */
  function _trackPoolIds() {
    try {
      const pool = (typeof Game !== 'undefined' && Game.getTrackPool) ? Game.getTrackPool() : (typeof TRACKS !== 'undefined' ? TRACKS : []);
      return pool.map(t => t && t.id).filter(Boolean);
    } catch (e) { return []; }
  }
  function _trackById(id) {
    const pool = (typeof Game !== 'undefined' && Game.getTrackPool) ? Game.getTrackPool() : (typeof TRACKS !== 'undefined' ? TRACKS : []);
    return pool.find(t => t && t.id === id) || null;
  }
  function _isKartTrack(id) { const t = _trackById(id); return !!(t && t.kartOnly); }
  function _trackName(id) { const t = _trackById(id); return t ? t.name : id; }
  function refLap(trackId, stageKey) {
    const base = REF_LAP_GT3[trackId] || REF_LAP_FALLBACK;
    return base * (CLASS_PACE[stageKey] || 1);
  }

  function buildCalendar(stageKey) {
    const L = LADDER[stageKey];
    const avail = _trackPoolIds();
    const tier = STAGE_TIER[stageKey] || 'low';
    let pool = (CAL_TIERS[tier] || CAL_TIERS.low).filter(id => avail.includes(id));
    if (!L.kart) pool = pool.filter(id => !_isKartTrack(id));
    // Auffüllen, falls das Tier-Pool zu klein ist
    if (pool.length < L.calN) {
      avail.forEach(id => {
        if (pool.length >= L.calN + 4) return;
        if (pool.includes(id)) return;
        if (!L.kart && _isKartTrack(id)) return;
        pool.push(id);
      });
    }
    // Rotation je wiederholter Saison dieser Stufe, damit Kalender variiert
    const rot = ((S && S.stageSeasons && S.stageSeasons[stageKey]) || 0) % Math.max(1, pool.length);
    const rotated = pool.slice(rot).concat(pool.slice(0, rot));
    let list = rotated.slice(0, L.calN);
    // innerhalb der Saison grob nach Referenzrundenzeit ordnen (leicht -> schwer)
    list.sort((a, b) => (REF_LAP_GT3[a] || REF_LAP_FALLBACK) - (REF_LAP_GT3[b] || REF_LAP_FALLBACK));
    return list;
  }

  /* Deterministischer Pseudo-Zufall pro Event */
  function _seedRand(seedStr) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* Zielzeiten der Gegner + Startaufstellung.
     playerBestMs: beste Quali-Runde des Spielers in ms (aus Sim oder selbst gefahren) */
  function qualiField(stageKey, trackId, round, calN, playerBestMs) {
    const L = LADDER[stageKey];
    const rnd = _seedRand(stageKey + '|' + trackId + '|' + round);
    const ref = refLap(trackId, stageKey) * 1000;    // ms

    // Kalender-Schwierigkeit: früh leichter, spät schwerer
    const prog = calN > 1 ? round / (calN - 1) : 0;        // 0..1
    const fieldStrength = 1 - (0.030 - 0.055 * prog);      // Pole ~3% über ref früh, ~ -2.5% spät

    // Rivalen-Zielzeiten fächern von Pole (schnellste) bis Ende
    const rivals = [];
    for (let i = 0; i < L.rivals; i++) {
      const frac = L.rivals > 1 ? i / (L.rivals - 1) : 0;   // 0 Pole … 1 letzter
      const spread = frac * (0.045 + 0.02 * prog);          // bis +4.5..6.5% hinten
      const jitter = (rnd() - 0.5) * 0.006;
      rivals.push({ ai: true, ms: Math.round(ref * fieldStrength * (1 + spread + jitter)) });
    }
    rivals.sort((a, b) => a.ms - b.ms);

    // Wenn keine Spielerzeit vorliegt: an die Feldmitte + Strafe setzen
    let pMs = playerBestMs;
    if (!pMs || pMs <= 0) {
      const mid = rivals[Math.floor(rivals.length / 2)].ms;
      pMs = Math.round(mid * 1.012);
    }
    const grid = rivals.concat([{ me: true, ms: pMs }]).sort((a, b) => a.ms - b.ms);
    const pPos = grid.findIndex(e => e.me) + 1;
    return { grid, pPos, ref: Math.round(ref), poleMs: grid[0].ms };
  }

  /* Simulierte Quali-Zeit des Spielers, falls er nicht selbst fährt.
     Nutzt: (1) selbst gefahrene Referenz, (2) beste Firestore-Zeit auf der
     Strecke im Klassentyp, (3) sonst Feld-Median * 1.01 (leicht über Mitte). */
  function simPlayerQuali(stageKey, trackId, carId, round, calN) {
    const key = trackId + '_' + carId;
    if (S.qualiRef[key]) return S.qualiRef[key];
    // grobe Schätzung: ref der Klasse * (1.0 .. 1.03) je nach bisherigem Karriere-Erfolg
    const ref = refLap(trackId, stageKey) * 1000;
    const skill = _careerSkill();          // 0 (Anfänger) .. 1 (stark)
    const factor = 1.035 - 0.05 * skill;   // 3.5% über ref bis 1.5% unter
    return Math.round(ref * factor);
  }
  function _careerSkill() {
    const st = S.stats || {};
    const done = (S.completed || []).length;
    const winRate = st.races ? st.wins / st.races : 0;
    return Math.max(0, Math.min(1, 0.25 + done * 0.09 + winRate * 0.4));
  }

  /* ══════════════════════════════════════════════════════════════════════════
     SAISON / EVENT
     ══════════════════════════════════════════════════════════════════════════ */
  function ensureSeason() {
    if (S.season && S.season.stageKey === S.stageKey && Array.isArray(S.season.calendar) && S.season.calendar.length) return;
    const cal = buildCalendar(S.stageKey);
    S.season = {
      stageKey: S.stageKey,
      round: 0,
      calendar: cal,
      points: 0,
      standings: {},           // rivalId -> points  (+ 'ME')
      results: []              // pro Event { trackId, quali:{pMs,pPos,poleMs}, race:{pos,pts,credits,fastest} }
    };
    _save();
  }

  function eventInfo() {
    ensureSeason();
    const s = S.season;
    if (s.round >= s.calendar.length) return null;   // Saison fertig
    const trackId = s.calendar[s.round];
    const carId = currentCarId(S.stageKey);
    return {
      stageKey: S.stageKey, round: s.round, calN: s.calendar.length,
      trackId, trackName: _trackName(trackId), carId, ladder: LADDER[S.stageKey]
    };
  }

  /* Öffnet ein normales Zeitfahren als "Quali selbst fahren". Beim Zurückkehren
     ins Karriere-Menü wird die neue Bestzeit als qualiRef übernommen. */
  function driveQuali() {
    const ev = eventInfo();
    if (!ev || typeof Game === 'undefined') return;
    const pool = Game.getTrackPool();
    const tIdx = pool.findIndex(t => t && t.id === ev.trackId);
    const cIdx = (typeof CARS !== 'undefined') ? CARS.findIndex(c => c.id === ev.carId) : -1;
    if (tIdx < 0 || cIdx < 0) { alert('Strecke oder Fahrzeug für dieses Event nicht verfügbar.'); return; }
    Game._careerQualiWatch = { trackId: ev.trackId, carId: ev.carId };
    Game.selTrack = tIdx;
    Game.selCar = cIdx;
    Game.selLivery = 0;
    Game.mode = 'tt';
    hide();
    try { Game.startRace(); } catch (e) { console.error('[Career] Quali-Start:', e); }
  }

  /* Vom Spiel aufgerufen (Hook in _wrapHooks), wenn im Zeitfahren eine Runde
     abgeschlossen wurde und ein Quali-Watch aktiv ist. */
  function _onTTLap(info) {
    const w = (typeof Game !== 'undefined') && Game._careerQualiWatch;
    if (!w || !info || info.valid === false) return;
    const ms = Math.round((info.lapTime || 0) * 1000);
    if (ms <= 0) return;
    const key = w.trackId + '_' + w.carId;
    if (!S.qualiRef[key] || ms < S.qualiRef[key]) { S.qualiRef[key] = ms; _save(); }
  }

  /* Startet das Karriere-Rennen des aktuellen Events. Quali wird (sofern nicht
     selbst gefahren) simuliert; daraus Startplatz + KI-Stärke. */
  function startEventRace() {
    const ev = eventInfo();
    if (!ev || typeof Game === 'undefined') return;
    const pool = Game.getTrackPool();
    const tIdx = pool.findIndex(t => t && t.id === ev.trackId);
    const cIdx = (typeof CARS !== 'undefined') ? CARS.findIndex(c => c.id === ev.carId) : -1;
    if (tIdx < 0 || cIdx < 0) { alert('Strecke oder Fahrzeug für dieses Event nicht verfügbar.'); return; }

    const pMs = simPlayerQuali(ev.stageKey, ev.trackId, ev.carId, ev.round, ev.calN);
    const fld = qualiField(ev.stageKey, ev.trackId, ev.round, ev.calN, pMs);

    Game._careerRace = {
      stageKey: ev.stageKey, round: ev.round, trackId: ev.trackId, carId: ev.carId,
      pMs, pPos: fld.pPos, poleMs: fld.poleMs, field: fld.grid.map(e => e.ms),
      rivals: ev.ladder.rivals
    };
    if (fld.pPos === 1) { S.stats.poles = (S.stats.poles || 0) + 1; }

    Game.selTrack = tIdx;
    Game.selCar = cIdx;
    Game.selLivery = 0;
    Game.mode = 'race3';
    Game.numAI = ev.ladder.rivals;
    Game.raceLaps = ev.ladder.laps;
    Game.aiDifficulty = ev.ladder.diff;
    Game.championshipEnabled = false;
    Game.rollingStart = false;
    hide();
    try { Game.startRace(); } catch (e) { console.error('[Career] Renn-Start:', e); }
  }

  /* Vom Spiel aufgerufen bei Rennende (Hook). result = {pos,total,...} */
  function _onRaceFinish(result) {
    const cr = (typeof Game !== 'undefined') && Game._careerRace;
    if (!cr) return;
    Game._careerRace = null;
    if (!S.season) ensureSeason();
    const s = S.season;
    if (cr.stageKey !== S.stageKey || cr.round !== s.round) return;   // veraltet

    const total = Math.max(1, result.total || (cr.rivals + 1));
    const pos = Math.max(1, Math.min(total, result.pos || total));
    const L = LADDER[S.stageKey];

    // Punkte: Rennen + Qualifying (halbe Wertung -> Aufstieg hängt stark an der Pace)
    const pts = RACE_POINTS[pos - 1] || 0;
    const qPts = Math.round((RACE_POINTS[(cr.pPos || total) - 1] || 0) * 0.5);
    s.points += pts + qPts;
    s.standings.ME = (s.standings.ME || 0) + pts + qPts;

    // Rivalen-Punkte simulieren: aus ihrer Zielpace + Varianz eine Reihenfolge
    _simRivalRace(s, cr, pos, total);

    // Fastest Lap?
    let fastest = false;
    try {
      const fl = Game._raceFastestLap;
      if (fl && (!fl.driverName || /DU|ME|SPIELER/i.test(fl.driverName))) fastest = true;
    } catch (e) {}

    // Credits
    const posFactor = 1 - 0.60 * ((pos - 1) / Math.max(1, total - 1));   // P1=1.0 … letzter≈0.40
    let credits = Math.round(CREDIT_BASE[S.stageKey] * posFactor);
    if (fastest) credits = Math.round(credits * 1.08);
    if (pos <= 3) credits += Math.round(CREDIT_BASE[S.stageKey] * 0.30);   // Podium-Bonus
    S.credits += credits;

    // Stats
    S.stats.races = (S.stats.races || 0) + 1;
    if (pos === 1) S.stats.wins = (S.stats.wins || 0) + 1;
    if (pos <= 3) S.stats.podiums = (S.stats.podiums || 0) + 1;

    s.results.push({
      trackId: cr.trackId, carId: cr.carId,
      quali: { pMs: cr.pMs, pPos: cr.pPos, poleMs: cr.poleMs },
      race: { pos, total, pts, credits, fastest }
    });
    s.round++;

    let seasonDone = s.round >= s.calendar.length;
    let promo = null;
    if (seasonDone) promo = _finishSeason();

    _save();
    _flashResult(pos, total, pts + qPts, credits, fastest, promo);
    // Nach dem Ergebnisscreen zurück in die Karriere statt ins Hauptmenü
    _routeResultsToCareer();
  }

  /* Ergebnisscreen: der "Hauptmenü"-Knopf führt einmalig zurück in die Karriere
     statt ins Startmenü. "Nochmal fahren" bleibt unverändert. */
  function _routeResultsToCareer() {
    const btn = document.getElementById('btn-res-menu');
    if (!btn) { setTimeout(show, 500); return; }
    const orig = btn.onclick;
    btn.onclick = () => {
      btn.onclick = orig;
      const res = document.getElementById('results'); if (res) res.classList.add('hidden');
      show();
    };
  }

  function _simRivalRace(s, cr, playerPos, total) {
    // Erzeuge für die Rivalen (nummeriert R1..Rn) eine plausible Zielreihenfolge
    // aus ihrer Quali-Pace + Rennvarianz, überspringe die Position des Spielers.
    const rnd = _seedRand(s.stageKey + '|' + cr.trackId + '|' + s.round + '|race');
    const field = (cr.field || []).slice().sort((a, b) => a - b);
    const order = [];
    let ri = 0;
    for (let p = 1; p <= total; p++) {
      if (p === playerPos) { order.push('ME'); continue; }
      order.push('R' + (ri++));
    }
    // Punkte für die simulierten Rivalen: Renn- + halbe Quali-Wertung
    order.forEach((id, i) => {
      if (id === 'ME') return;
      const jitter = (rnd() - 0.5) * 2.4;      // Renn-Upsets: Titelkampf bleibt offen
      const effPos = Math.max(1, Math.round(i + 1 + jitter));
      const rp = RACE_POINTS[Math.min(RACE_POINTS.length, effPos) - 1] || 0;
      // Quali-Grid der Rivalen ~ ihre Feldposition (i), leicht variiert
      const gPos = Math.max(1, Math.round(i + 1 + (rnd() - 0.5) * 1.2));
      const qp = Math.round((RACE_POINTS[Math.min(RACE_POINTS.length, gPos) - 1] || 0) * 0.5);
      s.standings[id] = (s.standings[id] || 0) + rp + qp;
    });
  }

  function _standingsSorted() {
    const s = S.season;
    const arr = Object.keys(s.standings).map(id => ({ id, pts: s.standings[id] }));
    arr.sort((a, b) => b.pts - a.pts || (a.id === 'ME' ? -1 : 1));
    return arr;
  }

  function _atTopContract(stageKey) {
    const ck = contractKeyFor(stageKey);
    if (!ck) return true;                       // feste Stufe -> kein Vertrag nötig
    return (S.contracts[ck] || 0) >= CONTRACTS[ck].length - 1;
  }

  function _advanceStage() {
    const cur = S.stageKey;
    if (cur === 'f4' && !S.path) { S._awaitPath = true; return; }
    const nxt = nextStageKey(cur);
    if (nxt) { S.stageKey = nxt; S.season = null; S._advanceReady = false; ensureSeason(); }
    else { S._careerComplete = true; }
  }

  function _finishSeason() {
    const s = S.season;
    const sorted = _standingsSorted();
    const champPos = sorted.findIndex(e => e.id === 'ME') + 1 || sorted.length;
    const L = LADDER[S.stageKey];
    const promoted = champPos <= L.cutoff;

    // Saison-Abschluss-Bonus
    let bonus = SEASON_BONUS[S.stageKey] || 0;
    if (promoted) bonus = Math.round(bonus * 1.6);
    if (champPos === 1) bonus = Math.round(bonus * 1.25);
    S.credits += bonus;
    S.stats.seasons = (S.stats.seasons || 0) + 1;
    S.stageSeasons = S.stageSeasons || {};
    S.stageSeasons[S.stageKey] = (S.stageSeasons[S.stageKey] || 0) + 1;

    const atTop = _atTopContract(S.stageKey);
    const rec = { stageKey: S.stageKey, champPos, promoted, atTop, at: Date.now(), bonus };

    if (promoted) {
      S.completed.push(rec);
      if (atTop) {
        // Klasse gemeistert (bzw. feste Stufe) -> aufsteigen
        _advanceStage();
      } else {
        // Vertragsklasse: erst den Contract bis zum Topfahrzeug ausbauen.
        // Aufstieg trotzdem manuell möglich (Career.advanceNow / UI-Button).
        S._advanceReady = true;
        S.season = null;
        ensureSeason();
      }
    } else {
      // Saison wiederholen (Credits/Contracts bleiben)
      S.season = null;
      ensureSeason();
    }
    return rec;
  }

  function choosePath(p) {
    if (!PATHS[p]) return;
    S.path = p;
    S._awaitPath = false;
    S.stageKey = PATHS[p][0];
    S.season = null;
    ensureSeason();
    _save();
    render();
  }

  function buyContract() {
    const ck = contractKeyFor(S.stageKey);
    if (!ck) return;
    const nc = nextContract(S.stageKey);
    if (!nc) return;
    if (S.credits < nc.cost) { alert('Nicht genug Credits.'); return; }
    S.credits -= nc.cost;
    S.contracts[ck] = nc.index;
    _save();
    render();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     UI
     ══════════════════════════════════════════════════════════════════════════ */
  const CSS = `
  #screen-career{gap:0;align-items:stretch;justify-content:flex-start;padding:0;overflow-y:auto}
  #cr-panel{background:#0d1116;width:100%;max-width:900px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;font:13px var(--mono,monospace)}
  #cr-head{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 14px;border-bottom:1px solid #1e252e}
  #cr-head h2{font:700 22px 'Rajdhani',sans-serif;letter-spacing:.15em;color:#e8ecef;margin:0}
  .cr-credits{font:800 15px var(--mono,monospace);color:#ffd400}
  #cr-body{padding:18px 24px 40px;display:flex;flex-direction:column;gap:18px}
  .cr-rail{display:flex;gap:6px;flex-wrap:wrap}
  .cr-rung{flex:1;min-width:96px;border:1px solid #23303c;border-radius:8px;padding:9px 8px;text-align:center;background:#0a1420;position:relative}
  .cr-rung.done{border-color:#2c6b45}
  .cr-rung.cur{border-color:#ffd400;box-shadow:0 0 0 1px #ffd40055 inset}
  .cr-rung.lock{opacity:.4}
  .cr-rung .rn{font:700 9px var(--mono,monospace);letter-spacing:.12em;color:#8b95a1}
  .cr-rung .rl{font:700 12px var(--mono,monospace);color:#e8ecef;margin-top:3px}
  .cr-rung .rc{font-size:9px;color:#4b5563;margin-top:2px}
  .cr-box{border:1px solid #1e252e;border-radius:10px;padding:16px;background:#0b0f14}
  .cr-box h3{margin:0 0 10px;font:700 11px var(--mono,monospace);letter-spacing:.16em;color:#ff2e3d}
  .cr-cal{display:flex;flex-direction:column;gap:4px}
  .cr-ev{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;font-size:12px}
  .cr-ev.next{background:#12243d;border:1px solid #3b82f6}
  .cr-ev.done{color:#6b7480}
  .cr-ev .evn{flex:1;color:#c9d1d9}
  .cr-ev .evr{font-size:10px;color:#8b95a1}
  .cr-stand{display:flex;flex-direction:column;gap:2px;font-size:12px}
  .cr-stand .row{display:flex;gap:10px;padding:3px 6px;border-radius:4px}
  .cr-stand .row.me{background:#120a0c;color:#ff8a94;font-weight:700}
  .cr-stand .p{width:26px;color:#8b95a1}
  .cr-stand .n{flex:1}
  .cr-actions{display:flex;gap:10px;flex-wrap:wrap}
  .cr-btn{padding:11px 20px;border-radius:8px;border:1px solid #2a3a4a;background:#141c26;color:#e8ecef;font:700 11px var(--mono,monospace);letter-spacing:.1em;cursor:pointer}
  .cr-btn.primary{background:var(--red,#ff2e3d);border-color:var(--red,#ff2e3d);color:#fff}
  .cr-btn:disabled{opacity:.45;cursor:default}
  .cr-garage{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .cr-garage .cur{font:700 13px var(--mono,monospace);color:#e8ecef}
  .cr-garage .nxt{font-size:11px;color:#8b95a1}
  #cr-pathmodal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.9);display:none;align-items:center;justify-content:center}
  #cr-pathmodal .m{background:#0d1a2a;border:1px solid #ff2e3d;border-radius:12px;padding:28px;width:520px;max-width:92vw;text-align:center}
  #cr-toast{position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:9998;background:#0d1a2a;border:1px solid #ffd400;border-radius:10px;padding:14px 26px;font:700 12px var(--mono,monospace);color:#ffe9a8;display:none;text-align:center}
  `;

  function _inject() {
    if (document.getElementById('screen-career')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

    const sec = document.createElement('section');
    sec.className = 'screen hidden';
    sec.id = 'screen-career';
    sec.innerHTML = `
      <div id="cr-panel">
        <div id="cr-head">
          <h2>🏁 KARRIERE</h2>
          <div style="display:flex;align-items:center;gap:14px">
            <span class="cr-credits" id="cr-credits">0 CR</span>
            <button class="cr-btn" id="cr-reset" style="border-color:#3a2a2e;color:#8b6a70">RESET</button>
            <button class="cr-btn" id="cr-back">← MENÜ</button>
          </div>
        </div>
        <div id="cr-body"></div>
      </div>`;
    const menus = document.getElementById('menus') || document.body;
    menus.appendChild(sec);

    const pm = document.createElement('div');
    pm.id = 'cr-pathmodal';
    pm.innerHTML = `<div class="m">
      <div style="font:700 12px var(--mono,monospace);letter-spacing:.2em;color:#ff2e3d;margin-bottom:8px">FORMEL 4 ABGESCHLOSSEN</div>
      <div style="color:#c9d1d9;font-size:13px;margin-bottom:18px">Wähle deinen Weg. Diese Entscheidung ist endgültig für diese Karriere.</div>
      <div style="display:flex;gap:12px">
        <button class="cr-btn primary" id="cr-path-f" style="flex:1">FORMEL-WEG<br><span style="font-weight:400;font-size:9px;opacity:.8">F3 → F2 → F1</span></button>
        <button class="cr-btn primary" id="cr-path-e" style="flex:1;background:#1f6feb;border-color:#1f6feb">LANGSTRECKE<br><span style="font-weight:400;font-size:9px;opacity:.8">GT3 → LMP2 → Hypercar</span></button>
      </div></div>`;
    document.body.appendChild(pm);
    document.getElementById('cr-path-f').onclick = () => { pm.style.display = 'none'; choosePath('formula'); };
    document.getElementById('cr-path-e').onclick = () => { pm.style.display = 'none'; choosePath('endurance'); };

    const toast = document.createElement('div'); toast.id = 'cr-toast'; document.body.appendChild(toast);

    document.getElementById('cr-back').onclick = () => { if (typeof Game !== 'undefined') Game.showScreen('screen-start'); };
    const rs = document.getElementById('cr-reset');
    if (rs) rs.onclick = () => {
      if (confirm('Karriere komplett zurücksetzen? Fortschritt, Credits und Verträge gehen verloren.')) {
        S = _defaultState(); _save(); render();
      }
    };
  }

  function show() {
    _inject();
    if (!S) { S = _load() || _defaultState(); }
    ensureSeason();
    // Beim Betreten des Karriere-Menüs: keine hängenden Renn-/Quali-Kontexte
    if (typeof Game !== 'undefined') { Game._careerRace = null; Game._careerQualiWatch = null; }
    if (typeof Game !== 'undefined') Game.showScreen('screen-career');
    render();
    if (!_fsSynced) _pullFirestore();
  }
  function hide() { const s = document.getElementById('screen-career'); if (s) s.classList.add('hidden'); }

  function _flashResult(pos, total, pts, credits, fastest, promo) {
    const t = document.getElementById('cr-toast'); if (!t) return;
    let msg = `P${pos} / ${total}  ·  +${pts} Punkte  ·  +${credits.toLocaleString('de-DE')} CR`;
    if (fastest) msg += '  ·  ⚡ schnellste Runde';
    if (promo) msg += promo.promoted
      ? `\n🎉 AUFSTIEG! Meisterschaft P${promo.champPos} · Bonus +${promo.bonus.toLocaleString('de-DE')} CR`
      : `\nSaison beendet — Meisterschaft P${promo.champPos}. Aufstieg verpasst (Top ${LADDER[promo.stageKey].cutoff}). Neue Saison.`;
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(_flashResult._t);
    _flashResult._t = setTimeout(() => { t.style.display = 'none'; }, promo ? 8000 : 4500);
  }

  function render() {
    const body = document.getElementById('cr-body');
    if (!body || !S) return;
    document.getElementById('cr-credits').textContent = (S.credits || 0).toLocaleString('de-DE') + ' CR';

    // Pfadwahl fällig?
    if (S._awaitPath) {
      const pm = document.getElementById('cr-pathmodal');
      if (pm) pm.style.display = 'flex';
    }

    const ev = eventInfo();
    const L = LADDER[S.stageKey];
    const ladderKeys = fullLadderForDisplay();
    const curIdx = stageIndex(S.stageKey);

    // Leiter
    const rail = ladderKeys.map((k, i) => {
      const cls = i < curIdx ? 'done' : (k === S.stageKey ? 'cur' : 'lock');
      return `<div class="cr-rung ${cls}">
        <div class="rn">${i < curIdx ? '✔' : (i === curIdx ? 'AKTUELL' : '🔒')}</div>
        <div class="rl">${LADDER[k].label}</div>
        <div class="rc">${LADDER[k].car === 'contract' ? 'Vertrag' : ''}</div>
      </div>`;
    }).join('');

    // Kalender + Standings
    const s = S.season;
    const cal = s.calendar.map((tid, i) => {
      const st = i < s.round ? 'done' : (i === s.round ? 'next' : '');
      const r = s.results[i];
      const tail = r ? `P${r.race.pos} · +${r.race.pts}` : `Ref ${_fmt(refLap(tid, S.stageKey) * 1000)}`;
      return `<div class="cr-ev ${st}"><span class="p">${i + 1}</span><span class="evn">${_trackName(tid)}</span><span class="evr">${tail}</span></div>`;
    }).join('');

    const stand = _standingsSorted().slice(0, 12).map((e, i) => {
      const nm = e.id === 'ME' ? (typeof fbUsername !== 'undefined' && fbUsername ? fbUsername : 'DU') : ('Rival ' + e.id.slice(1));
      return `<div class="row ${e.id === 'ME' ? 'me' : ''}"><span class="p">P${i + 1}</span><span class="n">${nm}</span><span>${e.pts}</span></div>`;
    }).join('');

    // Garage
    const carId = currentCarId(S.stageKey);
    const carName = (typeof CARS !== 'undefined' && CARS.find(c => c.id === carId)) ? CARS.find(c => c.id === carId).name : carId;
    const nc = nextContract(S.stageKey);
    const ck = contractKeyFor(S.stageKey);
    const cIdx = ck ? (S.contracts[ck] || 0) : 0;
    const cTot = ck ? CONTRACTS[ck].length : 1;
    const garage = ck ? `
      <div class="cr-garage">
        <div><div class="cur">🔧 ${carName} <span style="color:#8b95a1;font-weight:400">· Vertragsstufe ${cIdx + 1}/${cTot}</span></div>
          <div class="nxt">${nc ? `Nächster Vertrag: ${nc.name} — ${nc.cost.toLocaleString('de-DE')} CR` : 'Top-Vertrag dieser Klasse erreicht — Aufstieg frei.'}</div>
        </div>
        ${nc ? `<button class="cr-btn" id="cr-buy" ${S.credits < nc.cost ? 'disabled' : ''}>VERTRAG ABSCHLIESSEN</button>` : ''}
      </div>
      ${S._advanceReady ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #1e252e;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="font-size:11px;color:#8b95a1">Meisterschaft erfüllt. Baue den Vertrag bis zum Topfahrzeug aus <b>oder</b> steig jetzt in die nächste Klasse auf.</div>
        <button class="cr-btn primary" id="cr-advance">IN DIE NÄCHSTE KLASSE ›</button>
      </div>` : ''}`
      : `<div class="cr-garage"><div class="cur">🔧 ${carName}</div><div class="nxt">Feste Stufe — kein Vertragswechsel.</div></div>`;

    const eventBlock = ev ? `
      <div class="cr-box">
        <h3>NÄCHSTES EVENT — RUNDE ${ev.round + 1} / ${ev.calN}</h3>
        <div style="font:700 15px var(--mono,monospace);color:#e8ecef">${ev.trackName}</div>
        <div style="color:#8b95a1;font-size:11px;margin:4px 0 12px">
          ${carName} · ${L.laps} Runden · ${L.rivals} Gegner ·
          Ziel-Referenz ${_fmt(refLap(ev.trackId, S.stageKey) * 1000)}
          ${S.qualiRef[ev.trackId + '_' + carId] ? ` · deine Quali-Bestzeit ${_fmt(S.qualiRef[ev.trackId + '_' + carId])}` : ' · Quali wird simuliert'}
        </div>
        <div class="cr-actions">
          <button class="cr-btn primary" id="cr-race">RENNEN STARTEN</button>
          <button class="cr-btn" id="cr-driveq">QUALI SELBST FAHREN (3 Versuche)</button>
        </div>
      </div>` : `
      <div class="cr-box"><h3>SAISON</h3>
        <div style="color:#c9d1d9">Saison abgeschlossen. ${S._careerComplete ? 'Karriere komplett — alle Stufen geschafft. 🏆' : 'Es geht in die nächste Saison.'}</div>
      </div>`;

    body.innerHTML = `
      <div class="cr-box"><h3>AUFSTIEGSLEITER${S.path ? ' — ' + (S.path === 'formula' ? 'FORMEL' : 'LANGSTRECKE') : ''}</h3>
        <div class="cr-rail">${rail}</div>
      </div>
      ${eventBlock}
      <div style="display:flex;gap:18px;flex-wrap:wrap">
        <div class="cr-box" style="flex:1;min-width:280px"><h3>RENNKALENDER</h3><div class="cr-cal">${cal}</div></div>
        <div class="cr-box" style="flex:1;min-width:240px"><h3>MEISTERSCHAFT</h3><div class="cr-stand">${stand}</div></div>
      </div>
      <div class="cr-box"><h3>VERTRAG / FAHRZEUG</h3>${garage}</div>
      <div class="cr-box"><h3>STATISTIK</h3>
        <div style="color:#8b95a1;font-size:12px">
          ${S.stats.races || 0} Rennen · ${S.stats.wins || 0} Siege · ${S.stats.podiums || 0} Podien ·
          ${S.stats.poles || 0} Poles · ${S.stats.seasons || 0} Saisons · ${(S.completed || []).length} Stufen
        </div>
      </div>`;

    const rb = document.getElementById('cr-race'); if (rb) rb.onclick = startEventRace;
    const dq = document.getElementById('cr-driveq'); if (dq) dq.onclick = driveQuali;
    const bb = document.getElementById('cr-buy'); if (bb) bb.onclick = buyContract;
    const ab = document.getElementById('cr-advance'); if (ab) ab.onclick = () => Career.advanceNow();
  }

  function _fmt(ms) {
    if (!ms || ms <= 0) return '--:--.---';
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), t = Math.round(ms % 1000);
    return `${m}:${String(s).padStart(2, '0')}.${String(t).padStart(3, '0')}`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     HOOKS ins Spiel
     ══════════════════════════════════════════════════════════════════════════ */
  function _wrapHooks() {
    // Rundenabschluss (Zeitfahren-Quali)
    const prevLap = window.onGameLapComplete;
    window.onGameLapComplete = function (info) {
      try { if (typeof prevLap === 'function') prevLap(info); } catch (e) {}
      try { _onTTLap(info); } catch (e) { console.warn('[Career] onLap:', e); }
    };
    // Rennende
    const prevFin = window.onGameRaceFinish;
    window.onGameRaceFinish = function (info) {
      try { if (typeof prevFin === 'function') prevFin(info); } catch (e) {}
      try { _onRaceFinish(info || {}); } catch (e) { console.warn('[Career] onFinish:', e); }
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════════════ */
  function _wireMenuButton() {
    const b = document.getElementById('btn-career');
    if (b && !b._wired) {
      b._wired = true;
      b.onclick = () => Career.open();
    }
  }

  const Career = {
    open() { S = _load() || S || _defaultState(); show(); },
    get state() { return S; },
    reset() { S = _defaultState(); _save(); render(); },
    advanceNow() {
      if (!S || !S._advanceReady) return;
      if (!confirm('In die nächste Klasse aufsteigen? Der aktuelle Vertragsstand bleibt hier zurück (bei Rückkehr wieder verfügbar).')) return;
      _advanceStage();
      _save();
      render();
    },
    _debug: { LADDER, CONTRACTS, buildCalendar, qualiField, S: () => S }
  };
  window.Career = Career;

  function boot() {
    S = _load() || _defaultState();
    _inject();
    _wrapHooks();
    _wireMenuButton();
    // Firestore-Sync sobald Login steht
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (typeof fbUser !== 'undefined' && fbUser) { clearInterval(iv); _pullFirestore(); }
      else if (tries > 40) clearInterval(iv);
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
