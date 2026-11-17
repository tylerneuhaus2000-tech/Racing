import fs from 'node:fs';

const file = process.argv[2] || '/private/tmp/gridline-time-trial-runtime.log';
if (!fs.existsSync(file)) {
  console.error(`FAIL missing time-trial runtime log: ${file}`);
  process.exit(1);
}

const text = fs.readFileSync(file, 'utf8');
const checks = [
  ['session started', /Gridline time trial started session=1/],
  ['valid result recorded', /Gridline time trial result lap=1 .*valid=True .*validCount=1/],
  ['qa completion', /Gridline time trial QA PASS validCount=1/],
  ['official clockwise configuration', /officialDirection=clockwise centerlineTraversal=source-order/]
];

const failed = checks.filter(([, pattern]) => !pattern.test(text));
for (const [label, pattern] of checks) console.log(`${pattern.test(text) ? 'PASS' : 'FAIL'} ${label}`);
if (text.includes('Gridline QA lap failure') || text.includes('Gridline QA failure')) {
  console.error('FAIL time-trial runtime reported a QA failure');
  process.exit(1);
}
if (failed.length) process.exit(1);
console.log(`Time-trial runtime audit passed · ${file}`);
