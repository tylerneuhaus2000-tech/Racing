#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const gt3Path = path.join(root, 'gt3-web-racer.html');
const tracksDir = path.join(root, 'assets', 'tracks');
const assetBudgetBytes = 50 * 1024 * 1024;

const warnings = [];
const errors = [];

function warn(msg) { warnings.push(msg); }
function fail(msg) { errors.push(msg); }

function checkGt3InlineScripts() {
  if (!fs.existsSync(gt3Path)) {
    fail('Missing gt3-web-racer.html');
    return;
  }

  const html = fs.readFileSync(gt3Path, 'utf8');
  const regex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let idx = 0;

  while ((match = regex.exec(html)) !== null) {
    idx += 1;
    const scriptBody = (match[1] || '').trim();
    if (!scriptBody) continue;
    const tmp = path.join(root, `.tmp.gt3.inline.${idx}.js`);
    fs.writeFileSync(tmp, scriptBody, 'utf8');
    const out = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
    fs.unlinkSync(tmp);
    if (out.status !== 0) {
      fail(`Inline script #${idx} failed syntax check.`);
      const stderr = (out.stderr || '').trim();
      if (stderr) fail(stderr);
    }
  }

  if (idx === 0) warn('No inline scripts found in gt3-web-racer.html.');

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const criticalIds = [
    'pit-interact-hint', 'pit-interact-key', 'pit-setup-overlay',
    'pso-pb-s1', 'pso-pb-s2', 'pso-pb-s3', 'pso-wr-lap', 'pso-wr-gap'
  ];
  criticalIds.forEach((id) => {
    const count = ids.filter((candidate) => candidate === id).length;
    if (count !== 1) fail(`Critical UI id ${id} occurs ${count} times; expected exactly once.`);
  });

  const defaultBlock = html.match(/const defaultKeybinds\s*=\s*\{([\s\S]*?)\};/);
  if (!defaultBlock) {
    fail('Could not find defaultKeybinds.');
  } else {
    const assignments = [...defaultBlock[1].matchAll(/(\w+)\s*:\s*'([^']+)'/g)];
    const byCode = new Map();
    assignments.forEach(([, action, code]) => {
      if (!byCode.has(code)) byCode.set(code, []);
      byCode.get(code).push(action);
    });
    for (const [code, actions] of byCode) {
      if (actions.length > 1) fail(`Default key conflict on ${code}: ${actions.join(', ')}`);
    }
  }

  for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/gi)) {
    const src = match[1].split('?')[0];
    if (/^(?:https?:)?\/\//i.test(src)) continue;
    const localPath = path.join(root, src.replace(/^\//, ''));
    if (!fs.existsSync(localPath)) fail(`Missing local script asset: ${src}`);
  }
}

function closureDistance(track) {
  const pts = track.pts;
  if (!Array.isArray(pts) || pts.length < 2) return null;
  const a = pts[0];
  const b = pts[pts.length - 1];
  if (!Array.isArray(a) || !Array.isArray(b)) return null;
  const dx = Number(a[0]) - Number(b[0]);
  const dy = Number(a[1]) - Number(b[1]);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  return Math.sqrt(dx * dx + dy * dy);
}

function checkTrackFile(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    fail(`Track file is not valid JSON: ${path.relative(root, filePath)} (${e.message})`);
    return;
  }

  /* JSON files in assets/tracks are either playable track bundles, generated
     centerlines, or raw OSM source data. Validate each schema on its own. */
  if (Array.isArray(parsed?.elements) || (parsed?.osm3s && Number(parsed?.version) > 0)) {
    if (!Array.isArray(parsed.elements) || parsed.elements.length === 0)
      fail(`OSM source has no elements: ${path.relative(root, filePath)}`);
    return;
  }

  if (Array.isArray(parsed?.pts)) {
    const label = path.basename(filePath);
    if (parsed.pts.length < 120) warn(`Low centerline point count (${parsed.pts.length}) in ${label}.`);
    const invalidPt = parsed.pts.find((p) => !Array.isArray(p) || p.length < 2 || !Number.isFinite(Number(p[0])) || !Number.isFinite(Number(p[1])));
    if (invalidPt) fail(`Invalid centerline point tuple in ${label}`);
    if (!parsed.name) warn(`Centerline has no name: ${label}`);
    return;
  }

  if (!parsed || !Array.isArray(parsed.tracks) || parsed.tracks.length === 0) {
    warn(`Unknown track JSON schema: ${path.relative(root, filePath)}`);
    return;
  }

  parsed.tracks.forEach((t, i) => {
    const label = `${path.basename(filePath)}#${i}:${t?.id || 'unknown'}`;
    const required = ['id', 'name', 'halfWidth', 'wallDist', 'vergeW', 'pts'];
    required.forEach((k) => {
      if (!(k in (t || {}))) fail(`Missing key ${k} in ${label}`);
    });

    if (!Array.isArray(t?.pts)) {
      fail(`pts must be array in ${label}`);
      return;
    }

    if (t.pts.length < 120) {
      warn(`Low point count (${t.pts.length}) in ${label}; may cause rough driving.`);
    }

    const invalidPt = t.pts.find((p) => !Array.isArray(p) || p.length < 2 || !Number.isFinite(Number(p[0])) || !Number.isFinite(Number(p[1])));
    if (invalidPt) fail(`Invalid point tuple in ${label}`);

    const c = closureDistance(t);
    if (c != null && c > 120) {
      warn(`Large start/end closure gap (${c.toFixed(1)}m) in ${label}; verify loop continuity.`);
    }
  });
}

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.firebase') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

function checkAssetBudgets() {
  const assets = path.join(root, 'assets');
  if (!fs.existsSync(assets)) return;
  for (const file of walkFiles(assets)) {
    const size = fs.statSync(file).size;
    if (size > assetBudgetBytes) {
      warn(`Large web asset ${(size / 1024 / 1024).toFixed(1)} MiB: ${path.relative(root, file)}`);
    }
  }
}

function checkTracks() {
  if (!fs.existsSync(tracksDir)) {
    fail('Missing assets/tracks directory');
    return;
  }

  const entries = fs.readdirSync(tracksDir, { withFileTypes: true });
  const jsonFiles = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.json'))
    .map((e) => path.join(tracksDir, e.name));

  if (jsonFiles.length === 0) {
    warn('No JSON tracks found in assets/tracks.');
    return;
  }

  jsonFiles.forEach(checkTrackFile);
}

checkGt3InlineScripts();
checkTracks();
checkAssetBudgets();

console.log('GT3 preflight audit finished.');
if (warnings.length) {
  console.log('\nWarnings:');
  warnings.forEach((w) => console.log(`- ${w}`));
}
if (errors.length) {
  console.log('\nErrors:');
  errors.forEach((e) => console.log(`- ${e}`));
  process.exit(1);
}
console.log('\nStatus: PASS');
