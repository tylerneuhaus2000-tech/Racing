#!/usr/bin/env node
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const three = process.argv[2];
const recordsFile = process.argv[3] || '/tmp/gridline-world-records.json';
const outputFile = process.argv[4];
if (!three) throw new Error('Usage: node tools/compare-ai-world-records.mjs THREE_FILE [records.json] [output.json]');
const records = JSON.parse(fs.readFileSync(recordsFile, 'utf8'))
  .filter(r => r.classType !== 'unknown');
const results = [];
for (const [index, record] of records.entries()) {
  process.stderr.write(`[${index+1}/${records.length}] ${record.trackId} / ${record.carId}\n`);
  const run = spawnSync(process.execPath,
    ['tools/ai-drive-audit.cjs', three, record.trackId, '1600', '1'], {
      cwd:process.cwd(), encoding:'utf8', maxBuffer:10*1024*1024,
      env:{...process.env,AI_CAR:record.carId,AI_DIFFICULTY:'100'}
    });
  const line=(run.stdout||'').split('\n').find(v=>v.startsWith('{"track"'));
  if (!line) {
    results.push({...record,error:(run.stderr||`audit exit ${run.status}`).trim()});
    continue;
  }
  const car=JSON.parse(line).cars[0];
  const gap=car.bestLap-record.time;
  results.push({...record,aiBest:car.bestLap,aiLaps:car.lapTimes,
    gap:+gap.toFixed(3),gapPct:+(gap/record.time*100).toFixed(1),
    onWrPace:gap<=record.time*0.03,offPct:car.offPct,walls:car.walls});
}
if (outputFile) fs.writeFileSync(outputFile,JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
if (results.some(r=>r.error)) process.exitCode=1;
