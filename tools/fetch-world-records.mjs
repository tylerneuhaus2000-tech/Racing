#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';

const project = 'gridline-bf8c9';
const endpoint = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:runQuery`;
const context = vm.createContext({});
for (const file of ['assets/tracks.js','assets/tracks/redbull-ring.js','assets/tracks/monza-mesh.js','assets/tracks/sachsenring.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, {filename:file});
}
const tracks = vm.runInContext('TRACKS.map(t=>({id:t.id,name:t.name,kartOnly:!!t.kartOnly}))', context);

function value(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  return null;
}

const records = [];
for (const track of tracks) {
  const body = {structuredQuery:{
    from:[{collectionId:'times'}],
    where:{fieldFilter:{field:{fieldPath:'trackId'},op:'EQUAL',value:{stringValue:track.id}}},
    limit:500
  }};
  const response = await fetch(endpoint, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  if (!response.ok) throw new Error(`${track.id}: Firestore HTTP ${response.status}`);
  const rows = await response.json();
  const best = new Map();
  for (const row of rows) {
    const fields = row.document?.fields;
    if (!fields) continue;
    const classType = String(value(fields.classType) || 'unknown').toLowerCase();
    const timeMs = value(fields.timeMs);
    if (!Number.isFinite(timeMs) || timeMs <= 0) continue;
    const item = {trackId:track.id,trackName:track.name,classType,timeMs,
      time:+(timeMs/1000).toFixed(3),carId:value(fields.carId),carName:value(fields.carName),driver:value(fields.name),
      updatedAt:value(fields.updatedAt)};
    if (!best.has(classType) || timeMs < best.get(classType).timeMs) best.set(classType,item);
  }
  records.push(...best.values());
}
records.sort((a,b)=>a.trackName.localeCompare(b.trackName)||a.classType.localeCompare(b.classType));
const output = process.argv[2];
if (output) fs.writeFileSync(output, JSON.stringify(records,null,2)+'\n');
console.log(JSON.stringify(records,null,2));
