# Strecken-Pipeline — rohe GLB → spielfertige Strecke

Stand: 2026-09-07. Werkzeuge: `tools/track-build.mjs`, `tools/track-centerline.mjs`.
Vorbild/Standard: der fertige `silverstone-gp`-Eintrag in `assets/tracks.js`.

## Was schon erledigt ist (heute Nacht)

**3 Strecken-GLBs komprimiert und gegengeprüft** (rohe Sketchfab-Rips → spielbar,
Größe wie `silverstone_gp.glb`):

| Datei | roh → komprimiert | Tris | im Spiel geprüft? |
|---|---|--:|---|
| `assets/tracks/redbull_ring.glb` | 57 MB → **14,5 MB** | 480 k | ⬜ nein — dein Playtest |
| `assets/tracks/sachsenring.glb` | 61 MB → **11,0 MB** | 362 k | ⬜ nein |
| `assets/tracks/monza_2020.glb` | 103 MB → **20,6 MB** | 697 k | ⬜ nein |

Alle mit `EXT_meshopt_compression`, `KHR_mesh_quantization`, `EXT_texture_webp`,
`KHR_texture_transform` — **alle vier vom Spiel-`GLTFLoader.js` nativ unterstützt**
(MeshoptDecoder ist in `_makeGLTFLoader()` gesetzt).

**Noch NICHT in `tracks.js`** — eine Strecke ohne `pts` (Mittellinie) bricht das
Spiel für alle. Die GLBs liegen bereit; der Eintrag kommt, sobald die Mittellinie
steht (Schritt 2 unten, ~15–20 min pro Strecke in Blender).

Andere GLBs bewusst ausgelassen: `monza`/`silverstone_2024` — Spiel hat schon eine
Version; `karting_club_lider` — 1492 Meshes, 61 km × 46 km Bounding-Box, Trailer/
Deko-Müll, unbrauchbar ohne kompletten Neuaufbau (und es gibt `kartbahn_lider.glb`).

## Weitere GLB komprimieren

```
node tools/track-build.mjs compress ~/Downloads/<roh>.glb <out-name> [--simplify=0.5]
```
`--simplify` 0.3–0.6 (Anteil der Dreiecke, der bleibt). Kleiner = kleinere Datei,
grobere Geometrie. Danach `assets/tracks/<out-name>.glb`.

## Schritt 2 — Mittellinie (`pts`) in Blender

Der einzige Teil, der Augen braucht. Pro Strecke ~15–20 min.

1. `assets/tracks/<name>.glb` in Blender importieren.
2. Die **Asphalt-Fahrbahn** im Viewport sichtbar isolieren (die Rennfläche, nicht
   Auslaufzonen/Boxengasse).
3. Eine **Kurve (Bézier/Pfad)** grob in der Fahrbahnmitte entlangziehen — 25–45
   Kontrollpunkte reichen, eine geschlossene Schleife.
4. **Shrinkwrap-Modifier** auf die Kurve, Target = Fahrbahn-Mesh, Projekt „nach
   unten" → die Kurve klebt aufs Höhenprofil. Anwenden.
5. Punkte exportieren (Blender-Scripting-Konsole):
   ```python
   import bpy, json
   c = bpy.context.object
   pts = [list(bpy.context.object.matrix_world @ p.co.to_3d())
          for s in c.data.splines for p in (s.bezier_points if s.type=='BEZIER' else s.points)]
   json.dump({"axis":"blender","pts":[[round(x,2),round(y,2),round(z,2)] for x,y,z in pts]},
             open("/tmp/<name>-poly.json","w"))
   ```
6. Verfeinern:
   ```
   node tools/track-centerline.mjs /tmp/<name>-poly.json <name> --n=320
   ```
   → `assets/tracks/<name>.centerline.json` mit `pts` (zentriert), `meshOffset`,
   Länge. `axis`: `blender` (Z-up, Default) / `gltf` / `raw`.

## Schritt 3 — `tracks.js`-Eintrag (Vorlage, `silverstone-gp`-Muster)

```js
{
  id: "redbull-ring",
  name: "Red Bull Ring",
  sub: "Spielberg · 4,3 km · <TODO Klasse/Charakter>",
  meshUrl: 'assets/tracks/redbull_ring.glb',
  mesh: {
    offset: [/* meshOffset aus der centerline.json */],
    rawSurface: true,
    light: { sun: 0.95, hemi: 0.82, exposure: 1.00 },  // im Spiel tunen
    // skyFactor: 2.5,  // falls eine Kuppel stehen bleibt
  },
  halfWidth: /* halbe Fahrbahnbreite, ~7–10; Startwert aus centerline oder 8 */,
  sky: 0x9fc3eb, hill: 0x5e8a42, grass: [0x4e8b3a, 0x407531],
  wallDist: 26, kerbW: 4, vergeW: 12,
  startFinishPct: 0,     // % entlang pts, wo die Ziellinie liegt (nach Rotation 0)
  startGridPct: 100,     // Startaufstellung dahinter
  env: "forest",
  pitLane: { side: -1, startPct: 96, endPct: 8, innerOff: 9, outerOff: 20 },
  pts: [ /* die pts aus <name>.centerline.json einfügen: [[x,z,y],[x,z,y],...] */ ],
}
```
- **`pts` rotieren**: Array-Anfang so verschieben, dass Index 0 = Start/Ziel-Linie
  (Boxengeraden-Höhe). `startFinishPct` bleibt dann 0.
- **`mesh.offset`** = `meshOffset` aus der centerline.json (macht das Zentrieren
  der `pts` rückgängig, legt die GLB deckungsgleich darüber).
- Danach `tracks.js` `?v=` in `gt3-web-racer.html` bumpen.

## Schritt 4 — Playtest (das, was ich nicht kann)

1. Strecke im Zeitfahren laden. Lädt die GLB? Achsen/Skalierung ok, oder muss
   `mesh.offset` / ein `mesh.scale` / `rotY` ran?
2. Deckt sich die unsichtbare Fahrlinie (`pts`) mit der sichtbaren Fahrbahn?
   Sonst `pts` nachziehen oder `offset` korrigieren.
3. Start/Ziel an der richtigen Stelle? Sonst `pts` rotieren.
4. Boxengasse: rein-/rausfahrbar, Boxenstopp funktioniert? `pitLane.side` /
   `startPct` / `endPct` / Offsets justieren.
5. `wallDist` / `vergeW`: Track-Limits fair (nicht zu eng, nicht zu weit)?
6. `ai-bench.js` (Browserkonsole) über die Strecke laufen lassen: KI beendet die
   Runde, `grasProz` < 5, keine Blockade.
7. Ein paar Runden selbst fahren.

## Werkzeug-Referenz

| Tool | Zweck |
|---|---|
| `tools/glb-inspect.mjs <glb…>` | Meshes/Verts/BBox/Kompression eines GLB anzeigen |
| `tools/track-build.mjs compress <roh> <name>` | GLB komprimieren → `assets/tracks/<name>.glb` |
| `tools/track-centerline.mjs <poly.json> <name>` | grobe Blender-Punkte → fertige `pts` + `mesh.offset` |

Abhängigkeiten (per `npm install --no-save` geholt, nicht in package.json):
`@gltf-transform/core functions extensions`, `meshoptimizer`, `draco3dgltf`, `sharp`.
