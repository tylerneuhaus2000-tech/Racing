#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const projectRoot = path.join(root, 'unreal', 'GridlineRacing');
const requiredFiles = [
  'GridlineRacing.uproject',
  'Config/DefaultEngine.ini',
  'Config/DefaultGame.ini',
  'Config/DefaultScalability.ini',
  'Source/GridlineRacing/GridlineRacing.Build.cs',
  'Source/GridlineRacing/GridlineRacing.cpp',
  'Source/GridlineRacing/GridlineRacing.h',
  'Source/GridlineRacing.Target.cs',
  'Source/GridlineRacingEditor.Target.cs',
  'Content/IMPORT_MANIFEST.md'
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(projectRoot, file)));
if (missing.length) {
  console.error(`Missing Unreal project files: ${missing.join(', ')}`);
  process.exit(1);
}

const project = JSON.parse(fs.readFileSync(path.join(projectRoot, 'GridlineRacing.uproject'), 'utf8'));
const module = project.Modules?.find((entry) => entry.Name === 'GridlineRacing');
const plugins = new Set((project.Plugins || []).filter((entry) => entry.Enabled).map((entry) => entry.Name));
const targets = new Set(project.TargetPlatforms || []);
const manifest = fs.readFileSync(path.join(projectRoot, 'Content/IMPORT_MANIFEST.md'), 'utf8');

const failures = [];
if (!module || module.Type !== 'Runtime' || module.LoadingPhase !== 'Default') failures.push('runtime module');
for (const plugin of ['EnhancedInput', 'ChaosVehicles']) {
  if (!plugins.has(plugin)) failures.push(`plugin ${plugin}`);
}
for (const target of ['Windows', 'Mac', 'IOS']) {
  if (!targets.has(target)) failures.push(`target ${target}`);
}
for (const source of ['assets/tracks/silverstone_gp.glb', 'assets/models/ferrari_296_gt3.glb']) {
  if (!fs.existsSync(path.join(root, source))) failures.push(`source asset ${source}`);
}
if (/^\s*`assets\/.*barcelona/i.test(manifest)) failures.push('Barcelona must not be in the Unreal import manifest');
if (!/pit functionality stays disabled/i.test(manifest)) failures.push('pit-lane source rule');

if (failures.length) {
  console.error(`Unreal project validation failed: ${failures.join(', ')}`);
  process.exit(1);
}

console.log('Unreal project validation passed (static; UE5 editor compile still required).');
