import fs from 'node:fs';

const timeTrialFile = process.argv[2] || '/private/tmp/gridline-time-trial-direction-fix-3.log';
const raceFile = process.argv[3] || '/private/tmp/gridline-race-direction-fix-2.log';

function read(file) {
  if (!fs.existsSync(file)) {
    console.error(`FAIL missing runtime log: ${file}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8');
}

const timeTrial = read(timeTrialFile);
const race = read(raceFile);
const checks = [
  ['time-trial official clockwise configuration', /officialDirection=clockwise centerlineTraversal=source-order/.test(timeTrial)],
  ['two time-trial laps are valid', /Gridline lap completed #1: .*valid=True/.test(timeTrial)
    && /Gridline lap completed #2: .*valid=True/.test(timeTrial)
    && /validCount=2 invalidCount=0/.test(timeTrial)],
  ['time-trial QA completed after two valid laps', /Gridline QA lap completed: .*validCount=2 invalidCount=0/.test(timeTrial)],
  ['race official clockwise configuration', /officialDirection=clockwise centerlineTraversal=source-order/.test(race)],
  ['race starts after countdown', /Gridline race countdown 1/.test(race) && /Gridline race GREEN track=Silverstone GP/.test(race)],
  ['race uses ordered final checkpoints', /checkpoint 10 crossed; next=11/.test(race)
    && /checkpoint 11 crossed; next=0/.test(race)
    && /checkpoint 0 crossed; next=1/.test(race)],
  ['race player lap is valid', /Gridline lap completed #1: .*valid=True/.test(race)],
  ['both AI drivers complete one lap', (race.match(/Gridline race AI lap driver=AI [12] lap=1/g) || []).length >= 2],
  ['race result contains all participants', /aiFinished=2\/2 status=all_ai_finished/.test(race)],
  ['race QA completes successfully', /Gridline race QA PASS position=3\/3 laps=1 aiFinished=2/.test(race)]
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
  if (!passed) failed += 1;
}

const forbidden = [
  ['time-trial QA failure', timeTrial.includes('Gridline QA failure') || timeTrial.includes('Gridline QA lap failure')],
  ['race QA failure', race.includes('Gridline race QA failure')],
  ['AI reset during race', race.includes('Gridline race AI event class=AI_DRIVER reason=reset')]
];
for (const [label, present] of forbidden) {
  console.log(`${present ? 'FAIL' : 'PASS'} ${label}`);
  if (present) failed += 1;
}

const transientAiEvents = (race.match(/Gridline race AI event class=AI_DRIVER/g) || []).length;
console.log(`INFO transient AI driver/contact events=${transientAiEvents} (reported, not silently discarded)`);

if (failed) process.exit(1);
console.log(`Native race runtime audit passed\n  timeTrial=${timeTrialFile}\n  race=${raceFile}`);
