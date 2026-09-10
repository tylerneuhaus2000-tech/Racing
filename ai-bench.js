/* ============================================================================
   KI-PRÜFSTAND für Grid Line
   ----------------------------------------------------------------------------
   Lässt die KI ohne Rendering fahren: driver.control() + car.step() in einer
   Schleife. Dadurch läuft eine komplette Renndistanz in Sekundenbruchteilen
   (gemessen: 900 s Simulation in 0,5 s realer Zeit, also rund 1800-fach).

   Damit lässt sich prüfen, ob die KI auf JEDER Strecke und in JEDEM Fahrzeug
   funktioniert, ohne jede Kombination von Hand abfahren zu müssen.

   VERWENDUNG
   ----------
   1. Spiel öffnen und ein Rennen starten (die Strecke muss geladen sein).
   2. Diese Datei in die Browser-Konsole einfügen.
   3. Aufrufen:

        AIBench.einzeln()            // aktuelles Auto, aktuelle Strecke
        AIBench.staerkeReihe()       // Stärke 40..100 im Vergleich
        AIBench.alleFahrzeuge()      // je ein Auto pro Klasse
        AIBench.tabelle(ergebnisse)  // Ausgabe als Konsolentabelle

   WORAUF ZU ACHTEN IST
   --------------------
   runden          leer  → die KI beendet die Runde nicht (schwerer Fehler)
   grasProz        > 5   → die KI fährt zu weit raus
   steckenGeblieben> 0   → die KI hängt fest und muss sich befreien
   laengsteBlockade> 10  → sie kommt nicht mehr frei (schwerer Fehler)

   REPRODUZIERBARER CLI-TEST
   ------------------------
   Siehe tools/ai-drive-audit.cjs und docs/ai-driving.md.
   Er nutzt dieselbe Fahrzeugphysik und prüft auch Rennen mit mehreren Autos.

   MESSFALLEN (beide haben mich Stunden gekostet)
   ----------------------------------------------
   · Das Wetter wird pro Rennen ausgewürfelt. Im Regen ist die KI 35% langsamer
     und fährt fast kein Gras. Der Prüfstand nagelt es deshalb auf trocken fest.
   · Ein Kreisbahntest mit EINEM festen Lenkeinschlag misst nicht die Grenze,
     sondern nur diesen Einschlag. grenzGrip() sucht deshalb über mehrere.
   ============================================================================ */

(function () {
  'use strict';

  function lauf(opts) {
    const {
      carDef,
      track = Game.track,
      difficulty = 92,
      preset = AI_PERSONALITY_PRESETS[3],
      laps = 3,
      maxSeconds = 900,
    } = opts;

    /* Die KI drosselt sich in den ersten 15 Rennsekunden absichtlich
       (_effALat *= 0.5 + …). Ohne laufende Spieluhr bliebe sie dauerhaft
       gedrosselt und alle Messwerte wären zu pessimistisch. */
    const raceTimeBackup = Game._raceTimeS;
    Game._raceTimeS = 999;

    /* WICHTIG: Wetter festnageln. Game.weather wird pro Rennen ausgewürfelt.
       Bei Regen fährt die KI 35% langsamer und praktisch ohne Gras-Anteil —
       ein Vergleich Regen gegen Trocken ist wertlos. Ohne diese Zeile misst
       man je nach Zufall völlig verschiedene Dinge. */
    const weatherBackup = Game.weather;
    Game.weather = Object.assign({ mode: 'fixed', preset: 'dry', lineDry: 1 }, WEATHER_PRESETS.dry);

    let car;
    try {
    car = new Car(carDef, Game.scene, Game.envMap);
    car.rd = Game.freshRD();
    const drv = new AIDriver(difficulty, 0, 1, preset);
    drv.setupForRace(laps, 0);
    car.placeAtGrid(track, 0, 0);
    if (car.group) car.group.visible = false;

    const N = track.N;
    const steps = Math.floor(maxSeconds / PHYS_DT);
    let t = 0, prevIdx = 0, lapStart = 0, progress = 0;
    const lapTimes = [];
    let gras = 0, kerb = 0, n = 0;
    let stuckT = 0, stuckEvents = 0, longestStuck = 0, everMoved = false;
    let maxKmh = 0, ayMax = 0;

    for (let s = 0; s < steps; s++) {
      Game._raceTimeS = 999;
      const inp = drv.control(car, track, PHYS_DT, true, [car], { lap: car.rd.lap });
      car.step(PHYS_DT, inp, track, null);
      t += PHYS_DT; n++;

      if (car.surf === SURF.GRASS) gras++;
      else if (car.surf === SURF.KERB) kerb++;

      const kmh = car.speedKmh || 0;
      maxKmh = Math.max(maxKmh, kmh);
      ayMax = Math.max(ayMax, Math.abs(car.lastAy || 0));
      if (kmh > 40) everMoved = true;
      if (everMoved) {
        if (kmh < 20) { stuckT += PHYS_DT; longestStuck = Math.max(longestStuck, stuckT); }
        else { if (stuckT > 3) stuckEvents++; stuckT = 0; }
      }

      const idx = car.sampleIdx;
      progress += ((idx - prevIdx + N * 1.5) % N) - N * 0.5;
      if (progress >= (lapTimes.length + 1) * N) {
        lapTimes.push(+(t - lapStart).toFixed(2));
        lapStart = t;
        car.rd.lap++;
        if (lapTimes.length >= laps) break;
      }
      prevIdx = idx;
    }



    return {
      auto: carDef.name,
      klasse: carDef.classType,
      staerke: difficulty,
      runden: lapTimes,
      beste: lapTimes.length ? Math.min(...lapTimes) : null,
      grasProz: +(100 * gras / n).toFixed(1),
      kerbProz: +(100 * kerb / n).toFixed(1),
      steckenGeblieben: stuckEvents,
      laengsteBlockade: +longestStuck.toFixed(1),
      maxKmh: Math.round(maxKmh),
      ayMax: +ayMax.toFixed(1),
      simZeit: +t.toFixed(0),
    };
    } finally {
      if (car?.group) Game.scene.remove(car.group);
      Game._raceTimeS = raceTimeBackup;
      Game.weather = weatherBackup;
    }
  }

  /** Höchste erreichbare Querbeschleunigung eines Fahrzeugs.
      Sucht über MEHRERE Lenkeinschläge — mit einem festen Winkel misst man
      nicht die Grenze, sondern nur diesen Winkel (ergab fälschlich 0.71 g
      statt der tatsächlichen 1.19–1.39 g). */
  function grenzGrip(carDef, track = Game.track, tempo = 45) {
    let ayPeak = 0;
    for (const steer of [0.25, 0.45, 0.7, 1.0]) {
      const c = new Car(carDef, Game.scene, Game.envMap);
      c.rd = Game.freshRD();
      c.placeAtGrid(track, Math.floor(track.N * 0.5), 0);
      if (c.group) c.group.visible = false;
      c.vx = tempo;
      for (let i = 0; i < 300; i++) {
        const th = c.vx < tempo ? 0.9 : 0.2;
        c.step(PHYS_DT, { steer, throttle: th, brake: 0 }, track, null);
        ayPeak = Math.max(ayPeak, Math.abs(c.lastAy || 0));
      }
      if (c.group) Game.scene.remove(c.group);
    }
    return {
      auto: carDef.name, klasse: carDef.classType,
      tempo_kmh: Math.round(tempo * 3.6),
      ay: +ayPeak.toFixed(1), g: +(ayPeak / 9.81).toFixed(2),
    };
  }

  window.AIBench = {
    lauf,
    grenzGrip,

    einzeln(carDef = Game.car.def, difficulty = 92) {
      return lauf({ carDef, difficulty, laps: 3 });
    },

    staerkeReihe(carDef = Game.car.def, stufen = [40, 60, 80, 92, 100]) {
      return stufen.map(d => lauf({ carDef, difficulty: d, laps: 2, maxSeconds: 800 }));
    },

    alleFahrzeuge(difficulty = 92) {
      const proben = {};
      CARS.forEach(c => { if (!proben[c.classType]) proben[c.classType] = c; });
      return Object.values(proben).map(def => lauf({ carDef: def, difficulty, laps: 2, maxSeconds: 800 }));
    },

    /** Jede Strecke mit demselben Auto — findet Strecken, auf denen die KI scheitert. */
    alleStrecken(carDef = Game.car.def, difficulty = 92) {
      return TRACKS.filter(Boolean).map(def => {
        const track = Object.create(Track.prototype);
        track.def = JSON.parse(JSON.stringify(def));
        track.halfW = def.halfWidth;
        track.kerbW = def.kerbW || 1.4;
        track.wallDist = def.wallDist || (def.halfWidth + 13);
        track.buildSpline();
        new AIDriver(difficulty, 0, 1)._buildCache(track);
        const compatibleCar = def.kartOnly
          ? CARS.find(c => c.classType === 'kart')
          : carDef.classType === 'kart' ? CARS.find(c => c.classType === 'gt3') : carDef;
        return { strecke: def.name, ...lauf({carDef:compatibleCar, track, difficulty, laps:3, maxSeconds:1200}) };
      });
    },

    tabelle(rows) { console.table(rows); return rows; },
  };

  console.log('AIBench bereit. Start: AIBench.tabelle(AIBench.staerkeReihe())');
})();
