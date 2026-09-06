# Neue Strecken aus /downloads — Status & Integrationsplan

Stand: 2026-09-07. Analyse via `tools/glb-inspect.mjs`
(Vollreport: `docs/gt3-prep/downloads-glb-report-kurz.txt`).

## Kurzfassung

**Heute Nacht NICHT integriert** — die Strecken-GLBs sind rohe Sketchfab-Rips und
erfüllen den Silverstone-Qualitätsstandard nicht ohne mehrere Arbeitsschritte, die
Werkzeuge und Playtesting brauchen, die mir headless fehlen. Ehrliche Einschätzung
statt kaputter Strecken.

| Datei | Größe | Tris | Komprimiert | Problem |
|---|--:|--:|---|---|
| `silverstone_circuit_2024_layout.glb` | 116 MB | 1,20 M | nein | (Quelle der bereits fertigen `silverstone_gp.glb` 15 MB) |
| `autodromo_nazionale_monza_circuit_2020_layout.glb` | 103 MB | 1,19 M | nein | roh, unbenannte Meshes (`Object_N`), Z-up |
| `redbull_ring_2025_layout.glb` | 57 MB | 0,69 M | nein | dito — **kleinster Kandidat für Pilot** |
| `sachsenring_2020_layout.glb` | 61 MB | 0,68 M | nein | dito |
| `karting_club_lider__outdoor_race_track_ready.glb` | 155 MB | 0,83 M | nein | 1492 Meshes, Bounding-Box 61 km × 46 km, Trailer/Deko-Müll — unbrauchbar ohne schweres Aufräumen; Spiel hat bereits `assets/tracks/kartbahn_lider.glb` |
| `spa-francorchamps-1992-layout/source/Spa Francorchamps.glb` | — | — | — | Texturen lose im Ordner (nicht eingebettet) |
| `race-track-23mb-glb/source/track.glb` | 23 MB | — | — | generisch, Texturen lose |

## Warum nicht heute

Der fertige `silverstone-gp`-Eintrag zeigt den nötigen Standard:
- **`meshUrl`** → komprimierte GLB (~15 MB; Quelle war 121 MB). Kompression:
  WebP-Texturen → `gltfpack -cc`. **`gltfpack`/`gltf-transform` sind hier nicht
  installiert**, globale Installation über Nacht wollte ich nicht ohne Rückfrage.
- **`pts`** → 340-Punkte-Centerline, „Marching entlang der Punktwolke" aus der
  benannten Fahrbahn-Mesh (`asphalt.001`), mit echtem Höhenprofil, so rotiert dass
  Index 0 = Start/Ziel. Die Download-GLBs haben **keine benannten Fahrbahn-Meshes**
  (alles `Object_N`), also keine verlässliche automatische Extraktion.
- **`pitLane`** (`side, startPct, endPct, innerOff, outerOff`), **`startFinishPct`**,
  **`startGridPct`**, **`halfWidth`/`wallDist`/`kerbW`/`vergeW`** — alles
  handjustiert und **im Spiel abgefahren** verifiziert.
- **Achsen**: Bounding-Boxen (Silverstone Z 43 m, Monza Z 63 m = die kleine
  Dimension) deuten auf **Z-up**. Das Spiel ist Y-up → beim Laden −90° um X
  rotieren oder einbacken. Muss im Spiel geprüft werden.

Ich kann das Ergebnis nicht rendern/fahren und damit keine dieser 6 Punkte
verifizieren. Eine „fertige" Strecke, die ich nicht testen kann, ist keine.

## Empfohlener Ablauf (mit dir, in einer Session)

Pilot: **Red Bull Ring** (kleinste Datei, echte F1-Strecke, Platzhalter
`redbullring-custom` existiert schon → direkt vergleichbar).

1. `gltfpack` installieren (`npm i -g gltfpack` oder `brew install gltfpack`).
2. Texturen → WebP (Skript wie beim letzten Modell-Durchlauf: erst WebP auf der
   rohen GLB, DANN `gltfpack -cc` — Reihenfolge war wichtig, sonst
   „Invalid typed array length").
3. Ergebnis (~10–20 MB) nach `assets/tracks/redbull_ring.glb`.
4. Im Spiel laden, Achsen/Skalierung prüfen (ggf. rotation.x −90°, Scale-Faktor).
5. Centerline: entweder
   a) in Blender die Fahrbahn-Mesh isolieren, Edge-Loop in der Mitte, als Kurve
      exportieren → ~300 Punkte `[x,z,y,…]`; oder
   b) `tools/glb-inspect.mjs` erweitern: Fahrbahn-Mesh per Hand-Index wählen,
      Positionen projizieren, geordnete Centerline marchen (kann ich bauen, sobald
      wir wissen, welche Mesh die Fahrbahn ist).
6. `pitLane` / `startFinishPct` / `startGridPct` setzen, Boxengasse abfahren.
7. `ai-bench.js` (Browserkonsole) über die Strecke laufen lassen: KI muss die
   Runde beenden, `grasProz` < 5, keine Blockaden.
8. Ein paar Runden selbst fahren, Kollisionsmesh/Boxengasse/Start-Ziel prüfen.
9. `tracks.js` `?v=` bumpen.

Danach die restlichen Strecken nach demselben Muster. Karting-GLB überspringen
(bereits vorhandene Kartbahn nutzen) oder komplett neu aufräumen.

## Auto-GLBs aus /downloads

Die karriere-relevanten Autos waren **alle schon im Spiel** (F4 `tatuus-ft60`,
F3 `dallara-f312`, F2 `f2-2024`, F1 ×4, GT3 ×6, LMP2 ×2, Hypercar ×7, 2 Karts).
Neu ergänzt: **Dacia** (`assets/models/dacia_gt3.glb`, roh 21 MB) als GT3-
Einstiegsvertrag — Playtest nötig (Ausrichtung Y-Länge 4,3 m → evtl. rotX/rotY,
`targetLength`). Die übrigen Download-GLBs sind meist Duplikate bereits
integrierter Autos oder haben Müll-Geometrie (Bounding-Box 10–200 m):
`ford_mustang_gt3` (Y 10,6 m), `audi_r8_lms_gt3_1` (90×204 m), `f2_2024` (144 m),
`go_kart` (125×168 m). Vor Integration in Blender säubern.
`2019_bentley_continental_gt3` ist sauber (4 MB, 33 k Tris) — guter Kandidat für
ein zusätzliches GT3, falls gewünscht (Y = Länge → Rotation nötig).
