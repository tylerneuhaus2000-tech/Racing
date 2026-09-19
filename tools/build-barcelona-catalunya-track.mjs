#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const glbPath = path.join(root, 'assets', 'tracks', 'barcelona_catalunya_2023_layout.glb');
const outPath = path.join(root, 'assets', 'tracks', 'barcelona-catalunya-2023.js');

const CONTROL_POINTS = [
  [298, -95], [230, 5], [156, 105], [108, 195], [50, 300], [5, 380],
  [-60, 490], [-180, 500], [-300, 505], [-420, 515], [-490, 470],
  [-505, 380], [-470, 285], [-410, 190], [-340, 110], [-265, 95],
  [-210, 145], [-210, 245], [-250, 340], [-295, 405], [-225, 415],
  [-110, 380], [0, 315], [85, 230], [55, 155], [-25, 80], [-75, 0],
  [-125, -75], [-120, -135], [-45, -185], [70, -230], [175, -270],
  [275, -310], [175, -350], [95, -410], [78, -475], [128, -525],
  [225, -525], [315, -470], [390, -420], [455, -380], [420, -330],
  [400, -270], [360, -205], [330, -150]
];

const PIT_PATH = [
  [444, -366], [415, -308], [380, -240], [343, -172], [306, -103],
  [269, -35], [229, 32], [186, 69]
];

function parseGlb(filePath) {
  const data = fs.readFileSync(filePath);
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.slice(20, 20 + jsonLength).toString('utf8'));
  const binHeader = 20 + jsonLength;
  const binType = data.toString('ascii', binHeader + 4, binHeader + 8);
  if (binType !== 'BIN\0') throw new Error(`${filePath} has no BIN chunk`);
  return { json, data, binStart: binHeader + 8 };
}

const COMPONENTS = {
  5120: { size: 1, read: (buf, off) => buf.readInt8(off) },
  5121: { size: 1, read: (buf, off) => buf.readUInt8(off) },
  5122: { size: 2, read: (buf, off) => buf.readInt16LE(off) },
  5123: { size: 2, read: (buf, off) => buf.readUInt16LE(off) },
  5125: { size: 4, read: (buf, off) => buf.readUInt32LE(off) },
  5126: { size: 4, read: (buf, off) => buf.readFloatLE(off) }
};

const TYPE_SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function transformPoint(matrix, p) {
  return [
    matrix[0] * p[0] + matrix[4] * p[1] + matrix[8] * p[2] + matrix[12],
    matrix[1] * p[0] + matrix[5] * p[1] + matrix[9] * p[2] + matrix[13],
    matrix[2] * p[0] + matrix[6] * p[1] + matrix[10] * p[2] + matrix[14]
  ];
}

function readAccessor(ctx, accessorIndex, matrix) {
  const { json, data, binStart } = ctx;
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const component = COMPONENTS[accessor.componentType];
  const components = TYPE_SIZE[accessor.type];
  const stride = view.byteStride || component.size * components;
  const base = binStart + (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const out = [];
  for (let i = 0; i < accessor.count; i += 1) {
    const row = [];
    const offset = base + i * stride;
    for (let j = 0; j < components; j += 1) {
      row.push(component.read(data, offset + j * component.size));
    }
    out.push(matrix && components >= 3 ? transformPoint(matrix, row) : row);
  }
  return out;
}

function roadHeightCloud(ctx) {
  const { json } = ctx;
  const node = (json.nodes || []).find((candidate) => Number.isInteger(candidate.mesh));
  const matrix = node?.matrix || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const cloud = [];
  const roadRe = /ROAD_TRACKMAIN|ROAD_TRACKFILL|ROAD_TRACKMAIN_L|ROAD_PATCH|ROAD_SOIL|RDCP|RMBL|WHITE|EDGE|STRP/i;
  const skipRe = /pitla|PITLGT|PIT_MISC|PITLANE-BUILD|YELLOWLINE/i;
  for (const mesh of json.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      const material = json.materials?.[primitive.material]?.name || '';
      if (!roadRe.test(material) || skipRe.test(material)) continue;
      const posIndex = primitive.attributes?.POSITION;
      if (!Number.isInteger(posIndex)) continue;
      const positions = readAccessor(ctx, posIndex, matrix);
      for (let i = 0; i < positions.length; i += 3) {
        const p = positions[i];
        cloud.push({ x: p[0], y: p[1], z: p[2] });
      }
    }
  }
  if (cloud.length < 1000) throw new Error(`Barcelona road height cloud too small: ${cloud.length}`);
  return cloud;
}

function catmull(points, i, t) {
  const p0 = points[(i - 1 + points.length) % points.length];
  const p1 = points[i % points.length];
  const p2 = points[(i + 1) % points.length];
  const p3 = points[(i + 2) % points.length];
  const t2 = t * t;
  const t3 = t2 * t;
  const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t
    + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
    + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
  const z = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t
    + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
    + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
  return [x, z];
}

function densePath(points, stepsPerSegment = 16) {
  const out = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let s = 0; s < stepsPerSegment; s += 1) {
      out.push(catmull(points, i, s / stepsPerSegment));
    }
  }
  return out;
}

function distance(a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  return Math.hypot(dx, dz);
}

function resample(points, targetCount) {
  const cumulative = [0];
  for (let i = 1; i <= points.length; i += 1) {
    cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i % points.length]));
  }
  const total = cumulative[cumulative.length - 1];
  const out = [];
  let cursor = 1;
  for (let n = 0; n < targetCount; n += 1) {
    const d = (n / targetCount) * total;
    while (cursor < cumulative.length - 1 && cumulative[cursor] < d) cursor += 1;
    const a = points[(cursor - 1) % points.length];
    const b = points[cursor % points.length];
    const segLen = cumulative[cursor] - cumulative[cursor - 1] || 1;
    const t = (d - cumulative[cursor - 1]) / segLen;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return { points: out, total };
}

function sampleHeight(cloud, x, z) {
  let best = null;
  let bestDist = Infinity;
  for (const p of cloud) {
    const dx = p.x - x;
    const dz = p.z - z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best?.y ?? 0;
}

function smoothHeights(pts, iterations = 2) {
  let out = pts.map((p) => p.slice());
  for (let iter = 0; iter < iterations; iter += 1) {
    out = out.map((p, i) => {
      const prev = out[(i - 1 + out.length) % out.length][2];
      const next = out[(i + 1) % out.length][2];
      return [p[0], p[1], p[2] * 0.5 + prev * 0.25 + next * 0.25];
    });
  }
  return out;
}

function roundedPoint(p) {
  return [
    Number(p[0].toFixed(2)),
    Number(p[1].toFixed(2)),
    Number(p[2].toFixed(3))
  ];
}

function build() {
  const ctx = parseGlb(glbPath);
  const cloud = roadHeightCloud(ctx);
  const dense = densePath(CONTROL_POINTS);
  const { points, total } = resample(dense, 360);
  const withHeights = points.map(([x, z]) => [x, z, sampleHeight(cloud, x, z) + 0.035]);
  const pts = smoothHeights(withHeights).map(roundedPoint);
  const ys = pts.map((p) => p[2]);
  const pitPath = PIT_PATH.map(([x, z]) => [x, z, Number((sampleHeight(cloud, x, z) + 0.055).toFixed(3))]);

  const track = {
    id: 'barcelona-catalunya-2023',
    name: 'Circuit de Barcelona-Catalunya',
    sub: 'Spanien - Grand-Prix-Layout 2023 - 4,66 km - echtes Hoehenprofil',
    meshUrl: 'assets/tracks/barcelona_catalunya_2023_layout.glb',
    mesh: {
      offset: [0, 0, 0],
      rawSurface: true,
      hideMaterialsAlways: '^(GROOVE1|GROOVE2)$',
      fixAlphaMaterials: 'fence|tree|glass|net|ivy|alpha',
      fixAllBlendMaterials: true,
      light: { sun: 0.96, hemi: 0.84, exposure: 1 }
    },
    halfWidth: 12.5,
    wallDist: 34,
    kerbW: 4.2,
    vergeW: 20,
    queryWindowM: 86,
    sky: 0x9fbedb,
    hill: 0x5e8f4a,
    grass: [0x5b9a46, 0x477f38],
    startFinishPct: 0,
    startGridPct: 0,
    env: 'forest',
    noWalls: true,
    containCars: false,
    visualCarYOffset: 0.12,
    trackLengthM: 4657,
    elevationMinM: 162.7,
    elevationMaxM: 192.3,
    trackLimitFreeRanges: [[0, 1]],
    pitLane: {
      side: -1,
      startPct: 90.8,
      endPct: 7.8,
      innerOff: 41,
      outerOff: 88,
      slowInnerOff: 51,
      slowOuterOff: 76,
      boxStopOff: 62,
      boxRange: [0.36, 0.64],
      pathHalfWidth: 15,
      path: pitPath
    },
    pts,
    aiFullGridPace: true,
    aiWorldPace: true
  };

  const header = '/* Generated from the downloaded Barcelona-Catalunya 2023 GLB and fitted to the 2023 GP route. */';
  const remove = "for (let i=TRACKS.length-1;i>=0;i--) if(TRACKS[i].id==='barcelona-catalunya-2023') TRACKS.splice(i,1);";
  fs.writeFileSync(outPath, `${header}\n${remove}\nTRACKS.push(${JSON.stringify(track)});\n`, 'utf8');
  const minY = Math.min(...ys).toFixed(2);
  const maxY = Math.max(...ys).toFixed(2);
  console.log(`Wrote ${path.relative(root, outPath)} (${pts.length} pts, source path ${total.toFixed(0)}m, y ${minY}..${maxY}m)`);
}

build();
