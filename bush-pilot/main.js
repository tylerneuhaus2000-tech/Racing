// ============================================================
// BUSH PILOT — ISLAND AIR
// Kompletter Neubau: handgebautes Insel-Archipel (~36 km) mit
// echtem 3D-Terrain, goldenem Abendlicht, animiertem Wasser und
// einem einzigen, sauber abgestimmten Flugmodell.
// Features: Tag/Nacht-Zyklus, Free Play Mode, Cockpit-Ansagen
// Klassisches Script (file://-tauglich, GitHub-Pages-tauglich).
// ============================================================

'use strict';

// ---------------- Flugzeuge ----------------
// vmax/vs in m/s · thrust = Beschleunigung bei Vollgas · minRunway in m
const PLANES = [
  { id: 'kolibri',  name: 'Kolibri',  role: 'Trainer',    icon: '🛩️', cost: 0,
    color: 0xe8b84b, accent: 0x2a2a38,
    vmax: 62,  vs: 17, thrust: 16, turn: 1.6, pitchRate: 1.15, fuel: 420, minRunway: 300 },
  { id: 'otter',    name: 'Otter',    role: 'Wasserflugzeug', icon: '🦆', cost: 500,
    color: 0x3fa08c, accent: 0xc94f3d,
    vmax: 68,  vs: 19, thrust: 17, turn: 1.4, pitchRate: 1.05, fuel: 480, minRunway: 300, canWater: true },
  { id: 'courier',  name: 'Courier',  role: 'Turboprop',  icon: '✈️', cost: 1400,
    color: 0x5aa7d6, accent: 0xeef3f6,
    vmax: 92,  vs: 26, thrust: 26, turn: 1.1, pitchRate: 0.95, fuel: 540, minRunway: 650 },
  { id: 'albatros', name: 'Albatros', role: 'Frachter',   icon: '📦', cost: 3200,
    color: 0xdde4e8, accent: 0x8898a4,
    vmax: 105, vs: 32, thrust: 30, turn: 0.7, pitchRate: 0.6, fuel: 700, minRunway: 1050, heavy: true },
  { id: 'falke',    name: 'Falke',    role: 'Jet',        icon: '🚀', cost: 6000,
    color: 0x767c8a, accent: 0xc94f3d,
    vmax: 150, vs: 38, thrust: 55, turn: 2.2, pitchRate: 1.7, fuel: 380, minRunway: 900 },
  { id: 'airliner', name: 'Sonnenjet', role: 'Passagierflugzeug', icon: '🛫', cost: 9000,
    color: 0xf0f4f8, accent: 0x2f5c85,
    vmax: 118, vs: 33, thrust: 34, turn: 0.82, pitchRate: 0.68, fuel: 840, minRunway: 1600, heavy: true },
];

// Gewuenscht: Alle Flugzeuge sollen sich wie das erste Modell (Kolibri) steuern/anfuehlen.
const BASE_FLIGHT_MODEL = {
  vmax: PLANES[0].vmax,
  vs: PLANES[0].vs,
  thrust: PLANES[0].thrust,
  turn: PLANES[0].turn,
  pitchRate: PLANES[0].pitchRate,
  minRunway: PLANES[0].minRunway,
};
for (let i = 1; i < PLANES.length; i++) {
  Object.assign(PLANES[i], BASE_FLIGHT_MODEL);
  PLANES[i].heavy = false;
}

// ---------------- Echte Weltkarte: Web-Mercator-Koordinaten ----------------
// Dieselbe Projektion wie OSM/Bing/Google-Kacheln (EPSG:3857), damit unser
// Terrain-Mesh exakt zu den echten Kartenkacheln passt.
const EARTH_R = 6378137; // Meter (WGS84/Web-Mercator-Radius)
function lonLatToWorld(lon, lat) {
  const x = EARTH_R * lon * Math.PI / 180;
  const latRad = Math.max(-1.4835, Math.min(1.4835, lat * Math.PI / 180)); // ±85.05° Mercator-Grenze
  const z = -EARTH_R * Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  return { x, z };
}
function worldToLonLat(x, z) {
  const lon = x / EARTH_R * 180 / Math.PI;
  const lat = (2 * Math.atan(Math.exp(-z / EARTH_R)) - Math.PI / 2) * 180 / Math.PI;
  return { lon, lat };
}
// Slippy-Map-Kachel-Mathematik (Standard-XYZ-Tiling, wie von den Kartendiensten erwartet)
function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const x = (lon + 180) / 360 * n;
  const latRad = lat * Math.PI / 180;
  const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
  return { x, y };
}
function tileToLonLat(tx, ty, z) {
  const n = 2 ** z;
  const lon = tx / n * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / n)));
  return { lon, lat: latRad * 180 / Math.PI };
}
function tileWorldOrigin(tx, ty, z) {
  const ll = tileToLonLat(tx, ty, z);
  return lonLatToWorld(ll.lon, ll.lat); // Nordwest-Ecke der Kachel in Weltkoordinaten
}

// ---------------- Echte internationale Flughäfen ----------------
// tier bestimmt Bahnlänge/-breite: hub = große Langstrecken-Airports (3,2 km),
// regional = kleine Feldflughäfen, extreme = legendäre Kurzbahnen (nur Kolibri/Otter).
const TIER_SPECS = {
  hub:      { len: 3200, w: 45 },
  regional: { len: 1100, w: 24 },
  extreme:  { len: 500,  w: 18 },
};
const AIRPORT_DATA = [
  { id: 'FRA', name: 'Frankfurt',       lat: 50.03,  lon: 8.57,    heading: 0.44, tier: 'hub' },
  { id: 'LHR', name: 'London Heathrow', lat: 51.47,  lon: -0.45,   heading: 1.57, tier: 'hub' },
  { id: 'CDG', name: 'Paris CDG',       lat: 49.01,  lon: 2.55,    heading: 1.05, tier: 'hub' },
  { id: 'MAD', name: 'Madrid',          lat: 40.47,  lon: -3.57,   heading: 0.31, tier: 'hub' },
  { id: 'JFK', name: 'New York JFK',    lat: 40.64,  lon: -73.78,  heading: 0.55, tier: 'hub' },
  { id: 'ORD', name: 'Chicago',         lat: 41.97,  lon: -87.90,  heading: 1.75, tier: 'hub' },
  { id: 'LAX', name: 'Los Angeles',     lat: 33.94,  lon: -118.41, heading: 4.36, tier: 'hub' },
  { id: 'ANC', name: 'Anchorage',       lat: 61.17,  lon: -149.99, heading: 2.44, tier: 'hub' },
  { id: 'GRU', name: 'São Paulo',       lat: -23.43, lon: -46.47,  heading: 1.66, tier: 'hub' },
  { id: 'JNB', name: 'Johannesburg',    lat: -26.14, lon: 28.25,   heading: 0.61, tier: 'hub' },
  { id: 'DXB', name: 'Dubai',           lat: 25.25,  lon: 55.36,   heading: 2.13, tier: 'hub' },
  { id: 'SIN', name: 'Singapur',        lat: 1.36,   lon: 103.99,  heading: 0.38, tier: 'hub' },
  { id: 'HND', name: 'Tokio Haneda',    lat: 35.55,  lon: 139.78,  heading: 5.93, tier: 'hub' },
  { id: 'SYD', name: 'Sydney',          lat: -33.95, lon: 151.18,  heading: 2.97, tier: 'hub' },
  { id: 'ESS', name: 'Essen/Mülheim',   lat: 51.40,  lon: 6.94,    heading: 0.20, tier: 'regional' },
  { id: 'INN', name: 'Innsbruck',       lat: 47.26,  lon: 11.34,   heading: 0.85, tier: 'regional' },
  { id: 'ACK', name: 'Nantucket',       lat: 41.25,  lon: -70.06,  heading: 1.90, tier: 'regional' },
  { id: 'ZQN', name: 'Queenstown',      lat: -45.02, lon: 168.74,  heading: 3.40, tier: 'regional' },
  { id: 'SAB', name: 'Saba',            lat: 17.64,  lon: -63.22,  heading: 2.10, tier: 'extreme' },
  { id: 'LUA', name: 'Lukla',           lat: 27.69,  lon: 86.73,   heading: 5.00, tier: 'extreme' },
];
const AIRPORTS = AIRPORT_DATA.map(a => {
  const { x, z } = lonLatToWorld(a.lon, a.lat);
  const spec = TIER_SPECS[a.tier];
  return { ...a, x, z, len: spec.len, w: spec.w, elev: null }; // elev wird beim Booten aus echten Höhendaten gefüllt
});
AIRPORTS.forEach(ap => { ap.flatR = ap.len * 0.72 + 260; });

const GRAVITY = 9.8;

// ---------------- Echtes Kachel-Terrain (Höhendaten + Satellitenbilder) ----------------
// Höhe: AWS "Terrarium" Elevation Tiles (kostenlos, kein API-Key, weltweit).
// Bild: ESRI World Imagery Satellitenkacheln (kostenlos, kein API-Key).
// Beides sind Standard-Slippy-Map-Kacheln — Web-Mercator, wie oben projiziert.
const TERRAIN_ZOOM = 12;
const TILE_WORLD_SIZE = (2 * Math.PI * EARTH_R) / (2 ** TERRAIN_ZOOM);
const TILE_SEG = 24;
const TILE_CACHE = new Map(); // "z_x_y" -> { mesh, raster:{width,height,heights}, loading, failed }
const tileKey = (z, x, y) => `${z}_${x}_${y}`;

function decodeTerrarium(imageData) {
  const { width, height, data } = imageData;
  const heights = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    heights[i] = (data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256) - 32768;
  }
  return { width, height, heights };
}
function sampleHeights(raster, u, v) {
  const { width, height, heights } = raster;
  const fx = u * (width - 1), fy = v * (height - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
  const tx = fx - x0, ty = fy - y0;
  const h00 = heights[y0 * width + x0], h10 = heights[y0 * width + x1];
  const h01 = heights[y1 * width + x0], h11 = heights[y1 * width + x1];
  return h00 * (1 - tx) * (1 - ty) + h10 * tx * (1 - ty) + h01 * (1 - tx) * ty + h11 * tx * ty;
}
function loadElevationRaster(z, x, y) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
        const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
        resolve(decodeTerrarium(cx.getImageData(0, 0, img.width, img.height)));
      } catch (e) { resolve(null); } // z.B. CORS-Problem — stiller Fallback statt Absturz
    };
    img.onerror = () => resolve(null);
    img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
  });
}
function loadImageryTexture(z, x, y) {
  return new Promise(resolve => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
      tex => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); },
      undefined,
      () => resolve(null),
    );
  });
}
async function ensureTile(z, x, y) {
  const key = tileKey(z, x, y);
  if (TILE_CACHE.has(key)) return TILE_CACHE.get(key);
  const entry = { mesh: null, raster: null, loading: true, failed: false };
  TILE_CACHE.set(key, entry);
  const [raster, tex] = await Promise.all([loadElevationRaster(z, x, y), loadImageryTexture(z, x, y)]);
  entry.loading = false;
  entry.raster = raster;
  if (!raster) { entry.failed = true; return entry; } // kein Absturz — Kachel bleibt einfach leer (Wasserfläche scheint durch)

  const origin = tileWorldOrigin(x, y, z);
  const geo = new THREE.PlaneGeometry(TILE_WORLD_SIZE, TILE_WORLD_SIZE, TILE_SEG, TILE_SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cx = origin.x + TILE_WORLD_SIZE / 2, cz = origin.z + TILE_WORLD_SIZE / 2;
  for (let i = 0; i < pos.count; i++) {
    const wx = cx + pos.getX(i), wz = cz + pos.getZ(i);
    const u = THREE.MathUtils.clamp((wx - origin.x) / TILE_WORLD_SIZE, 0, 1);
    const v = THREE.MathUtils.clamp((wz - origin.z) / TILE_WORLD_SIZE, 0, 1);
    pos.setY(i, sampleHeights(raster, u, v));
  }
  geo.computeVertexNormals();
  const mat = tex ? new THREE.MeshLambertMaterial({ map: tex }) : new THREE.MeshLambertMaterial({ color: 0x6a7a5a });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, 0, cz);
  world.add(mesh);
  entry.mesh = mesh;
  return entry;
}
function disposeTile(key) {
  const entry = TILE_CACHE.get(key);
  if (entry && entry.mesh) {
    world.remove(entry.mesh);
    entry.mesh.geometry.dispose();
    entry.mesh.material.map?.dispose();
    entry.mesh.material.dispose();
  }
  TILE_CACHE.delete(key);
}
let lastTileX = null, lastTileY = null;
const activeTileKeys = new Set();
function updateVisibleTiles() {
  const { lon, lat } = worldToLonLat(state.mode === 'flying' ? state.pos.x : apById(state.home).x,
                                       state.mode === 'flying' ? state.pos.z : apById(state.home).z);
  const t = lonLatToTile(lon, lat, TERRAIN_ZOOM);
  const tx = Math.floor(t.x), ty = Math.floor(t.y);
  if (tx === lastTileX && ty === lastTileY) return;
  lastTileX = tx; lastTileY = ty;
  const needed = new Set();
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const kx = tx + dx, ky = ty + dy;
    if (ky < 0 || ky >= 2 ** TERRAIN_ZOOM) continue;
    const key = tileKey(TERRAIN_ZOOM, kx, ky);
    needed.add(key);
    if (!activeTileKeys.has(key)) ensureTile(TERRAIN_ZOOM, kx, ky);
  }
  for (const key of activeTileKeys) if (!needed.has(key)) disposeTile(key);
  activeTileKeys.clear();
  for (const k of needed) activeTileKeys.add(k);
}

// Terrainhöhe (Physik + Grafik nutzen dieselbe Funktion). Rohwert kann negativ sein
// (echte Meerestiefe aus den Höhendaten) — groundAt() klemmt auf Meeresspiegel.
function terrainHeight(x, z) {
  const { lon, lat } = worldToLonLat(x, z);
  const t = lonLatToTile(lon, lat, TERRAIN_ZOOM);
  const tx = Math.floor(t.x), ty = Math.floor(t.y);
  const entry = TILE_CACHE.get(tileKey(TERRAIN_ZOOM, tx, ty));
  let h = 0;
  if (entry && entry.raster) {
    const origin = tileWorldOrigin(tx, ty, TERRAIN_ZOOM);
    const u = THREE.MathUtils.clamp((x - origin.x) / TILE_WORLD_SIZE, 0, 1);
    const v = THREE.MathUtils.clamp((z - origin.z) / TILE_WORLD_SIZE, 0, 1);
    h = sampleHeights(entry.raster, u, v);
  }
  // Flughafen-Plateaus: echtes Gelände sanft auf die Bahn-Ebene ziehen, sonst läge
  // die Bahn windschief im echten (nie perfekt flachen) Gelände.
  for (const ap of AIRPORTS) {
    if (typeof ap.elev !== 'number') continue;
    const d = Math.hypot(x - ap.x, z - ap.z);
    if (d < ap.flatR) {
      const tt0 = d < ap.flatR * 0.55 ? 1 : 1 - (d - ap.flatR * 0.55) / (ap.flatR * 0.45);
      const tt = tt0 * tt0 * (3 - 2 * tt0);
      h = h + (ap.elev - h) * tt;
    }
  }
  return h;
}
const groundAt = (x, z) => Math.max(0, terrainHeight(x, z)); // Wasseroberfläche zählt als Boden

function initAirportElevations() {
  for (const ap of AIRPORTS) {
    const h = groundAt(ap.x, ap.z);
    ap.elev = Number.isFinite(h) ? h + 1.2 : 1.2;
  }
}

// -------- Tag/Nacht-Zyklus --------
const DAYNIGHT = {
  cycleDuration: 600, // in Sekunden für eine komplette Tag/Nacht
  timeOfDay: 0.25, // 0-1: 0 = Mitternacht, 0.25 = Morgen, 0.5 = Mittag, 0.75 = Abend
};

function updateDayNightCycle(dt) {
  DAYNIGHT.timeOfDay = (DAYNIGHT.timeOfDay + dt / DAYNIGHT.cycleDuration) % 1;
}

function getLightColors() {
  const t = DAYNIGHT.timeOfDay;
  let sunColor, skyZenith, skyHorizon, ambientLight, hemLightGround;
  
  // Morgen: 0.0-0.25 (Sonnenaufgang)
  if (t < 0.25) {
    const phase = t / 0.25;
    sunColor = new THREE.Color(0xff8833).lerp(new THREE.Color(0xffe3b8), phase);
    skyZenith = new THREE.Color(0x1a3a5f).lerp(new THREE.Color(0x5f9fd8), phase);
    skyHorizon = new THREE.Color(0x4a3a2a).lerp(new THREE.Color(0xe9c9a2), phase);
    ambientLight = 0.1 + phase * 0.3;
    hemLightGround = new THREE.Color(0x3a4a60).lerp(new THREE.Color(0x4a5540), phase);
  }
  // Tag: 0.25-0.5
  else if (t < 0.5) {
    const phase = (t - 0.25) / 0.25;
    sunColor = new THREE.Color(0xffe3b8);
    skyZenith = new THREE.Color(0x5f9fd8).lerp(new THREE.Color(0x87ceeb), phase);
    skyHorizon = new THREE.Color(0xe9c9a2).lerp(new THREE.Color(0xf0e8d8), phase);
    ambientLight = 0.4 + phase * 0.15;
    hemLightGround = new THREE.Color(0x4a5540).lerp(new THREE.Color(0x5a6550), phase);
  }
  // Nachmittag: 0.5-0.75 (Sonnenuntergang)
  else if (t < 0.75) {
    const phase = (t - 0.5) / 0.25;
    sunColor = new THREE.Color(0xffe3b8).lerp(new THREE.Color(0xff7744), phase);
    skyZenith = new THREE.Color(0x87ceeb).lerp(new THREE.Color(0x9f4a2a), phase);
    skyHorizon = new THREE.Color(0xf0e8d8).lerp(new THREE.Color(0xd9634a), phase);
    ambientLight = 0.55 - phase * 0.35;
    hemLightGround = new THREE.Color(0x5a6550).lerp(new THREE.Color(0x4a3a2a), phase);
  }
  // Nacht: 0.75-1.0
  else {
    const phase = (t - 0.75) / 0.25;
    sunColor = new THREE.Color(0xff7744).lerp(new THREE.Color(0xff8833), phase);
    skyZenith = new THREE.Color(0x9f4a2a).lerp(new THREE.Color(0x1a3a5f), phase);
    skyHorizon = new THREE.Color(0xd9634a).lerp(new THREE.Color(0x4a3a2a), phase);
    ambientLight = Math.max(0.05, 0.2 - phase * 0.15);
    hemLightGround = new THREE.Color(0x4a3a2a).lerp(new THREE.Color(0x3a4a60), phase);
  }
  
  return { sunColor, skyZenith, skyHorizon, ambientLight, hemLightGround };
}


// ---------------- Seeded Noise (Value-Noise + fBm) ----------------
function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x, z) {
  return vnoise(x, z) * 0.55 + vnoise(x * 2.13, z * 2.13) * 0.27 +
         vnoise(x * 4.41, z * 4.41) * 0.13 + vnoise(x * 8.9, z * 8.9) * 0.05;
}

// ---------------- Save ----------------
// Alle Flugzeuge sind von Anfang an freigeschaltet — kein Grind, sofort alles ausprobierbar.
const ALL_PLANE_IDS = PLANES.map(p => p.id);
const save = loadSave();
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem('bushpilot_ia_save'));
    if (s && Array.isArray(s.unlocked)) { s.unlocked = ALL_PLANE_IDS.slice(); return s; }
  } catch (e) { /* neu anfangen */ }
  return { coins: 0, unlocked: ALL_PLANE_IDS.slice(), selected: 'kolibri', home: 'HAL', missionsDone: 0 };
}
function persist() { localStorage.setItem('bushpilot_ia_save', JSON.stringify(save)); }
const apById = id => AIRPORTS.find(a => a.id === id) || AIRPORTS[0];

// ---------------- Renderer / Szene / Licht ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const FOG_COLOR = 0xe9c9a2; // warmer Dunst — goldene Stunde
scene.fog = new THREE.Fog(FOG_COLOR, 5000, 42000);

// Zentrale Welt-Gruppe für Terrain, Airports, KI und Wolken.
const world = new THREE.Group();
scene.add(world);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 4, 90000);

const sunDir = new THREE.Vector3(-0.55, 0.42, -0.72).normalize();
const sun = new THREE.DirectionalLight(0xffe3b8, 1.9);
sun.position.copy(sunDir).multiplyScalar(1000);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xa8c8e8, 0x4a5540, 0.75));
scene.add(new THREE.AmbientLight(0xffffff, 0.12));

// Cache für Lichter (für updateLighting Performance)
let cachedAmbLight = null, cachedHemLight = null;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------- Himmelskuppel mit Farbverlauf + Sonne ----------------
(function buildSky() {
  const geo = new THREE.SphereGeometry(60000, 24, 14);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const zenith = new THREE.Color(0x5f9fd8), mid = new THREE.Color(0x9fc2e0), horizon = new THREE.Color(FOG_COLOR);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / 60000, -0.15, 1);
    if (t < 0.12) c.copy(horizon).lerp(mid, Math.max(0, t) / 0.12 * 0.5);
    else c.copy(mid).lerp(zenith, Math.min(1, (t - 0.12) / 0.55));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  sky.name = 'sky';
  scene.add(sky);

  // Sonnenscheibe + Glow als Sprites
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const cx = cv.getContext('2d');
  const grad = cx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,244,220,1)');
  grad.addColorStop(0.25, 'rgba(255,224,160,0.85)');
  grad.addColorStop(1, 'rgba(255,200,120,0)');
  cx.fillStyle = grad; cx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, depthWrite: false, transparent: true }));
  sunSprite.scale.setScalar(14000);
  sunSprite.position.copy(sunDir).multiplyScalar(52000);
  sunSprite.name = 'sunSprite';
  scene.add(sunSprite);
})();

// ---------------- Wasser ----------------
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(140000, 140000),
  new THREE.MeshPhongMaterial({ color: 0x1d6a8f, shininess: 90, specular: 0x557788 })
);
water.rotation.x = -Math.PI / 2;
water.renderOrder = -1;
scene.add(water);

// Sanfte Wellen-Kachel um den Spieler (Vertex-Animation, subtil)
const waveGeo = new THREE.PlaneGeometry(3200, 3200, 40, 40);
waveGeo.rotateX(-Math.PI / 2);
const waveTile = new THREE.Mesh(waveGeo, new THREE.MeshPhongMaterial({
  color: 0x2e86ad, shininess: 120, specular: 0x88aabb, transparent: true, opacity: 0.55, depthWrite: false,
}));
scene.add(waveTile);
function updateWaves(t, px, pz) {
  waveTile.position.set(Math.round(px / 80) * 80, 0.35, Math.round(pz / 80) * 80);
  const pos = waveGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const wx = waveTile.position.x + pos.getX(i), wz = waveTile.position.z + pos.getZ(i);
    pos.setY(i, Math.sin(wx * 0.011 + t * 1.1) * 0.55 + Math.sin(wz * 0.014 - t * 0.8) * 0.45);
  }
  pos.needsUpdate = true;
}

// ---------------- Vegetation ----------------
// Entfällt bewusst: echte Satellitenbilder zeigen bereits echte Vegetation/Bebauung —
// zusätzliche prozedurale Bäume würden nicht zu den echten Kacheln passen.
const dummy = new THREE.Object3D();

// ---------------- Wolken (folgen dem Spieler, damit sie nie "aus der Welt fallen") ----------------
const clouds = [];
function buildClouds() {
  const geo = new THREE.SphereGeometry(1, 7, 5);
  // Emissive-Anteil: Wolken leuchten leicht von innen, statt von unten grau abzusaufen
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xfff4e4, emissiveIntensity: 0.45, transparent: true, opacity: 0.8 });
  const mesh = new THREE.InstancedMesh(geo, mat, 60);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const anchor = apById(state.home);
  for (let i = 0; i < 60; i++) {
    clouds.push({
      x: anchor.x + (hash2(i, 1) - 0.5) * 36000, z: anchor.z + (hash2(i, 2) - 0.5) * 36000,
      y: 1100 + hash2(i, 3) * 1500,
      sx: 380 + hash2(i, 4) * 700, sy: 60 + hash2(i, 5) * 70, sz: 380 + hash2(i, 6) * 700,
    });
  }
  world.add(mesh);
  cloudsMesh = mesh;
}
let cloudsMesh = null;
function updateClouds(dt) {
  if (!cloudsMesh) return;
  const anchor = state.mode === 'flying' ? state.pos : apById(state.home);
  for (let i = 0; i < clouds.length; i++) {
    const c = clouds[i];
    c.x += dt * 6; // sanfte Drift
    // Kachel um den Spieler herum halten, statt an einem festen Weltursprung zu driften
    if (c.x - anchor.x > 20000) c.x = anchor.x - 20000;
    if (c.x - anchor.x < -20000) c.x = anchor.x + 20000;
    if (c.z - anchor.z > 20000 || c.z - anchor.z < -20000) c.z = anchor.z + (hash2(i, 77) - 0.5) * 36000;
    dummy.position.set(c.x, c.y, c.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(c.sx, c.sy, c.sz);
    dummy.updateMatrix();
    cloudsMesh.setMatrixAt(i, dummy.matrix);
  }
  cloudsMesh.instanceMatrix.needsUpdate = true;
}

// ---------------- Flughäfen ----------------
// getRunways: liefert alle Bahnen eines Flughafens. Airports ohne eigenes
// `runways`-Array (die meisten Bush-Strips) bekommen automatisch eine einzelne
// Bahn aus ihren Basis-Feldern — 100% rückwärtskompatibel zu alten Airports.
function getRunways(ap) {
  if (ap.runways) return ap.runways;
  return [{ x: ap.x, z: ap.z, heading: ap.heading, len: ap.len, w: ap.w }];
}
function inRunwayFrame(x, z, rw) {
  const dx = x - rw.x, dz = z - rw.z;
  const c = Math.cos(-rw.heading), s = Math.sin(-rw.heading);
  return { lx: dx * c - dz * s, lz: dx * s + dz * c };
}
function onRunway(x, z) {
  for (const ap of AIRPORTS) {
    for (const rw of getRunways(ap)) {
      const { lx, lz } = inRunwayFrame(x, z, rw);
      if (Math.abs(lx) < rw.w / 2 + 12 && Math.abs(lz) < rw.len / 2) return { ap, rw, centerOffset: Math.abs(lx) };
    }
  }
  return null;
}
function buildAirports() {
  const rwMat = new THREE.MeshLambertMaterial({ color: 0x3d4148 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });
  const towerMat = new THREE.MeshLambertMaterial({ color: 0xd8dde2 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xc94f3d });
  const hangarMat = new THREE.MeshLambertMaterial({ color: 0x9aa5ae });
  const termMat = new THREE.MeshLambertMaterial({ color: 0xe4e8ec });
  const termRoofMat = new THREE.MeshLambertMaterial({ color: 0x3d6f91 });
  const apronMat = new THREE.MeshLambertMaterial({ color: 0x4a4e55 });
  const tankMat = new THREE.MeshLambertMaterial({ color: 0xc7cdd2 });
  const parkedMat = new THREE.MeshLambertMaterial({ color: 0xd7dde2 });
  const dashes = [], papi = [], runwayLights = [];

  for (const ap of AIRPORTS) {
    const dir = new THREE.Vector3(-Math.sin(ap.heading), 0, Math.cos(ap.heading));
    const side = new THREE.Vector3(Math.cos(ap.heading), 0, Math.sin(ap.heading));
    const y = ap.elev;

    // Alle Bahnen des Flughafens rendern (bei den meisten Airports nur eine)
    for (const rw of getRunways(ap)) {
      const rdir = new THREE.Vector3(-Math.sin(rw.heading), 0, Math.cos(rw.heading));
      const rside = new THREE.Vector3(Math.cos(rw.heading), 0, Math.sin(rw.heading));

      // WICHTIG: rotation.y = −heading! Die Logik-Achse aus inRunwayFrame ist
      // (−sin h, cos h); Ry(θ)·ẑ = (sin θ, cos θ) ⇒ θ = −h. Mit +h wären sichtbare
      // Bahn und Lande-Logik gegeneinander verdreht (Flugzeug „neben" der Bahn).
      const rwMesh = new THREE.Mesh(new THREE.BoxGeometry(rw.w, 1.2, rw.len), rwMat);
      rwMesh.position.set(rw.x, y + 0.6, rw.z);
      rwMesh.rotation.y = -rw.heading;
      scene.add(rwMesh);

      // Mittellinien-Striche
      const nDash = Math.floor(rw.len / 60);
      for (let i = 0; i < nDash; i++) {
        const t = -rw.len / 2 + 40 + i * 60;
        dashes.push({ x: rw.x + rdir.x * t, y: y + 1.28, z: rw.z + rdir.z * t, heading: -rw.heading });
      }

      // Runway-Lichter (für Nacht sichtbar)
      for (let i = 0; i < Math.floor(rw.len / 30); i++) {
        const t = -rw.len / 2 + i * 30;
        runwayLights.push({
          x: rw.x + rdir.x * t + rside.x * (rw.w / 2 + 2),
          y: y + 0.8,
          z: rw.z + rdir.z * t + rside.z * (rw.w / 2 + 2),
          color: 0xffff99
        });
        runwayLights.push({
          x: rw.x + rdir.x * t - rside.x * (rw.w / 2 + 2),
          y: y + 0.8,
          z: rw.z + rdir.z * t - rside.z * (rw.w / 2 + 2),
          color: 0xffff99
        });
      }

      // Schwellen-Befeuerung
      for (const e of [1, -1]) {
        for (let i = 0; i < 4; i++) {
          const off = (i - 1.5) * 5;
          papi.push({
            x: rw.x + rdir.x * e * (rw.len / 2 + 12) + rside.x * off,
            y: y + 1.6,
            z: rw.z + rdir.z * e * (rw.len / 2 + 12) + rside.z * off,
            color: i < 2 ? 0xff5040 : 0xfff4e0,
          });
        }
      }
    }

    // Tower + Hangar + Windsack seitlich (an der Hauptbahn)
    const twr = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(7, 26, 7), towerMat);
    shaft.position.y = 13;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(11, 6, 11), roofMat);
    cab.position.y = 28;
    twr.add(shaft, cab);
    twr.position.set(ap.x + side.x * (ap.w / 2 + 55), y, ap.z + side.z * (ap.w / 2 + 55));
    scene.add(twr);

    const hg = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 26), hangarMat);
    hg.position.set(ap.x + side.x * (ap.w / 2 + 110) + dir.x * 60, y + 6, ap.z + side.z * (ap.w / 2 + 110) + dir.z * 60);
    hg.rotation.y = -ap.heading;
    scene.add(hg);

    // Größere Airports (medium/large) bekommen zusätzlich Terminal, Vorfeld,
    // Tanklager und geparkte Flugzeug-Silhouetten — je nach Größe.
    if (ap.size === 'medium' || ap.size === 'large') {
      const big = ap.size === 'large';
      const apronX = ap.x + side.x * (ap.w / 2 + 170) + dir.x * -40;
      const apronZ = ap.z + side.z * (ap.w / 2 + 170) + dir.z * -40;

      const apron = new THREE.Mesh(new THREE.BoxGeometry(big ? 130 : 90, 0.6, big ? 90 : 64), apronMat);
      apron.position.set(apronX, y + 0.3, apronZ);
      apron.rotation.y = -ap.heading;
      scene.add(apron);

      const term = new THREE.Mesh(new THREE.BoxGeometry(big ? 70 : 46, big ? 14 : 10, big ? 22 : 16), termMat);
      term.position.set(apronX + side.x * (big ? 80 : 60), y + (big ? 7 : 5), apronZ + side.z * (big ? 80 : 60));
      term.rotation.y = -ap.heading;
      scene.add(term);
      const termRoof = new THREE.Mesh(new THREE.BoxGeometry(big ? 74 : 49, 1.4, big ? 25 : 18), termRoofMat);
      termRoof.position.set(term.position.x, term.position.y + (big ? 7.4 : 5.4), term.position.z);
      termRoof.rotation.y = -ap.heading;
      scene.add(termRoof);

      // Tanklager (Treibstoff-Tanks als Zylinder)
      for (let i = 0; i < (big ? 3 : 2); i++) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 9, 12), tankMat);
        const tOff = (i - (big ? 1 : 0.5)) * 12;
        tank.position.set(
          apronX + dir.x * (big ? 90 : 65) + side.x * tOff,
          y + 4.5,
          apronZ + dir.z * (big ? 90 : 65) + side.z * tOff
        );
        scene.add(tank);
      }

      // Geparkte Flugzeuge (einfache Silhouetten aus Boxen) auf dem Vorfeld
      const parkCount = big ? 4 : 2;
      for (let i = 0; i < parkCount; i++) {
        const pOff = (i - (parkCount - 1) / 2) * 22;
        const plane = new THREE.Group();
        const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.1, 11, 8), parkedMat);
        fuselage.rotation.x = Math.PI / 2;
        const wing = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 2), parkedMat);
        wing.position.z = -0.5;
        plane.add(fuselage, wing);
        plane.position.set(apronX + side.x * pOff - dir.x * 20, y + 1.4, apronZ + side.z * pOff - dir.z * 20);
        plane.rotation.y = -ap.heading + Math.PI / 2;
        scene.add(plane);
      }
    }
  }

  const dashMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.25, 26), dashMat, dashes.length);
  dashes.forEach((d, i) => {
    dummy.position.set(d.x, d.y, d.z); dummy.rotation.set(0, d.heading, 0); dummy.scale.setScalar(1);
    dummy.updateMatrix(); dashMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(dashMesh);

  const papiMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), new THREE.MeshBasicMaterial(), papi.length);
  const pc = new THREE.Color();
  papi.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1);
    dummy.updateMatrix(); papiMesh.setMatrixAt(i, dummy.matrix);
    papiMesh.setColorAt(i, pc.setHex(p.color));
  });
  scene.add(papiMesh);
  
  // Runway-Lichter als InstancedMesh
  const runwayLightMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.4, 4, 4), new THREE.MeshBasicMaterial(), runwayLights.length);
  runwayLights.forEach((l, i) => {
    dummy.position.set(l.x, l.y, l.z);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    runwayLightMesh.setMatrixAt(i, dummy.matrix);
    runwayLightMesh.setColorAt(i, new THREE.Color(l.color));
  });
  runwayLightMesh.name = 'runwayLights';
  scene.add(runwayLightMesh);
}

// Ziel-Leuchtsäule (weithin sichtbar, pulsiert)
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(26, 26, 1400, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd257, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false })
);
beacon.visible = false;
scene.add(beacon);
function setBeacon(x, z) {
  beacon.visible = true;
  beacon.position.set(x, groundAt(x, z) + 700, z);
}
function updateBeacon(t) {
  if (!beacon.visible) return;
  beacon.material.opacity = 0.16 + Math.sin(t * 2.2) * 0.07;
  beacon.rotation.y = t * 0.4;
}

// ---------------- Flugzeug-Modelle ----------------
let planeGroup = null, propellers = [];
function createAircraftMesh(spec) {
  const g = new THREE.Group();
  const props = [];
  const mat = new THREE.MeshLambertMaterial({ color: spec.color });
  const acc = new THREE.MeshLambertMaterial({ color: spec.accent });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22242e });
  const glass = new THREE.MeshLambertMaterial({ color: 0x2c4e6e });
  const box = (w, h, d, m, x, y, z, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.rotation.z = rz;
    g.add(mesh); return mesh;
  };
  const cyl = (r1, r2, len, m, x, y, z, rx = Math.PI / 2) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 10), m);
    mesh.position.set(x, y, z); mesh.rotation.x = rx;
    g.add(mesh); return mesh;
  };
  const prop = (x, y, z, size) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, size * 2, 0.3), dark);
    p.position.set(x, y, z); g.add(p); props.push(p); return p;
  };

  switch (spec.id) {
    case 'kolibri':
      cyl(0.95, 0.7, 8, mat, 0, 0, 0.5);
      box(11, 0.4, 2, mat, 0, 1.2, -0.7);
      box(4.5, 0.35, 1.4, acc, 0, 1.21, -0.7);            // Akzentstreifen auf dem Flügel
      box(1.6, 0.95, 1.9, glass, 0, 0.9, -1.2);
      box(3.8, 0.3, 1.3, mat, 0, 0.35, 4.1);
      box(0.3, 1.8, 1.3, acc, 0, 1.15, 4.2);
      cyl(0.3, 0.3, 0.8, dark, -1.1, -1.1, -0.9, 0);
      cyl(0.3, 0.3, 0.8, dark, 1.1, -1.1, -0.9, 0);
      prop(0, 0, -3.7, 2.6);
      break;
    case 'otter':
      cyl(1.05, 0.85, 9.5, mat, 0, 0.4, 0.5);
      box(13, 0.45, 2.2, mat, 0, 1.7, -0.5);
      box(1.7, 1.05, 2.3, glass, 0, 1.05, -1.6);
      box(4.4, 0.3, 1.4, mat, 0, 1.0, 4.8);
      box(0.32, 2.1, 1.4, acc, 0, 2.0, 4.9);
      box(0.95, 0.75, 7.8, acc, -1.75, -1.35, 0);         // Schwimmer
      box(0.95, 0.75, 7.8, acc, 1.75, -1.35, 0);
      prop(0, 0.4, -4.4, 3.0);
      break;
    case 'courier':
      cyl(1.25, 0.95, 12.5, mat, 0, 0, 0.5);
      box(15.5, 0.55, 2.5, mat, 0, -0.4, -0.8);
      box(2.3, 1.05, 2.7, glass, 0, 0.95, -3.6);
      box(5.6, 0.35, 1.6, mat, 0, 0.45, 5.9);
      box(0.38, 2.7, 1.7, acc, 0, 1.7, 6.0);
      cyl(0.62, 0.52, 2.9, dark, -3.5, -0.3, -1.4);
      cyl(0.62, 0.52, 2.9, dark, 3.5, -0.3, -1.4);
      prop(-3.5, -0.3, -3.1, 2.4);
      prop(3.5, -0.3, -3.1, 2.4);
      break;
    case 'albatros':
      cyl(1.9, 1.5, 24, mat, 0, 0, 0);
      box(24, 0.7, 3.8, mat, 0, 1.2, 0.6);                // Schulterdecker (Frachter-Look)
      box(2.7, 1.25, 3.1, glass, 0, 1.0, -9.4);
      box(9, 0.45, 2.4, mat, 0, 0.7, 10.6);
      box(0.45, 4.0, 2.6, acc, 0, 2.7, 10.8);
      cyl(0.95, 0.95, 3.4, dark, -6, 0.1, -1);
      cyl(0.95, 0.95, 3.4, dark, 6, 0.1, -1);
      prop(-6, 0.1, -3, 2.8);
      prop(6, 0.1, -3, 2.8);
      break;
    case 'falke':
      cyl(0.95, 0.5, 13.5, mat, 0, 0, 0);
      box(1.5, 0.85, 2.7, glass, 0, 0.72, -3.5);
      box(9.5, 0.32, 4.8, mat, 0, -0.2, 2.3);
      box(6.2, 0.32, 2.6, mat, 0, -0.2, 0);
      box(0.28, 2.3, 1.9, mat, -1.35, 1.25, 5.6, 0, 0.35);
      box(0.28, 2.3, 1.9, mat, 1.35, 1.25, 5.6, 0, -0.35);
      cyl(0.58, 0.75, 1.7, acc, 0, 0, 7.3);
      break;
    case 'airliner':
      cyl(2.2, 1.75, 31, mat, 0, 0.25, -1.0);
      box(30, 0.9, 6.2, mat, 0, -0.2, 1.8);
      box(3.5, 1.4, 3.6, glass, 0, 1.35, -11.8);
      box(11.0, 0.5, 3.2, mat, 0, 0.9, 13.0);
      box(0.58, 5.0, 3.1, acc, 0, 3.0, 13.4);
      cyl(1.2, 1.2, 4.6, dark, -7.6, -0.55, -1.6);
      cyl(1.2, 1.2, 4.6, dark, 7.6, -0.55, -1.6);
      break;
  }
  return { group: g, propellers: props };
}
function buildPlaneMesh(spec) {
  if (planeGroup) scene.remove(planeGroup);
  const built = createAircraftMesh(spec);
  scene.add(built.group);
  planeGroup = built.group;
  propellers = built.propellers;
}

// ---------------- Spielzustand & Eingabe ----------------
const state = {
  mode: 'menu', // menu | select | flying | debrief | freeplay
  yaw: 0, pitch: 0, roll: 0,
  pos: new THREE.Vector3(),
  velDir: new THREE.Vector3(0, 0, -1),
  speed: 0, vSpeed: 0, throttle: 0,
  fuel: 1, damage: 0, gear: true, onGround: true,
  spec: PLANES[0],
  home: save.home,
  mission: null,
  eventTimer: 20,
  engineTrouble: 0,
  gust: new THREE.Vector3(),
  shake: 0,
  camMode: 0,
  isFreePlay: false,
  freePlayStartTime: 0,
  freePlayCoinsAccumulated: 0,
  atc: { departureCleared: false, clearedLandingFor: null },
};

const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  initAudio();
  if (e.code === 'KeyM') { sfx.muted = !sfx.muted; message(sfx.muted ? 'Ton aus' : 'Ton an', 'good'); }
  if (e.code === 'KeyG' && state.mode === 'flying' && !state.onGround) {
    state.gear = !state.gear;
    message(state.gear ? 'Fahrwerk ausgefahren' : 'Fahrwerk eingefahren', 'good');
  }
  if (e.code === 'KeyC') state.camMode = (state.camMode + 1) % 2;
  if (e.code === 'KeyR' && state.mode === 'flying') {
    if (state.isFreePlay) {
      endFreePlay();
    } else if (state.mission) {
      endMission(false, 'Mission abgebrochen');
    } else {
      resetToAirport(state.home);
    }
  }
  if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('pointerdown', initAudio);

function resetToAirport(apId) {
  const ap = apById(apId);
  const D = ap.len / 2 - 30;
  state.pos.set(ap.x + Math.sin(ap.heading) * D, ap.elev + 2.0, ap.z - Math.cos(ap.heading) * D);
  state.yaw = Math.PI - ap.heading;
  state.pitch = 0; state.roll = 0;
  state.speed = 0; state.vSpeed = 0; state.throttle = 0;
  state.velDir.set(0, 0, -1).applyEuler(new THREE.Euler(0, state.yaw, 0));
  state.fuel = 1; state.gear = true; state.onGround = true;
  state.gust.set(0, 0, 0); state.engineTrouble = 0;
  state.atc.departureCleared = false; state.atc.clearedLandingFor = null;
}

// ---------------- Missionen ----------------
const MISSION_TYPES = {
  cargo:     { icon: '📦', name: 'Fracht',     desc: ap => `Bring die Ladung nach ${ap}.` },
  passenger: { icon: '🧑‍✈️', name: 'Passagiere', desc: ap => `Fliege Gäste nach ${ap} — sanfte Landung zählt doppelt.` },
  rescue:    { icon: '🛟', name: 'Rettung',    desc: ap => `Folge den Ringen Richtung ${ap} und wirf das Paket am roten Ring ab.` },
};
let ringMeshes = [];
function clearMissionObjects() {
  for (const r of ringMeshes) scene.remove(r);
  ringMeshes = [];
  beacon.visible = false;
}
function generateMissions() {
  const home = apById(state.home);
  const plane = PLANES.find(p => p.id === save.selected);
  const options = AIRPORTS
    .filter(ap => ap.id !== home.id && ap.len >= plane.minRunway)
    .map(ap => ({ ap, d: Math.hypot(ap.x - home.x, ap.z - home.z) }))
    .sort((a, b) => a.d - b.d);
  if (!options.length) return [];
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const near = options[0], far = options[options.length - 1];
  const mid = options[Math.min(options.length - 1, Math.floor(options.length / 2))];
  const mk = (type, o, mult) => ({
    type, target: o.ap.id,
    km: Math.round(o.d / 100) / 10,
    reward: Math.round((40 + o.d / 1000 * 14) * mult),
  });
  return [mk('cargo', pick([near, mid]), 1), mk('passenger', mid, 1.2), mk('rescue', far, 1.45)];
}
function startMission(m) {
  clearMissionObjects();
  state.mission = { ...m, rings: [], ringIdx: 0, startTime: performance.now(), _landScore: 0 };
  const home = apById(state.home), tgt = apById(m.target);

  if (m.type === 'rescue') {
    const n = 5;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = home.x + (tgt.x - home.x) * t + (hash2(i, 999) - 0.5) * 1800;
      const z = home.z + (tgt.z - home.z) * t + (hash2(i, 555) - 0.5) * 1800;
      const isLast = i === n;
      const y = groundAt(x, z) + (isLast ? 60 : 160 + hash2(i, 7) * 240);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(40, 4.5, 8, 22),
        new THREE.MeshBasicMaterial({ color: isLast ? 0xff5040 : 0xffd257 })
      );
      ring.position.set(x, y, z);
      ring.lookAt(i === 1 ? new THREE.Vector3(home.x, y, home.z) : ringMeshes[ringMeshes.length - 1].position);
      scene.add(ring);
      ringMeshes.push(ring);
      state.mission.rings.push(ring.position.clone());
    }
    setBeacon(state.mission.rings[0].x, state.mission.rings[0].z);
    beacon.position.y = state.mission.rings[0].y;
  } else {
    setBeacon(tgt.x, tgt.z);
  }

  resetToAirport(state.home);
  state.mode = 'flying';
  state.damage = 0;
  updateMissionHUD();
  showOnly('hud');
  message(`${MISSION_TYPES[m.type].icon} ${MISSION_TYPES[m.type].name} — los geht's!`, 'good');
  copilotSay('Vollgas mit SHIFT, bei Tempo mit S abheben.');
}
function endMission(success, reason) {
  const m = state.mission;
  state.mission = null;
  clearMissionObjects();
  state.mode = 'debrief';

  let coins = 0, statsHtml = '';
  if (success && m) {
    const timeSec = (performance.now() - m.startTime) / 1000;
    const dmgPenalty = state.damage / 100;
    const soft = m.type === 'passenger' ? 2 : 1;
    coins = Math.max(15, Math.round(m.reward * (1 - dmgPenalty * 0.6) * (1 - m._landScore * 0.3 * soft)));
    save.coins += coins;
    save.missionsDone++;
    save.home = state.home;
    persist();
    statsHtml = `Strecke <b>${m.km} km</b> &nbsp;·&nbsp; Zeit <b>${Math.floor(timeSec / 60)}:${String(Math.floor(timeSec % 60)).padStart(2, '0')}</b><br>
      Schaden <b>${Math.round(state.damage)}%</b> &nbsp;·&nbsp; Landung <b>${m._landScore < 0.15 ? 'butterweich' : m._landScore < 0.5 ? 'solide' : 'hart'}</b>`;
  } else {
    statsHtml = `<span style="color:#ffab91">${reason || 'Fehlgeschlagen'}</span>`;
  }
  document.getElementById('debrief-title').textContent = success ? 'Mission abgeschlossen' : 'Mission gescheitert';
  document.getElementById('debrief-stats').innerHTML = statsHtml;
  document.getElementById('debrief-reward').textContent = success ? `+${coins} ◈` : '';
  showOnly('debrief');
}

// -------- Free Play Mode --------
function startFreePlay() {
  clearMissionObjects();
  state.isFreePlay = true;
  state.freePlayStartTime = performance.now();
  state.freePlayCoinsAccumulated = 0;
  state.mission = null;
  resetToAirport(state.home);
  state.mode = 'flying';
  state.damage = 0;
  updateMissionHUD();
  showOnly('hud');
  message('🎮 Freier Flug — tanke und verdiene Coins!', 'good');
  copilotSay('Vollgas mit SHIFT halten für Beschleunigung, dann S drücken zum Abheben.');
}

function endFreePlay() {
  if (!state.isFreePlay) return;
  const timeSec = (performance.now() - state.freePlayStartTime) / 1000;
  const flightMinutes = Math.floor(timeSec / 60);
  const coinsEarned = Math.max(5, Math.floor(flightMinutes * 0.5));
  state.freePlayCoinsAccumulated = coinsEarned;
  save.coins += coinsEarned;
  persist();
  
  state.isFreePlay = false;
  state.mode = 'debrief';
  document.getElementById('debrief-title').textContent = 'Freier Flug beendet';
  document.getElementById('debrief-stats').innerHTML = `Flugzeit <b>${flightMinutes} Minuten</b><br>Schaden <b>${Math.round(state.damage)}%</b>`;
  document.getElementById('debrief-reward').textContent = `+${coinsEarned} ◈`;
  showOnly('debrief');
}
function updateMissionHUD() {
  const m = state.mission;
  const info = document.getElementById('mission-info');
  if (!m) { info.textContent = 'Freier Flug'; return; }
  const t = MISSION_TYPES[m.type];
  info.textContent = `${t.icon} ${t.name} → ${apById(m.target).name}`;
}
function missionTarget() {
  const m = state.mission;
  if (!m) return null;
  if (m.type === 'rescue') return m.rings[m.ringIdx] || null;
  const ap = apById(m.target);
  return new THREE.Vector3(ap.x, ap.elev, ap.z);
}
function updateMissionAndEvents(dt) {
  const m = state.mission;
  if (!m) return;
  if (m.type === 'rescue' && m.ringIdx < m.rings.length) {
    const ring = m.rings[m.ringIdx];
    if (state.pos.distanceTo(ring) < 52) {
      ringMeshes[m.ringIdx].material.color.set(0x9be370);
      m.ringIdx++;
      if (m.ringIdx >= m.rings.length) {
        message('Paket abgeworfen — Rettung geglückt!', 'good');
        endMission(true);
        resetToAirport(state.home);
        return;
      }
      message(`Ring ${m.ringIdx}/${m.rings.length}`, 'good');
      const next = m.rings[m.ringIdx];
      setBeacon(next.x, next.z);
      beacon.position.y = next.y;
    }
  }
  state.eventTimer -= dt;
  if (state.eventTimer <= 0) {
    state.eventTimer = 24 + Math.random() * 22;
    if (!state.onGround) {
      const roll = Math.random();
      if (roll < 0.5) {
        const a = Math.random() * Math.PI * 2;
        state.gust.set(Math.cos(a) * 18, (Math.random() - 0.3) * 7, Math.sin(a) * 18);
        message('Windböe!', 'warn');
        copilotSay('Böe — ruhig gegensteuern.');
      } else if (roll < 0.75) {
        state.engineTrouble = 7 + Math.random() * 6;
        message('Triebwerk stottert!', 'warn');
        copilotSay('Höhe halten, das Triebwerk fängt sich gleich.');
      }
    }
  }
}

// ---------------- UI ----------------
function message(txt, cls = '') {
  const div = document.createElement('div');
  div.className = 'msg ' + cls;
  div.textContent = txt;
  const box = document.getElementById('messages');
  box.appendChild(div);
  setTimeout(() => div.remove(), 4000);
  if (box.children.length > 4) box.firstChild.remove();
}
let copilotTimeout = null;
function copilotSay(txt) {
  const el = document.getElementById('copilot');
  el.textContent = txt;
  clearTimeout(copilotTimeout);
  copilotTimeout = setTimeout(() => { el.textContent = ''; }, 5000);
}
function showOnly(id) {
  for (const el of ['menu', 'mission-select', 'debrief']) {
    document.getElementById(el).classList.toggle('hidden', el !== id);
  }
  document.getElementById('hud').classList.toggle('hidden', id !== 'hud');
}
function renderHangar() {
  const box = document.getElementById('hangar');
  box.innerHTML = '';
  for (const p of PLANES) {
    const unlocked = save.unlocked.includes(p.id);
    const card = document.createElement('div');
    card.className = 'plane-card' + (save.selected === p.id ? ' selected' : '') + (unlocked ? '' : ' locked');
    card.innerHTML = `
      <div class="p-icon">${p.icon}</div>
      <div class="p-name">${p.name}</div>
      <div class="p-role">${p.role}</div>
      <div class="p-stats">Vmax ${Math.round(p.vmax * 1.94)} kt · Vmin ${Math.round(p.vs * 1.94)} kt<br>Bahn ab ${p.minRunway} m</div>
      ${unlocked ? '' : `<div class="p-price">◈ ${p.cost}</div>`}`;
    card.onclick = () => {
      if (unlocked) save.selected = p.id;
      else if (save.coins >= p.cost) { save.coins -= p.cost; save.unlocked.push(p.id); save.selected = p.id; }
      else {
        card.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 220 });
        return;
      }
      persist();
      renderHangar();
    };
    box.appendChild(card);
  }
  document.getElementById('menu-coins').textContent = save.coins;
  document.getElementById('menu-home').textContent = `Standort · ${apById(state.home).name}`;
}
function renderMissionSelect() {
  const list = document.getElementById('mission-list');
  list.innerHTML = '';
  const missions = generateMissions();
  if (!missions.length) {
    list.innerHTML = '<div style="color:var(--ink-dim)">Die Bahn hier ist zu kurz für dein Flugzeug — wähle im Hangar ein kleineres.</div>';
    return;
  }
  for (const m of missions) {
    const t = MISSION_TYPES[m.type];
    const tgt = apById(m.target);
    const card = document.createElement('div');
    card.className = 'mission-card';
    card.innerHTML = `
      <div class="m-icon">${t.icon}</div>
      <div class="m-type">${t.name}</div>
      <div class="m-desc">${t.desc(tgt.name)}</div>
      <div class="m-meta">${m.km} km · Bahn ${tgt.len} m</div>
      <div class="m-reward">◈ ~${m.reward}</div>`;
    card.onclick = () => {
      state.spec = PLANES.find(p => p.id === save.selected);
      buildPlaneMesh(state.spec);
      startMission(m);
    };
    list.appendChild(card);
  }
}
document.getElementById('btn-fly').onclick = () => {
  if (!worldReady) return;
  renderMissionSelect();
  showOnly('mission-select');
};
document.getElementById('btn-freeplay').onclick = () => {
  if (!worldReady) return;
  state.spec = PLANES.find(p => p.id === save.selected);
  buildPlaneMesh(state.spec);
  startFreePlay();
};
document.getElementById('btn-back').onclick = () => { renderHangar(); showOnly('menu'); };
document.getElementById('btn-continue').onclick = () => { renderHangar(); showOnly('menu'); state.mode = 'menu'; };

// ---------------- Minimap (Inselkarte, einmal vorgerendert) ----------------
const minimapEl = document.getElementById('minimap');
const mmCtx = minimapEl.getContext('2d');
const MM = 200, MM_WORLD = 36000;
const mapBase = document.createElement('canvas');
mapBase.width = mapBase.height = MM;
function prerenderMap() {
  const c = mapBase.getContext('2d');
  const img = c.createImageData(MM, MM);
  const col = new THREE.Color();
  for (let py = 0; py < MM; py++) for (let px = 0; px < MM; px++) {
    const wx = (px / MM - 0.5) * MM_WORLD, wz = (py / MM - 0.5) * MM_WORLD;
    const h = terrainHeight(wx, wz);
    if (h < 0.5) col.setHex(h < -14 ? 0x14425c : 0x1d6a8f);
    else if (h < 4) col.setHex(0xd9c48e);
    else if (h < 300) col.setHex(0x5d8f47);
    else if (h < 700) col.setHex(0x7c7466);
    else col.setHex(0xe8e6df);
    const i = (py * MM + px) * 4;
    img.data[i] = col.r * 255; img.data[i + 1] = col.g * 255; img.data[i + 2] = col.b * 255; img.data[i + 3] = 235;
  }
  c.putImageData(img, 0, 0);
  c.fillStyle = '#f2e9d8';
  for (const ap of AIRPORTS) {
    const [mx, my] = worldToMap(ap.x, ap.z);
    c.fillRect(mx - 1.5, my - 1.5, 3, 3);
  }
}
function worldToMap(x, z) { return [(x / MM_WORLD + 0.5) * MM, (z / MM_WORLD + 0.5) * MM]; }
function drawMinimap() {
  mmCtx.clearRect(0, 0, MM, MM);
  mmCtx.drawImage(mapBase, 0, 0);
  const tgt = missionTarget();
  const [px, py] = worldToMap(state.pos.x, state.pos.z);
  if (tgt) {
    const [tx, ty] = worldToMap(tgt.x, tgt.z);
    mmCtx.strokeStyle = 'rgba(242, 209, 137, 0.65)';
    mmCtx.lineWidth = 1.2;
    mmCtx.setLineDash([4, 4]);
    mmCtx.beginPath(); mmCtx.moveTo(px, py); mmCtx.lineTo(tx, ty); mmCtx.stroke();
    mmCtx.setLineDash([]);
    mmCtx.strokeStyle = '#f2d189';
    mmCtx.lineWidth = 2;
    mmCtx.beginPath(); mmCtx.arc(tx, ty, 5, 0, Math.PI * 2); mmCtx.stroke();
  }
  mmCtx.save();
  mmCtx.translate(px, py);
  mmCtx.rotate(-state.yaw);
  mmCtx.fillStyle = '#ff6b57';
  mmCtx.beginPath();
  mmCtx.moveTo(0, -6); mmCtx.lineTo(4, 5); mmCtx.lineTo(-4, 5);
  mmCtx.closePath(); mmCtx.fill();
  mmCtx.restore();
}

// ---------------- Instrumente (künstlicher Horizont + Kompass) ----------------
const attCtx = document.getElementById('attitude').getContext('2d');
function drawAttitude() {
  const c = attCtx, W = 180, cx = 90, cy = 90, R = 84;
  c.clearRect(0, 0, W, W);
  c.save();
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip();
  c.translate(cx, cy);
  c.rotate(-state.roll);
  const pxPerDeg = 2.4;
  const off = (state.pitch * 180 / Math.PI) * pxPerDeg;
  c.fillStyle = '#4a90d9';
  c.fillRect(-R * 2, -R * 3 + off, R * 4, R * 3);
  c.fillStyle = '#7a5230';
  c.fillRect(-R * 2, off, R * 4, R * 3);
  c.strokeStyle = '#fff'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-R * 2, off); c.lineTo(R * 2, off); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.fillStyle = 'rgba(255,255,255,0.9)';
  c.lineWidth = 1.4; c.font = '9px sans-serif'; c.textAlign = 'center';
  for (let d = -30; d <= 30; d += 10) {
    if (d === 0) continue;
    const y = off - d * pxPerDeg, w = (d % 20 === 0) ? 28 : 15;
    c.beginPath(); c.moveTo(-w, y); c.lineTo(w, y); c.stroke();
    if (d % 20 === 0) { c.fillText(Math.abs(d), -w - 9, y + 3); c.fillText(Math.abs(d), w + 9, y + 3); }
  }
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.5;
  for (const a of [-60, -30, 0, 30, 60]) {
    const r = a * Math.PI / 180;
    c.beginPath();
    c.moveTo(cx + Math.sin(r) * R, cy - Math.cos(r) * R);
    c.lineTo(cx + Math.sin(r) * (R - 8), cy - Math.cos(r) * (R - 8));
    c.stroke();
  }
  c.strokeStyle = '#ffcf33'; c.lineWidth = 3;
  c.beginPath();
  c.moveTo(cx - 34, cy); c.lineTo(cx - 12, cy);
  c.moveTo(cx + 12, cy); c.lineTo(cx + 34, cy);
  c.moveTo(cx, cy - 4); c.lineTo(cx, cy + 7);
  c.stroke();
  c.fillStyle = '#ffcf33'; c.beginPath(); c.arc(cx, cy, 2.5, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#1a2430'; c.lineWidth = 3;
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
}
const compCtx = document.getElementById('compass').getContext('2d');
function drawCompass(hdg) {
  const c = compCtx, W = 200, H = 34, cx = W / 2, pxPerDeg = 2.2;
  c.clearRect(0, 0, W, H);
  c.fillStyle = 'rgba(8,18,28,0.9)'; c.fillRect(0, 0, W, H);
  c.textAlign = 'center'; c.font = 'bold 10px sans-serif';
  const base = Math.round(hdg / 10) * 10;
  for (let d = -50; d <= 50; d += 10) {
    const deg = ((base + d) % 360 + 360) % 360;
    const x = cx + (base + d - hdg) * pxPerDeg;
    if (x < 2 || x > W - 2) continue;
    const major = deg % 30 === 0;
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, H); c.lineTo(x, H - (major ? 12 : 6)); c.stroke();
    if (major) {
      c.fillStyle = '#f2d189';
      c.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg] || (deg / 10), x, 12);
    }
  }
  c.strokeStyle = '#ffcf33'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx, H); c.stroke();
}

// ---------------- Flugmodell (Anstellwinkel-basiert, echte Trägheit) ----------------
// Ein Pilot hat zurecht bemängelt, dass die Nase quasi sofort die Flugbahn war (wie ein
// Auto, kein Flugzeug). Jetzt: state.velDir/state.speed sind ein echter, träge
// integrierter Geschwindigkeitsvektor. Auftrieb hängt vom Anstellwinkel (Winkel
// zwischen Nase und Flugbahn) ab, Kurven entstehen aus Querneigung (koordinierter
// Kurvenflug), und over-critical AoA bricht die Strömung wirklich ab.
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const fwd = new THREE.Vector3();
const upVec = new THREE.Vector3();
const liftDir = new THREE.Vector3();
const velVec = new THREE.Vector3();
const accelVec = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const CRIT_AOA = 0.27; // ~15.5° — kritischer Anstellwinkel, ab dem die Strömung abreißt

function updateFlight(dt) {
  const p = state.spec;

  const pitchIn = (keys['KeyS'] ? 1 : 0) - (keys['KeyW'] ? 1 : 0);
  const turnIn = (keys['KeyA'] ? 1 : 0) - (keys['KeyD'] ? 1 : 0);
  if (keys['ShiftLeft'] || keys['ShiftRight']) state.throttle = Math.min(1, state.throttle + dt * 0.8);
  if (keys['ControlLeft'] || keys['ControlRight']) state.throttle = Math.max(0, state.throttle - dt * 0.8);

  if (state.engineTrouble > 0) state.engineTrouble -= dt;
  state.fuel = Math.max(0, state.fuel - state.throttle * dt / p.fuel);
  const engineMult = state.fuel <= 0 ? 0 : (state.engineTrouble > 0 ? 0.35 : 1);
  if (state.fuel <= 0 && state.throttle > 0.1) copilotSay('Tank leer — sofort landen!');

  const groundH = groundAt(state.pos.x, state.pos.z);
  const agl = state.pos.y - groundH - 2.0;

  // ---- Lage ----
  const authority = THREE.MathUtils.clamp(state.speed / p.vs, 0, 1.25);
  if (state.onGround) {
    state.yaw += turnIn * 0.9 * dt * Math.min(1, state.speed / 9);
    state.roll *= Math.max(0, 1 - dt * 8);
    state.pitch = Math.max(0, state.pitch);
    if (pitchIn > 0 && state.speed > p.vs * 1.12) state.pitch += pitchIn * p.pitchRate * dt;
    else if (pitchIn <= 0) state.pitch *= Math.max(0, 1 - dt * 6);
  } else {
    // Rollen ist direkt steuerbar (Querruder), Nicken wirkt auf den Anstellwinkel —
    // die tatsächliche Flugbahn folgt erst über die Kräftebilanz weiter unten.
    const targetRoll = -turnIn * 0.75 * Math.min(1, authority);
    state.roll += (targetRoll - state.roll) * Math.min(1, dt * 4.2);
    state.pitch += pitchIn * p.pitchRate * authority * dt;
    state.pitch = THREE.MathUtils.clamp(state.pitch, -0.85, 0.78);
    // Leichte Längsstabilität statt hartem Auto-Trimm: die Nase treibt bei losgelassenem
    // Stick nur sehr sanft Richtung neutral, wie ein echt (leicht) stabiles Flugzeug.
    if (pitchIn === 0) state.pitch *= Math.max(0, 1 - dt * 0.12);
    // Koordinierter Kurvenflug: Gieren entsteht aus der Querneigung (Schwerkraft-Komponente),
    // nicht direkt aus der Tastatureingabe — man banked in die Kurve, statt zu drehen wie ein Auto.
    if (state.speed > 3) {
      const yawRate = THREE.MathUtils.clamp(GRAVITY * Math.tan(state.roll) / state.speed, -1.7, 1.7);
      state.yaw += yawRate * dt;
    }
  }

  euler.set(state.pitch, state.yaw, state.roll);
  fwd.set(0, 0, -1).applyEuler(euler);
  upVec.set(0, 1, 0).applyEuler(euler);

  let aoa = 0, stalling = false;
  const prevY = state.pos.y;

  if (state.onGround) {
    // Bodenrollen: einfache Schub-/Luftwiderstandsbilanz, Bugrad hält exakt die Spur.
    // Bremsen beim Ausrollen passiert weiter unten im Boden-Block (wie bisher).
    const aeroDrag = 0.011 * state.speed * state.speed / (p.vmax * p.vmax / 55);
    state.speed = Math.max(0, state.speed + (state.throttle * p.thrust * engineMult - aeroDrag) * dt);
    state.velDir.copy(fwd);
    state.pos.addScaledVector(state.velDir, state.speed * dt);
    state.vSpeed = (state.pos.y - prevY) / dt;
  } else {
    // ---- Luft: echte Kräftebilanz aus Anstellwinkel statt kinematischem "Nase=Bahn" ----
    const speed = Math.max(0.4, state.speed);
    velVec.copy(state.velDir).multiplyScalar(speed);
    const horiz = Math.max(0.05, Math.hypot(velVec.x, velVec.z));
    const flightPathPitch = Math.atan2(velVec.y, horiz);
    aoa = THREE.MathUtils.clamp(state.pitch - flightPathPitch, -0.7, 0.7);
    stalling = Math.abs(aoa) > CRIT_AOA;

    // CL normiert auf p.vs: bei AoA=CRIT_AOA und Speed=vs ist Auftrieb=Gewicht (per Definition
    // der Stall-Speed) — dieselbe Referenzgeschwindigkeit wie überall sonst im HUD/Stall-Warner,
    // keine zweite, inkonsistente "Realistik"-Kennzahl wie in einer früheren Version.
    let CL;
    if (Math.abs(aoa) <= CRIT_AOA) CL = aoa / CRIT_AOA;
    else { const over = Math.abs(aoa) - CRIT_AOA; CL = Math.sign(aoa) * Math.max(0.22, 1 - over * 3.4); }
    const groundEffect = agl < 12 ? 1.1 : 1;
    const speedRatio2 = (speed * speed) / (p.vs * p.vs);
    const liftAccel = GRAVITY * speedRatio2 * CL * groundEffect;
    const CD0 = 0.02, K = 0.07;
    const dragAccel = GRAVITY * speedRatio2 * (CD0 + K * CL * CL) + (state.gear ? speed * 0.012 : 0);
    const thrustAccel = state.throttle * p.thrust * engineMult;

    liftDir.copy(upVec).addScaledVector(state.velDir, -upVec.dot(state.velDir));
    if (liftDir.lengthSq() < 1e-6) liftDir.set(0, 1, 0); else liftDir.normalize();

    accelVec.set(0, -GRAVITY * (p.heavy ? 1.08 : 1), 0);
    accelVec.addScaledVector(fwd, thrustAccel);
    accelVec.addScaledVector(liftDir, liftAccel);
    accelVec.addScaledVector(state.velDir, -dragAccel);
    accelVec.addScaledVector(state.gust, 0.4);
    state.gust.multiplyScalar(Math.max(0, 1 - dt * 0.7));

    velVec.addScaledVector(accelVec, dt);
    state.speed = velVec.length();
    state.velDir.copy(velVec).normalize();

    state.pos.addScaledVector(state.velDir, state.speed * dt);
    state.vSpeed = (state.pos.y - prevY) / dt;

    // Echter Strömungsabriss: die Nase kippt spürbar weg, statt sanft zu "schweben"
    if (stalling) state.pitch -= Math.sign(aoa) * 0.55 * dt;
  }
  state.speed = Math.min(state.speed, p.vmax * 1.25);

  document.getElementById('stall-warning').classList.toggle('hidden', !stalling);
  if (stalling) state.shake = Math.max(state.shake, 0.4);
  state.shake = Math.max(0, state.shake - dt * 1.6);

  // ---- Ausflaren: bodennah wird die Sinkrate weich begrenzt (macht Landen fair).
  // Aber NICHT bei aktiv gedrückter Nase (pitch < -0.2): wer in den Boden fliegt,
  // fliegt in den Boden — sonst "schwebt" man im Sturzflug und crasht am Ende
  // unverständlich am Aufsetz-Winkel-Check. ----
  const canFlare = (state.gear || (p.canWater && terrainHeight(state.pos.x, state.pos.z) <= 0)) && state.pitch > -0.2;
  if (!state.onGround && canFlare && agl < 16 && agl > -3 && state.vSpeed < 0) {
    const maxSink = 0.8 + Math.max(0, agl) / 16 * 6.0;
    if (-state.vSpeed > maxSink) {
      state.pos.y = prevY - maxSink * dt;
      state.vSpeed = -maxSink;
    }
  }

  // ---- Boden ----
  if (state.onGround) {
    // Wasserflugzeug: auf offener Wasserfläche ist die Oberfläche bei y=0
    const surfH = (p.canWater && groundH < 0) ? 0 : groundH;
    state.pos.y = surfH + 2.0;
    if (state.pitch > 0.06 && state.speed > p.vs * 1.12) {
      state.onGround = false;
      message('Abgehoben', 'good');
      const onWater = terrainHeight(state.pos.x, state.pos.z) <= 0;
      copilotSay(onWater ? 'Wasserstart — sauber!' : 'Sauber — Fahrwerk mit G einfahren.');
    } else {
      // Ausrollen / Bremsen
      // Wasserflugzeug bremst auf Wasser langsamer (weniger Reibung)
      const onWater = terrainHeight(state.pos.x, state.pos.z) <= 0;
      const brakeF = (onWater && p.canWater) ? 1.5 : 4.5;
      state.speed = Math.max(0, state.speed - dt * (state.throttle < 0.08 ? brakeF : 0.4));
      if (onWater && !p.canWater) { crash('Ins Wasser gerollt!'); return; }
      if (state.speed < 1.2 && state.throttle < 0.08) handleFullStop();
    }
  } else if (state.pos.y <= groundH + 2.0) {
    // ---- Aufsetzen ----
    const sink = -state.vSpeed;
    const rw = onRunway(state.pos.x, state.pos.z);
    const water = terrainHeight(state.pos.x, state.pos.z) <= 0;
    const level = Math.abs(state.pitch) < 0.5 && Math.abs(state.roll) < 0.5;
    const slow = state.speed < p.vs * 2.6;
    if (water && !p.canWater) { crash('Wasserung ohne Schwimmer!'); return; }
    if (sink > 12)            { crash('Zu hart aufgeschlagen!'); return; }
    if (!level)               { crash('Nicht abgefangen!'); return; }
    if (!slow)                { crash('Viel zu schnell aufgesetzt!'); return; }
    if (!state.gear && !water){ crash('Bauchlandung — Fahrwerk vergessen (G)!'); return; }
    touchdown(rw, sink);
  }

  updateMissionAndEvents(dt);
  updateCopilotHints();
  updateCallouts();
  updateATC();
}

function touchdown(rw, sink) {
  state.onGround = true;
  state.pitch = Math.max(0, state.pitch * 0.3);
  state.roll = 0;
  state.pos.y = groundAt(state.pos.x, state.pos.z) + 2.0;
  playThud();
  const hardness = THREE.MathUtils.clamp(sink / 7, 0, 1);
  if (hardness > 0.5) {
    state.damage = Math.min(100, state.damage + hardness * 22);
    message('Harte Landung!', 'warn');
  } else message('Aufgesetzt', 'good');
  const m = state.mission;
  if (m && (m.type === 'cargo' || m.type === 'passenger')) {
    if (rw && rw.ap.id === m.target) m._pending = { hardness, offset: rw.centerOffset / (rw.ap.w / 2) };
    else if (rw) { /* falsche Bahn — weiterfliegen */ }
    else copilotSay('Feldlandung — Missionen zählen nur auf der Zielbahn.');
  } else if (!rw && !state.mission) {
    copilotSay('Gelandet. Zurück zur Basis mit R.');
  }
  if (rw && rw.ap) atcSay('TURM', `${rw.ap.name}, verlassen Sie die Bahn und rollen Sie zum Vorfeld.`);
}
function handleFullStop() {
  const m = state.mission;
  const ap = onRunway(state.pos.x, state.pos.z)?.ap;
  
  if (m && m._pending) {
    m._landScore = m._pending.hardness * 0.7 + m._pending.offset * 0.3;
    state.home = m.target;
    endMission(true);
    resetToAirport(state.home);
  } else if (state.isFreePlay && ap) {
    // Free Play: Refuel und earnings
    message(`✈️ Getankt auf ${ap.name}`, 'good');
    copilotSay(`Willkommen auf ${ap.name}. Viel Glück beim nächsten Flug!`);
  }
  state.fuel = 1; // Auftanken beim Stillstand
}
function crash(reason) {
  state.damage = 100;
  message('CRASH — ' + reason, 'warn');
  playThud();
  if (state.mission) endMission(false, reason);
  else { state.mode = 'debrief'; endMission(false, reason); }
  resetToAirport(state.home);
  state.damage = 0;
}
let hintCooldown = 0;
function updateCopilotHints() {
  hintCooldown -= 1 / 60;
  if (hintCooldown > 0) return;
  const tgt = missionTarget();
  if (!tgt) return;
  const d = Math.hypot(tgt.x - state.pos.x, tgt.z - state.pos.z);
  if (state.mission && state.mission.type !== 'rescue' && d < 2600 && !state.gear && !state.onGround) {
    copilotSay('Ziel voraus — Fahrwerk raus (G).');
    hintCooldown = 7;
  } else if (state.mission && state.mission.type !== 'rescue' && d < 2000 && state.speed > state.spec.vs * 2 && !state.onGround) {
    copilotSay('Zu schnell für die Landung — Schub raus (CTRL).');
    hintCooldown = 7;
  } else if (!state.onGround && state.vSpeed < -16) {
    copilotSay('Sinkrate zu hoch — hochziehen!');
    hintCooldown = 5;
  }
}

// ---------------- HUD ----------------
function updateHUD() {
  const speedKt = Math.round(state.speed * 1.94);
  const vminKt = Math.round(state.spec.vs * 1.94);
  const speedEl = document.getElementById('hud-speed');
  speedEl.textContent = speedKt;
  speedEl.style.color = (!state.onGround && speedKt < vminKt * 1.12) ? '#ff6b57' : '';
  document.getElementById('hud-vmin').textContent = vminKt;
  document.getElementById('hud-alt').textContent = Math.max(0, Math.round(state.pos.y - groundAt(state.pos.x, state.pos.z)));
  const vsEl = document.getElementById('hud-vs');
  vsEl.textContent = (state.vSpeed >= 0 ? '+' : '') + state.vSpeed.toFixed(1);
  vsEl.style.color = state.vSpeed < -8 ? '#ffab91' : '';
  document.getElementById('throttle-fill').style.width = (state.throttle * 100) + '%';
  document.getElementById('fuel-fill').style.width = (state.fuel * 100) + '%';
  document.getElementById('dmg-fill').style.width = state.damage + '%';
  const gearEl = document.getElementById('hud-gear');
  gearEl.textContent = state.gear ? 'DOWN' : 'UP';
  gearEl.className = state.gear ? 'gear-down' : 'gear-up';
  document.getElementById('hud-coins').textContent = save.coins;

  const hdg = ((Math.atan2(fwd.x, -fwd.z) * 180 / Math.PI) + 360) % 360;
  drawAttitude();
  drawCompass(hdg);

  const tgt = missionTarget();
  const ti = document.getElementById('target-info');
  if (tgt && state.mission) {
    const d = Math.hypot(tgt.x - state.pos.x, tgt.z - state.pos.z);
    const angTo = Math.atan2(-(tgt.x - state.pos.x), -(tgt.z - state.pos.z));
    let rel = angTo - state.yaw;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    const arrow = Math.abs(rel) < 0.3 ? '▲' : rel > 0 ? '◀' : '▶';
    const label = state.mission.type === 'rescue'
      ? `Ring ${state.mission.ringIdx + 1}/${state.mission.rings.length}`
      : apById(state.mission.target).name;
    ti.textContent = `${arrow}  ${label} · ${(d / 1000).toFixed(1)} km`;
  } else ti.textContent = '';
}

// ---------------- Sound (synthetisiert) ----------------
const sfx = { ctx: null, muted: false };
function initAudio() {
  if (sfx.ctx || sfx.muted) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    sfx.ctx = ctx;
    sfx.engOsc = ctx.createOscillator(); sfx.engOsc.type = 'sawtooth'; sfx.engOsc.frequency.value = 45;
    sfx.engFilter = ctx.createBiquadFilter(); sfx.engFilter.type = 'lowpass'; sfx.engFilter.frequency.value = 320;
    sfx.engGain = ctx.createGain(); sfx.engGain.gain.value = 0;
    sfx.engOsc.connect(sfx.engFilter).connect(sfx.engGain).connect(ctx.destination);
    sfx.engOsc.start();
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    sfx.windSrc = ctx.createBufferSource(); sfx.windSrc.buffer = noiseBuf; sfx.windSrc.loop = true;
    sfx.windFilter = ctx.createBiquadFilter(); sfx.windFilter.type = 'bandpass'; sfx.windFilter.frequency.value = 700;
    sfx.windGain = ctx.createGain(); sfx.windGain.gain.value = 0;
    sfx.windSrc.connect(sfx.windFilter).connect(sfx.windGain).connect(ctx.destination);
    sfx.windSrc.start();
    sfx.beepOsc = ctx.createOscillator(); sfx.beepOsc.type = 'square'; sfx.beepOsc.frequency.value = 820;
    sfx.beepGain = ctx.createGain(); sfx.beepGain.gain.value = 0;
    sfx.beepOsc.connect(sfx.beepGain).connect(ctx.destination);
    sfx.beepOsc.start();
  } catch (e) { /* stumm weiter */ }
}
function updateAudio() {
  if (!sfx.ctx) return;
  const t = sfx.ctx.currentTime;
  const flying = state.mode === 'flying';
  sfx.engGain.gain.setTargetAtTime((sfx.muted || !flying) ? 0 : 0.03 + 0.12 * state.throttle, t, 0.1);
  sfx.engOsc.frequency.setTargetAtTime(35 + state.throttle * 75 + state.speed * 0.25, t, 0.1);
  sfx.windGain.gain.setTargetAtTime((sfx.muted || !flying || state.onGround) ? 0 : Math.min(0.10, state.speed * 0.0011), t, 0.2);
  const stalling = flying && !document.getElementById('stall-warning').classList.contains('hidden');
  sfx.beepGain.gain.setTargetAtTime(sfx.muted ? 0 : (stalling ? 0.06 : 0), t, 0.03);
}
function playThud() {
  if (!sfx.ctx || sfx.muted) return;
  const ctx = sfx.ctx;
  const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 75;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  osc.connect(g).connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.32);
}

// -------- Cockpit Callouts (Ansagen mit Web Speech API) --------
const CALLOUT_SYSTEM = {
  lastCalloutTime: 0,
  stallWarningCooldown: 0,
  sinkRateWarningCooldown: 0,
};

const ALTITUDE_CALLOUTS = [500, 400, 300, 250, 200, 150, 100, 50, 40, 30, 20, 10, 5];

function playCallout(text) {
  if ('speechSynthesis' in window && !sfx.muted) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.pitch = 0.95;
    utterance.rate = 0.85;
    utterance.volume = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }
}

function updateCallouts() {
  if (state.mode !== 'flying' || state.onGround) return;
  
  const altAGL = state.pos.y - groundAt(state.pos.x, state.pos.z);
  const now = performance.now();
  
  // Höhenansagen nur im Landeanflug
  if (state.throttle < 0.4 && state.vSpeed < -1.5 && altAGL < 600 && altAGL > 0) {
    for (const alt of ALTITUDE_CALLOUTS) {
      if (Math.abs(altAGL - alt) < 12 && now - CALLOUT_SYSTEM.lastCalloutTime > 1500) {
        playCallout(alt.toString());
        CALLOUT_SYSTEM.lastCalloutTime = now;
        break;
      }
    }
  }
  
  // Stall Warning
  const stalling = !state.onGround && state.speed < state.spec.vs;
  if (stalling && now - CALLOUT_SYSTEM.stallWarningCooldown > 3500) {
    playCallout('Stall! Stall!');
    CALLOUT_SYSTEM.stallWarningCooldown = now;
  }
  
  // Sink Rate Warning
  if (state.vSpeed < -9 && !state.onGround && altAGL < 300 && now - CALLOUT_SYSTEM.sinkRateWarningCooldown > 4000) {
    playCallout('Sink rate!');
    CALLOUT_SYSTEM.sinkRateWarningCooldown = now;
  }
}

// -------- ATC (Flugverkehrskontrolle) --------
// Eigenständiges System, unabhängig vom Copilot: gibt Start-/Landefreigaben
// und Turm-Ansagen über eine zweite, tiefere Stimme aus (zur Unterscheidung
// von den Copilot-Hinweisen und den Cockpit-Callouts).
let atcSpeechVoice = null, atcVoicePicked = false;
function pickAtcVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || !voices.length) return null;
  return voices.find(v => v.lang && v.lang.startsWith('de') && /male|mann|männ/i.test(v.name)) ||
         voices.find(v => v.lang && v.lang.startsWith('de')) ||
         voices[0] || null;
}
function atcSay(tag, text) {
  const panel = document.getElementById('atc-panel');
  if (panel) {
    const line = document.createElement('div');
    line.className = 'atc-line';
    line.innerHTML = `<span class="atc-tag">${tag}</span>${text}`;
    panel.appendChild(line);
    setTimeout(() => line.remove(), 9000);
    if (panel.children.length > 3) panel.firstChild.remove();
  }
  if ('speechSynthesis' in window && !sfx.muted) {
    if (!atcVoicePicked) { atcSpeechVoice = pickAtcVoice(); atcVoicePicked = true; }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'de-DE';
    utter.pitch = 0.72;
    utter.rate = 0.95;
    utter.volume = 0.85;
    if (atcSpeechVoice) utter.voice = atcSpeechVoice;
    window.speechSynthesis.speak(utter);
  }
}
function runwayNumber(headingRad) {
  const deg = ((headingRad * 180 / Math.PI) % 360 + 360) % 360;
  let num = Math.round(deg / 10);
  if (num <= 0) num = 36;
  return String(num).padStart(2, '0');
}
function nearestAirport(px, pz) {
  let best = null, bestD = Infinity;
  for (const ap of AIRPORTS) {
    const d = Math.hypot(ap.x - px, ap.z - pz);
    if (d < bestD) { bestD = d; best = ap; }
  }
  return { ap: best, dist: bestD };
}
function updateATC() {
  if (state.mode !== 'flying') return;
  const atc = state.atc;

  // Startfreigabe: einmal pro Flug, sobald erstmals kräftig Schub gegeben wird
  if (!atc.departureCleared && state.onGround && state.throttle > 0.5) {
    const home = apById(state.home);
    atcSay('TURM', `${home.name}, Sie sind frei zum Start, Bahn ${runwayNumber(home.heading)}.`);
    atc.departureCleared = true;
    // Spieler aus etwaiger Landeschlange entfernen (gerade gestartet)
    atcClearLanded('player', home.id);
  }

  if (!state.onGround) {
    const { ap: near, dist } = nearestAirport(state.pos.x, state.pos.z);
    const agl = state.pos.y - groundAt(state.pos.x, state.pos.z);

    if (near && dist < 3200 && agl > 20 && state.vSpeed < 2) {
      if (atc.clearedLandingFor !== near.id) {
        // In Warteschlange einreihen
        const cleared = atcRequestLanding('player', near.id);
        if (cleared) {
          let bestRw = null, bestDiff = Infinity;
          for (const rwOpt of getRunways(near)) {
            const diff = Math.abs(((rwOpt.heading - state.yaw + Math.PI) % (Math.PI * 2)) - Math.PI);
            if (diff < bestDiff) { bestDiff = diff; bestRw = rwOpt; }
          }
          if (bestRw) {
            atcSay('TURM', `${near.name}, frei zur Landung, Bahn ${runwayNumber(bestRw.heading)}.`);
            atc.clearedLandingFor = near.id;
          }
        } else {
          // Runway besetzt — Warteschleife anweisen
          const q = atcQueueFor(near.id);
          const pos = q.indexOf('player') + 1;
          atcSay('TURM', `${state.spec.name}, Warteschleife über ${near.name}. Bahn besetzt (Position ${pos}).`);
          atc.clearedLandingFor = 'holding_' + near.id;
        }
      }
    }
    if (!near || dist > 6000) {
      if (atc.clearedLandingFor) {
        // Spieler fliegt weg — aus Schlange entfernen
        const apId = atc.clearedLandingFor.replace('holding_', '');
        atcClearLanded('player', apId);
      }
      atc.clearedLandingFor = null;
    }
  }
}

// ============================================================
// ATC Landeschlangen-System (ergänzt bestehende ATC-Funktionen)
// ============================================================
const ATC_QUEUE = {}; // airportId → [craftId, ...]

function atcQueueFor(apId) {
  if (!ATC_QUEUE[apId]) ATC_QUEUE[apId] = [];
  return ATC_QUEUE[apId];
}

/** Reiht craft in Landeschlange für apId ein; gibt true zurück wenn sofort freigegeben */
function atcRequestLanding(craftId, apId) {
  const q = atcQueueFor(apId);
  if (!q.includes(craftId)) q.push(craftId);
  return q[0] === craftId;
}

/** Entfernt craft aus Landeschlange und benachrichtigt den Nächsten */
function atcClearLanded(craftId, apId) {
  const q = atcQueueFor(apId);
  const idx = q.indexOf(craftId);
  if (idx === -1) return;
  q.splice(idx, 1);
  if (q.length > 0) {
    const nextId = q[0];
    if (nextId === 'player') {
      const ap = apById(apId);
      atcSay('TURM', `${state.spec.name}, Bahn frei auf ${ap.name}. Sie sind freigegeben zur Landung.`);
      state.atc.clearedLandingFor = apId;
    } else {
      const next = AI_AIRCRAFT.find(a => a.id === nextId);
      if (next) {
        next.atcCleared = true;
        next.state = 'approach';
        atcSay('TURM', `${next.spec.name}, Warteschleife beendet. Frei zur Landung auf ${apById(apId).name}.`);
      }
    }
  }
}

// ============================================================
// KI-Flugzeuge — Autonomer Luftverkehr
// ============================================================
const AI_AIRCRAFT = [];
let _aiIdSeq = 0;
// Typen-Reihenfolge für die 7 KI-Maschinen
const AI_SPEC_ORDER = ['kolibri', 'courier', 'airliner', 'albatros', 'falke', 'otter', 'courier', 'kolibri'];

function _createAIMesh(spec) {
  const built = createAircraftMesh(spec);
  scene.add(built.group);
  return built;
}

function spawnAIAt(fromAp) {
  const specId = AI_SPEC_ORDER[_aiIdSeq % AI_SPEC_ORDER.length];
  const spec = PLANES.find(p => p.id === specId) || PLANES[0];
  const built = _createAIMesh(spec);
  const rw = getRunways(fromAp)[0];
  const sx = rw.x + (Math.random() - 0.5) * rw.w * 0.5;
  const sz = rw.z + (Math.random() - 0.5) * rw.w * 0.5;
  const ai = {
    id: 'ai_' + (_aiIdSeq++),
    spec,
    group: built.group,
    propellers: built.propellers,
    pos: new THREE.Vector3(sx, groundAt(sx, sz) + 2, sz),
    yaw: rw.heading + (Math.random() - 0.5) * 0.4,
    pitch: 0, roll: 0,
    speed: 0, vSpeed: 0,
    state: 'parked',
    fromAp, toAp: null,
    waitTimer: 3 + Math.random() * 18,
    holdAngle: Math.random() * Math.PI * 2,
    atcCleared: false,
    cruiseAlt: 850 + Math.random() * 1000,
  };
  AI_AIRCRAFT.push(ai);
  return ai;
}

function initAIAircraft() {
  const aps = AIRPORTS.filter(a => a.id !== state.home);
  // Verteile KI gleichmäßig über verschiedene Flughäfen
  for (let i = 0; i < AI_SPEC_ORDER.length; i++) {
    spawnAIAt(aps[i % aps.length]);
  }
}

function _aiPickDest(ai) {
  const opts = AIRPORTS.filter(a => a.id !== ai.fromAp.id);
  return opts[Math.floor(Math.random() * opts.length)];
}

/** Winkel-Differenz von a nach b in [-π, π] */
function _angleDiff(a, b) {
  return ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

function _bearingTo(fx, fz, tx, tz) {
  return Math.atan2(-(tx - fx), -(tz - fz));
}

function _lerpYaw(current, target, rate, dt) {
  return current + _angleDiff(current, target) * Math.min(1, rate * dt);
}

function _updateSingleAI(ai, dt) {
  const p = ai.spec;

  switch (ai.state) {

    case 'parked':
      ai.speed = 0;
      ai.waitTimer -= dt;
      if (ai.waitTimer <= 0) {
        ai.toAp = _aiPickDest(ai);
        ai.state = 'takeoff';
        atcSay('TURM', `${p.name} startet von ${ai.fromAp.name} nach ${ai.toAp.name}.`);
      }
      break;

    case 'takeoff': {
      // Entlang der Runway-Achse beschleunigen
      const rw = getRunways(ai.fromAp)[0];
      ai.yaw = rw.heading;
      ai.speed = Math.min(p.vs * 1.3, ai.speed + p.thrust * 0.75 * dt);
      ai.pos.x -= Math.sin(ai.yaw) * ai.speed * dt;
      ai.pos.z += Math.cos(ai.yaw) * ai.speed * dt;
      ai.pos.y = groundAt(ai.pos.x, ai.pos.z) + 2;
      if (ai.speed >= p.vs * 1.18) {
        ai.pitch = 0.22;
        ai.state = 'climb';
      }
      break;
    }

    case 'climb': {
      ai.speed = Math.min(p.vmax * 0.82, ai.speed + dt * 4);
      ai.pitch = 0.18;
      ai.pos.x -= Math.sin(ai.yaw) * ai.speed * dt;
      ai.pos.z += Math.cos(ai.yaw) * ai.speed * dt;
      ai.pos.y += ai.speed * Math.sin(ai.pitch) * dt;
      // Schon zum Ziel drehen
      if (ai.toAp) {
        const bearing = _bearingTo(ai.pos.x, ai.pos.z, ai.toAp.x, ai.toAp.z);
        ai.yaw = _lerpYaw(ai.yaw, bearing, 0.8, dt);
      }
      if (ai.pos.y >= ai.cruiseAlt) {
        ai.pitch = 0;
        ai.state = 'enroute';
      }
      break;
    }

    case 'enroute': {
      const dest = ai.toAp;
      const bearing = _bearingTo(ai.pos.x, ai.pos.z, dest.x, dest.z);
      ai.yaw = _lerpYaw(ai.yaw, bearing, 1.2, dt);
      ai.speed = THREE.MathUtils.lerp(ai.speed, p.vmax * 0.82, dt * 0.4);
      ai.pitch = 0;
      ai.pos.x -= Math.sin(ai.yaw) * ai.speed * dt;
      ai.pos.z += Math.cos(ai.yaw) * ai.speed * dt;
      // Reisehöhe halten
      const altErr = ai.cruiseAlt - ai.pos.y;
      ai.pos.y += Math.sign(altErr) * Math.min(Math.abs(altErr), 40 * dt);
      const dist = Math.hypot(dest.x - ai.pos.x, dest.z - ai.pos.z);
      if (dist < 5500) ai.state = 'approach_req';
      break;
    }

    case 'approach_req': {
      // Landeerlaubnis anfragen
      const cleared = atcRequestLanding(ai.id, ai.toAp.id);
      if (cleared) {
        ai.atcCleared = true;
        ai.state = 'approach';
        atcSay('TURM', `${p.name}, frei zur Landung auf ${ai.toAp.name}.`);
      } else {
        ai.state = 'holding';
        const q = atcQueueFor(ai.toAp.id);
        const pos = q.indexOf(ai.id) + 1;
        atcSay('TURM', `${p.name}, Warteschleife über ${ai.toAp.name}. Position ${pos}.`);
      }
      break;
    }

    case 'holding': {
      // Rechtskurve in 1800m Radius über dem Zielflughafen, 600m AGL
      const holdAlt = (ai.toAp.elev || 0) + 600;
      const holdR = 1800;
      ai.holdAngle += (ai.speed / holdR) * dt;
      ai.pos.x = ai.toAp.x + Math.cos(ai.holdAngle) * holdR;
      ai.pos.z = ai.toAp.z + Math.sin(ai.holdAngle) * holdR;
      // Yaw senkrecht zur Kreisrichtung (fliegt im Kreis)
      ai.yaw = ai.holdAngle + Math.PI / 2;
      ai.speed = THREE.MathUtils.lerp(ai.speed, p.vs * 1.55, dt * 0.4);
      const altE = holdAlt - ai.pos.y;
      ai.pos.y += Math.sign(altE) * Math.min(Math.abs(altE), 25 * dt);
      // Prüfen ob jetzt freigegeben
      if (ai.atcCleared) ai.state = 'approach';
      break;
    }

    case 'approach': {
      const dest = ai.toAp;
      const rw = getRunways(dest)[0];
      const dist = Math.hypot(rw.x - ai.pos.x, rw.z - ai.pos.z);
      const bearing = _bearingTo(ai.pos.x, ai.pos.z, rw.x, rw.z);
      ai.yaw = _lerpYaw(ai.yaw, bearing, 2.2, dt);
      ai.speed = THREE.MathUtils.lerp(ai.speed, p.vs * 1.35, dt * 0.7);
      // Gleitpfad: 5% Neigung zum Runway
      const targetAlt = Math.max((dest.elev || 0) + 2, (dest.elev || 0) + dist * 0.055);
      const altDiff = targetAlt - ai.pos.y;
      ai.pos.y += altDiff * Math.min(1, dt * 0.55);
      ai.pitch = THREE.MathUtils.clamp((targetAlt - ai.pos.y) * 0.008, -0.18, 0.1);
      ai.pos.x -= Math.sin(ai.yaw) * ai.speed * dt;
      ai.pos.z += Math.cos(ai.yaw) * ai.speed * dt;
      // Aufgesetzt?
      if (dist < 80 || ai.pos.y <= (dest.elev || 0) + 3) {
        ai.pos.set(rw.x, groundAt(rw.x, rw.z) + 2, rw.z);
        ai.speed = 0; ai.pitch = 0; ai.roll = 0;
        ai.state = 'landed';
        ai.waitTimer = 4 + Math.random() * 16;
        atcClearLanded(ai.id, dest.id);
        atcSay('TURM', `${p.name} gelandet auf ${dest.name}.`);
      }
      break;
    }

    case 'landed':
      ai.waitTimer -= dt;
      if (ai.waitTimer <= 0) {
        ai.fromAp = ai.toAp;
        ai.toAp = null;
        ai.atcCleared = false;
        ai.state = 'parked';
        ai.waitTimer = 5 + Math.random() * 20;
      }
      break;
  }
}

let _aiWarnCooldown = 0;

function updateAIAircraft(dt) {
  for (const ai of AI_AIRCRAFT) {
    _updateSingleAI(ai, dt);
    // Three.js Gruppe synchronisieren
    ai.group.position.copy(ai.pos);
    ai.group.rotation.set(ai.pitch, -ai.yaw, -ai.roll, 'YXZ');
    // Propeller drehen
    const propSpeed = (ai.state === 'parked' || ai.state === 'landed') ? 1.5 : 18 + ai.speed * 0.25;
    for (const prop of ai.propellers) prop.rotation.z += dt * propSpeed;
  }

  // Spieler-Kollisionswarnung
  if (state.mode === 'flying') {
    _aiWarnCooldown -= dt;
    for (const ai of AI_AIRCRAFT) {
      const d = ai.pos.distanceTo(state.pos);
      if (d < 350 && _aiWarnCooldown <= 0) {
        atcSay('TURM', `⚠️ Verkehr! ${ai.spec.name} bei ${Math.round(d)} m.`);
        _aiWarnCooldown = 9;
        break;
      }
    }
  }
}

// ---------------- Kamera ----------------
const camPos = new THREE.Vector3(0, 400, 600);
function updateCamera(dt) {
  const size = state.spec.heavy ? 1.6 : 1;
  const back = (state.camMode === 0 ? 34 : 68) * size;
  const up = (state.camMode === 0 ? 11 : 24) * size;
  tmpV.copy(fwd).multiplyScalar(-back);
  const desired = state.pos.clone().add(tmpV).add(new THREE.Vector3(0, up, 0));
  if (camPos.distanceToSquared(desired) > 4_000_000) camPos.copy(desired);
  else camPos.lerp(desired, Math.min(1, dt * 3.6));
  const th = groundAt(camPos.x, camPos.z);
  if (camPos.y < th + 5) camPos.y = th + 5;
  camera.position.copy(camPos);
  if (state.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * state.shake * 2.5;
    camera.position.y += (Math.random() - 0.5) * state.shake * 2.5;
  }
  camera.up.set(Math.sin(state.roll * 0.28), Math.cos(state.roll * 0.28), 0); // leichte Rollneigung — cineastisch
  camera.lookAt(state.pos);

  const targetFov = 62 + 9 * Math.min(1, state.speed / (state.spec.vmax * 1.25));
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 2);
    camera.updateProjectionMatrix();
  }
}

// ---------------- Hauptschleife ----------------
const nextFrame = cb => document.hidden ? setTimeout(() => cb(performance.now()), 33) : requestAnimationFrame(cb);
let lastT = performance.now();
let worldReady = false;

function loop(now) {
  nextFrame(loop);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const t = now * 0.001;

  // Echte Gelände-/Satellitenkacheln rund um Home/Spieler nachladen.
  updateVisibleTiles();

  // Aktualisiere Tag/Nacht-Zyklus
  if (state.mode === 'flying') {
    updateDayNightCycle(dt);
    updateLighting();
  }

  const skyMesh = scene.getObjectByName('sky');
  if (skyMesh) skyMesh.position.copy(camera.position);

  if (state.mode === 'flying') {
    updateFlight(dt);
    if (planeGroup) {
      planeGroup.position.copy(state.pos);
      planeGroup.rotation.set(state.pitch, state.yaw, -state.roll, 'YXZ');
      for (const pr of propellers) pr.rotation.z += state.throttle * 42 * dt + dt * 2;
    }
    updateCamera(dt);
    updateHUD();
    drawMinimap();
    water.position.set(state.pos.x, 0, state.pos.z);
    updateWaves(t, state.pos.x, state.pos.z);
  }
  // KI-Flugzeuge immer aktualisieren (auch im Menü — sie fliegen im Hintergrund)
  if (worldReady) updateAIAircraft(dt);
  else {
    // Menü: langsame Kamerafahrt um die Hauptinsel
    const a = t * 0.05;
    const home = apById(state.home);
    camera.up.set(0, 1, 0);
    camera.position.set(home.x + Math.cos(a) * 2600, 900, home.z + Math.sin(a) * 2600);
    camera.lookAt(home.x, 150, home.z);
    water.position.set(camera.position.x, 0, camera.position.z);
    updateWaves(t, camera.position.x, camera.position.z);
  }
  updateClouds(dt);
  updateBeacon(t);
  updateAudio();
  renderer.render(scene, camera);
}

function updateLighting() {
  const colors = getLightColors();
  sun.color.copy(colors.sunColor);
  scene.fog.color.setHex(0xe9c9a2).lerp(new THREE.Color(0x4a3a2a), 1 - (colors.ambientLight / 0.55));
  
  if (!cachedAmbLight) cachedAmbLight = scene.children.find(c => c instanceof THREE.AmbientLight);
  if (cachedAmbLight) cachedAmbLight.intensity = colors.ambientLight * 0.15;
  
  if (!cachedHemLight) cachedHemLight = scene.children.find(c => c instanceof THREE.HemisphereLight);
  if (cachedHemLight) {
    // HINWEIS: THREE.HemisphereLight nutzt die Eigenschaft "color" (nicht "skyColor")
    // für die Himmelsfarbe. Zusätzliche Absicherung mit optional chaining,
    // damit ein fehlendes Property den Render-Loop nicht mehr crasht.
    if (cachedHemLight.color) cachedHemLight.color.copy(colors.skyZenith);
    else if (cachedHemLight.skyColor) cachedHemLight.skyColor.copy(colors.skyZenith);
    if (cachedHemLight.groundColor) cachedHemLight.groundColor.copy(colors.hemLightGround);
  }
  
  // Runway-Lichter bei Nacht sichtbarer machen
  const rwLights = scene.getObjectByName('runwayLights');
  if (rwLights && rwLights.material) {
    const nightFactor = Math.max(0, 1 - DAYNIGHT.timeOfDay * 0.5 - (1 - DAYNIGHT.timeOfDay) * 0.5);
    rwLights.material.emissiveIntensity = nightFactor * 1.5;
  }
}

// ---------------- Boot ----------------
document.getElementById('btn-fly').disabled = true;
setTimeout(() => {
  initAirportElevations();
  updateVisibleTiles();
  buildAirports();
  buildClouds();
  prerenderMap();
  buildPlaneMesh(PLANES.find(p => p.id === save.selected) || PLANES[0]);
  state.spec = PLANES.find(p => p.id === save.selected) || PLANES[0];
  resetToAirport(state.home);
  initAIAircraft();
  worldReady = true;
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('btn-fly').disabled = false;
}, 30); // Menü sofort zeigen, Welt direkt danach bauen

renderHangar();
showOnly('menu');
nextFrame(loop);
