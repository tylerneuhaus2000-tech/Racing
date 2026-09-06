# Karrieremodus — Design, Balancing & Änderungsprotokoll

Stand: 2026-09-07. Modul: `assets/gt3-career.js` (`window.Career`).

---

## 1. Was wurde hinzugefügt

### Karrieremodus (`assets/gt3-career.js`, ~900 Zeilen, eigenständiges IIFE)
- **Aufstiegsleiter** `kart_bumper → kart → f4 → PFADWAHL`
  - Formel: `f3 → f2 → f1`
  - Langstrecke: `gt3 → lmp2 → hyp`
- **Speicherstand**: primär `localStorage['gl_career_v2']`, gespiegelt nach Firestore
  `careers/{uid}` (neuere `updatedAt`-Version gewinnt beim Login).
- **Saison** = Kalender aus bereits im Spiel funktionierenden Strecken
  (4–10 Events je Klasse). Wiederholte Saisons rotieren den Kalender.
- **Qualifying**: standardmäßig **simuliert** aus der Pace-Historie (deterministisch,
  testbar). Button „Quali selbst fahren" öffnet ein normales Zeitfahren; die neue
  Bestzeit wird als `qualiRef[track_car]` übernommen und danach als Quali-Zeit
  benutzt. 3 Versuche = die Runden dieser Zeitfahr-Session.
- **Aufstieg = Rundenzeiten, nicht Platzierungen**: die Saison-Meisterschaft
  speist sich aus Renn-Punkten (F1-System 25-18-15-12-10-8-6-4-2-1) **plus halber
  Quali-Wertung**. Aufstieg, wenn Meisterschafts-Platz ≤ `cutoff` der Stufe.
  Sonst: Saison wiederholen (Credits/Verträge bleiben).
- **Vertrags-/Upgrade-System** (Klassen mit mehreren Autos: gt3, lmp2, hyp, f1):
  Start mit Basisvertrag (GT3 = Dacia), Aufstieg über Credit-Käufe bis zum
  Topauto der Klasse. Der Wechsel in die **nächste Klasse** ist erst frei, wenn
  der Top-Vertrag erreicht ist — ODER man steigt per Knopf „In die nächste
  Klasse" vorzeitig auf (Vertragsstand bleibt in der Klasse zurück).
- **Credits**: pro Rennen (Position × Klasse + Podium-Bonus + Fastest-Lap +8 %),
  plus Saison-Abschluss-Bonus (×1,6 bei Aufstieg, zusätzlich ×1,25 bei Titel).
- **UI**: neuer Screen `#screen-career` (per JS injiziert), Menükarte „Karriere"
  auf dem Startbildschirm. Leiter-Rail, Event-Karte, Rennkalender, Meisterschafts-
  tabelle, Vertrags-Garage, Statistik. Ergebnis-Toast nach jedem Rennen. Der
  „Hauptmenü"-Knopf im Ergebnisscreen führt nach einem Karriere-Rennen einmalig
  zurück in die Karriere.

### Fahrzeug
- **Dacia · Ollis Garage Racing** als GT3-Einstiegsvertrag in `CARS`
  (`id:'dacia'`). Modell `assets/models/dacia_gt3.glb` (roh aus /downloads kopiert,
  ~22 MB, **nicht** meshopt-komprimiert). Physik bewusst am unteren GT3-Ende.
- `GAME_DATA_VERSION` 16 → 17 (CARS geändert → LocalStorage-Reset-Guard).

### Firestore
- Regel `match /careers/{uid}` (Lesen/Schreiben nur der Fahrer selbst).
  **Muss deployed werden:** `firebase deploy --only firestore:rules`.

---

## 2. Balancing — Credit- & Zeit-Rechnung

### Annahmen zum Spielverhalten
| Größe | Annahme |
|---|---|
| Sessions pro Woche | 4 |
| Rennen pro Session | ~3 |
| **Rennen pro Woche** | **~12** |
| Rennen pro Saison (Klasse) | 8 (GT3/LMP2/F3/F2), 10 (Hyp/F1), 4–6 (Kart/F4) |
| **Saisons pro Woche** | **~1,5** (bei 8er-Kalender) |

### Credit-Quellen (Modul-Konstanten)

`CREDIT_BASE` (Grundauszahlung P1, sinkt bis ~0,40× für Letzten; Podium +0,30×):

| Stufe | CREDIT_BASE | SEASON_BONUS |
|---|--:|--:|
| kart_bumper | 260 | 900 |
| kart | 320 | 1 200 |
| f4 | 620 | 2 600 |
| f3 | 1 100 | 5 200 |
| f2 | 1 700 | 8 200 |
| f1 | 3 200 | 16 000 |
| gt3 | 1 500 | 7 000 |
| lmp2 | 2 400 | 11 000 |
| hyp | 3 600 | 17 000 |

**Beispiel GT3, starker Fahrer (Ø ~P2):**
- Rennauszahlung/Rennen ≈ `1500 × 0,96` + Podium `1500 × 0,30` ≈ **1 890 CR**
- 8 Rennen ≈ 15 100 CR
- Saison-Bonus bei Aufstieg + Titel ≈ `7000 × 1,6 × 1,25` ≈ 14 000 CR
- **≈ 29 000 CR / Saison**

**Beispiel GT3, Ø-Fahrer (Ø ~P8/16):**
- Rennauszahlung ≈ `1500 × 0,72` + kein Podium ≈ 1 080 CR → 8 Rennen ≈ 8 600 CR
- Saison-Bonus ohne Aufstieg ≈ 7 000 CR
- **≈ 15 600 CR / Saison**

### Vertrags-Kosten (`CONTRACTS`)

| Klasse | Stufen (Kosten CR) | Summe bis Topauto |
|---|---|--:|
| **GT3** | Dacia 0 · BMW 12 000 · Audi 24 000 · AMG 42 000 · Porsche 66 000 · Lambo 96 000 · Ferrari 296 135 000 | **375 000** |
| **LMP2** | Oreca 0 · Alpine 70 000 | **70 000** |
| **Hypercar** | Porsche 963 0 · Cadillac 32 000 · Alpine A424 68 000 · Genesis 115 000 · Peugeot 175 000 · Toyota 250 000 · Ferrari 499P 340 000 | **980 000** |
| **F1** | Williams 0 · Aston 95 000 · Red Bull 230 000 · Ferrari 420 000 | **745 000** |

### Ergebnis: Zeit bis Topauto der Klasse

| Klasse | Kosten | CR/Saison (stark) | Saisons | Wochen (÷1,5) | **≈ Zeit** |
|---|--:|--:|--:|--:|---|
| GT3 | 375 000 | ~29 000 | ~13–14 | ~9 | **~2 Monate** |
| LMP2 | 70 000 | ~40 000 | ~2 | ~1,5 | ~2 Wochen |
| Hypercar | 980 000 | ~52 000 | ~13 (10er-Kalender ⇒ ~1,25 Saisons/Woche) | ~10–11 | **~2,5–3 Monate** |
| F1 | 745 000 | ~56 000 | ~10 | ~8 | **~2 Monate** |

Für einen **durchschnittlichen** Fahrer (weniger CR/Rennen, seltener Aufstieg)
verlängert sich das auf das ~1,7-fache → GT3 ≈ 3 Monate, obere Grenze der Vorgabe.

**Damit ist das Ziel „volle Vertrags-Progression einer Klasse ≈ 1–3 Monate
reale Nutzungszeit" erfüllt.** GT3 ≈ 2 Mon (stark) / ≈ 3 Mon (Ø). Hypercar ist
bewusst der längste Grind (Endgame). LMP2 ist kurz (nur 1 Upgrade) und dient als
Zwischenstufe.

### Headless-Simulation (docs: `scratchpad/career-sim.js`)
- **Starker Fahrer**: komplette Leiter kart_bumper→hyp in ~32 Saisons / ~273
  simulierten Rennen; alle GT3- und Hypercar-Verträge gekauft. Formel-Pfad
  analog in 16 Saisons / 141 Rennen.
- **Durchschnitt (immer Mittelfeld)**: kommt durch die Kart-Stufen, bleibt in
  F4 hängen (Pace-Gate) — braucht echtes Besserwerden. Sammelt derweil Credits.
- **Schwacher Fahrer**: bleibt in `kart_bumper`. Korrekt: Aufstieg ist an die
  Rundenzeit gekoppelt.
- 400+ simulierte Rennen ohne Crash; Pfadwahl, Vertragskauf, vorzeitiger
  Aufstieg, Saison-Wiederholung, Kalender-Rotation alle geprüft.

---

## 3. Referenz-Rundenzeiten (Kalibrier-Kandidaten)

`REF_LAP_GT3` im Modul enthält Grobwerte (Sekunden, GT3-Pace) je Strecke, an
realen Layouts orientiert, **nicht im Spiel gemessen**. `CLASS_PACE` skaliert je
Klasse. Diese Werte steuern nur die Quali-**Simulation** (Startplatz/Feld).
Die tatsächliche Renn-Pace bestimmt `LADDER[stage].diff` (KI-Stärke 0–100), die
grob je Klasse/Kalenderband gestuft ist (kart 46–55 → f1/hyp 88).

**Sauber kalibrieren** (später, im Browser):
1. Mit `ai-bench.js` (Browserkonsole) je Kalender-Strecke × Klasse eine
   KI-Rundenzeit bei der jeweiligen `diff` messen.
2. `REF_LAP_GT3` und ggf. `CLASS_PACE` auf die gemessenen Werte setzen.
3. `LADDER[*].diff` so justieren, dass ein Ø-Spieler ~Mittelfeld, ein guter
   Spieler ~Podium fährt.

---

## 4. Offen / unsicher

- **Dacia-Modell** `dacia_gt3.glb`: roh, unkomprimiert (~22 MB). Nicht visuell
  geprüft — Ausrichtung (`rotY`), Größe (`targetLength`), Materialien im Playtest
  kontrollieren. Später mit demselben Pipeline-Schritt wie die anderen Modelle
  komprimieren (WebP-Texturen → `gltfpack -cc`).
- **Quali „selbst fahren" → Rennen**: der Übergang läuft über das normale
  Zeitfahren + Rückkehr ins Karriere-Menü (kein nahtloser Handoff). Bewusst so,
  weil ein direkter TT→Rennen-Übergang nicht headless testbar war. Bitte einmal
  durchklicken: Karriere → „Quali selbst fahren" → Runde fahren → Zeitfahren
  verlassen → Karriere erneut öffnen → Quali-Bestzeit erscheint → „Rennen
  starten".
- **Grid-Position im echten Rennen**: das Spiel setzt den Spieler ans Ende seiner
  Klasse; der aus der Quali berechnete Startplatz beeinflusst aktuell nur die
  Meisterschaftspunkte (halbe Quali-Wertung), nicht die physische Startaufstellung.
  Für „echte" Startplätze müsste `startRace()`/`placeAtGrid` einen Career-Override
  bekommen — bewusst nicht gemacht (kann ich nicht fahrtesten).
- **Rivalen-Rennergebnis** ist simuliert (aus Feldpace + Varianz), nicht aus den
  echten KI-Autos gelesen. Die echten KI fahren real im Rennen; für die
  Meisterschaftstabelle zählt die Simulation. Konsistent, aber nicht „live".
- **Kalender**: nutzt nur bestehende Strecken. Die neuen Strecken-GLBs aus
  /downloads (Monza/Spa/Sachsenring/Red Bull Ring) sind NICHT integriert —
  das braucht Playtest auf Silverstone-Niveau (Racing-Line, Boxengasse,
  Start/Ziel, Kollisionsmesh) und ist separat.
- **Balancing-Feintuning** hängt an der Rundenzeit-Kalibrierung (Punkt 3). Bis
  dahin sind `diff`-Werte und `REF_LAP_GT3` als grobe Startpunkte markiert.

---

## 5. Was NICHT gemacht wurde (und warum)

- **Neue Strecken integrieren** (Monza/Spa/Sachsenring/Red Bull Ring GLBs):
  erfordert visuelles Playtesting (Fahren, Kollisionen, Boxengasse, Start/Ziel),
  das headless nicht möglich ist. Die vorhandenen 22 Strecken tragen den vollen
  Karrierekalender.
- **Andere neue Auto-GLBs** (Bentley/Mustang GT3 usw.): die Karriere-relevanten
  Autos (F4/F3/F2/F1, GT3×6, LMP2×2, Hypercar×7, beide Karts) waren bereits im
  Spiel. Nur der Dacia fehlte und wurde ergänzt.
