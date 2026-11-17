import fs from 'node:fs';

const file = process.argv[2] || '/private/tmp/gridline-grass-regression.log';
const report = fs.readFileSync(file, 'utf8');
const result = report.match(
  /Gridline grass QA PASS:.*?surfaceSeen=(True|False).*?activeMinLocalV=([\d.-]+).*?activeMinRearTireFx=([\d.-]+).*?classification=([A-Z_]+)/
);
// The first fixed steps after ResetForQa are a suspension-settling warmup.
// Judge the active throttle probe, matching the runtime QA's own acceptance
// criteria, instead of treating that expected transient as propulsion.
const pass = result != null
  && result[1] === 'True'
  && Number(result[2]) > -0.25
  && Number(result[3]) > -1
  && result[4] === 'NONE';
if (!pass) {
  console.error(`Grass regression audit failed: ${file}`);
  process.exit(1);
}
console.log(`Grass regression audit passed: ${file}`);
