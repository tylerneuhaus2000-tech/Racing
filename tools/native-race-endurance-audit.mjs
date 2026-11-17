import fs from 'node:fs';

const raceFile = process.argv[2] || '/private/tmp/gridline-race-endurance-direction-fix-1.log';

if (!fs.existsSync(raceFile)) {
  console.error(`FAIL missing runtime log: ${raceFile}`);
  process.exit(1);
}

const race = fs.readFileSync(raceFile, 'utf8');
const checks = [
  ['official clockwise configuration', /officialDirection=clockwise centerlineTraversal=source-order/.test(race)],
  ['race starts after countdown', /Gridline race countdown 1/.test(race)
    && /Gridline race GREEN track=Silverstone GP/.test(race)],
  ['player completes two valid laps', /Gridline lap completed #1: .*valid=True/.test(race)
    && /Gridline lap completed #2: .*valid=True/.test(race)
    && /validCount=2 invalidCount=0/.test(race)],
  ['AI 1 completes two laps', (race.match(/Gridline race AI lap driver=AI 1 lap=[12]/g) || []).length >= 2],
  ['AI 2 completes two laps', (race.match(/Gridline race AI lap driver=AI 2 lap=[12]/g) || []).length >= 2],
  ['race result contains two laps and all participants', /laps=2 .*aiFinished=2\/2 status=all_ai_finished/.test(race)],
  ['AI recovery reset count is zero', /aiResets=0/.test(race)],
  ['race QA completes successfully', /Gridline race QA PASS .*laps=2 .*aiFinished=2 .*aiResets=0/.test(race)]
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
  if (!passed) failed += 1;
}

const forbidden = [
  ['race QA failure', race.includes('Gridline race QA failure')],
  ['AI recovery reset event', race.includes('Gridline race AI event class=AI_DRIVER reason=reset')],
  ['runtime error', /\b(?:NullReferenceException|MissingReferenceException|ArgumentException)\b/.test(race)]
];
for (const [label, present] of forbidden) {
  console.log(`${present ? 'FAIL' : 'PASS'} ${label}`);
  if (present) failed += 1;
}

const contactEvents = (race.match(/Gridline race AI event class=AI_DRIVER/g) || []).length;
console.log(`INFO transient AI driver/contact events=${contactEvents} (reported, not silently discarded)`);

if (failed) process.exit(1);
console.log(`Native two-lap race endurance audit passed\n  race=${raceFile}`);
