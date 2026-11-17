import fs from 'node:fs';

const file = process.argv[2] || '/private/tmp/gridline-time-trial-restart-runtime.log';
if (!fs.existsSync(file)) {
  console.error(`FAIL missing time-trial restart runtime log: ${file}`);
  process.exit(1);
}

const text = fs.readFileSync(file, 'utf8');
const checks = [
  ['session started', /Gridline time trial started session=1/],
  ['reset requested by QA probe', /Gridline time trial restart QA reset requested/],
  ['reset classified as session restart', /Gridline time trial restarted session=1 reason=vehicle_reset/],
  ['restart QA completed', /Gridline time trial restart QA PASS session=1 resetCount=/],
  ['official clockwise configuration', /officialDirection=clockwise centerlineTraversal=source-order/]
];

const failed = checks.filter(([, pattern]) => !pattern.test(text));
for (const [label, pattern] of checks) console.log(`${pattern.test(text) ? 'PASS' : 'FAIL'} ${label}`);
if (text.includes('Gridline QA lap failure') || text.includes('Gridline QA failure')) {
  console.error('FAIL time-trial restart runtime reported a QA failure');
  process.exit(1);
}
if (failed.length) process.exit(1);
console.log(`Time-trial restart runtime audit passed · ${file}`);
