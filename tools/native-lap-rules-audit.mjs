import fs from 'node:fs';

const file = process.argv[2] || '/private/tmp/gridline-final-rules-runtime.log';
if (!fs.existsSync(file)) {
  console.error(`FAIL missing runtime log: ${file}`);
  process.exit(1);
}

const text = fs.readFileSync(file, 'utf8');
const probes = ['wrong_way', 'track_limits', 'checkpoint_skip', 'physical_shortcut', 'reset_state', 'invalid_lap_excluded'];
for (const probe of probes) {
  if (!text.includes(`Gridline rules QA PASS ${probe}`)) {
    console.error(`FAIL missing runtime pass: ${probe}`);
    process.exitCode = 1;
  }
}

if (text.includes('Gridline rules QA FAIL')) {
  console.error('FAIL runtime rules harness reported a failure');
  process.exitCode = 1;
}

if (process.exitCode) process.exit();
console.log(`Lap-rules runtime audit passed · ${probes.join(' · ')} · ${file}`);
