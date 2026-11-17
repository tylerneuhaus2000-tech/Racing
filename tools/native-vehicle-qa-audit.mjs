import fs from 'node:fs';

const defaultLogs = [
  '/private/tmp/gridline-vehicle-reset-qa-30-settled.log',
  '/private/tmp/gridline-vehicle-reset-qa-60.log',
  '/private/tmp/gridline-vehicle-reset-qa-120.log',
  '/private/tmp/gridline-vehicle-reset-qa-144.log'
];
const logs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaultLogs;

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

const results = logs.map((file) => {
  if (!fs.existsSync(file)) {
    fail(`missing runtime log: ${file}`);
    return null;
  }

  const text = fs.readFileSync(file, 'utf8');
  const perfMatches = [...text.matchAll(/Gridline PERF target=(\d+) .*?fixed=([\d.]+)Hz/g)];
  const qa = text.match(
    /Gridline vehicle QA (PASS|FAIL): 0-100=([\d.-]+)s brake160=([\d.-]+)m latG=([\d.-]+) slip=([\d.-]+).*?groundingLossSamples=(\d+) resets=(\d+)\/(\d+)/
  );
  const steering = text.match(
    /Gridline vehicle QA steering-step steer=([\d.-]+) duration=([\d.-]+)s startSpeed=([\d.-]+)kph endSpeed=([\d.-]+)kph maxYaw=([\d.-]+)rad\/s maxSlipAngle=([\d.-]+)rad peakLatG=([\d.-]+) groundingLossSamples=(\d+) collision=(True|False)/
  );
  const highSpeedSteering = text.match(
    /Gridline vehicle QA high-speed-steering-step steer=([\d.-]+) duration=([\d.-]+)s startSpeed=([\d.-]+)kph endSpeed=([\d.-]+)kph maxYaw=([\d.-]+)rad\/s maxSlipAngle=([\d.-]+)rad peakLatG=([\d.-]+) groundingLossSamples=(\d+) collision=(True|False)/
  );
  if (!qa || !steering || !highSpeedSteering || perfMatches.length === 0) {
    fail(`incomplete vehicle QA log: ${file}`);
    return null;
  }

  const perf = perfMatches.at(-1);
  return {
    file,
    status: qa[1],
    fps: Number(perf[1]),
    fixedHz: Number(perf[2]),
    zeroTo100: Number(qa[2]),
    brake160: Number(qa[3]),
    lateralG: Number(qa[4]),
    slip: Number(qa[5]),
    groundingLossSamples: Number(qa[6]),
    resets: Number(qa[7]),
    resetFailures: Number(qa[8]),
    steeringInput: Number(steering[1]),
    steeringStartSpeed: Number(steering[3]),
    steeringEndSpeed: Number(steering[4]),
    steeringYawRate: Number(steering[5]),
    steeringSlipAngle: Number(steering[6]),
    steeringLateralG: Number(steering[7]),
    steeringGroundingLossSamples: Number(steering[8]),
    steeringCollision: steering[9] === 'True',
    highSpeedSteeringStartSpeed: Number(highSpeedSteering[3]),
    highSpeedSteeringEndSpeed: Number(highSpeedSteering[4]),
    highSpeedSteeringYawRate: Number(highSpeedSteering[5]),
    highSpeedSteeringSlipAngle: Number(highSpeedSteering[6]),
    highSpeedSteeringLateralG: Number(highSpeedSteering[7]),
    highSpeedSteeringGroundingLossSamples: Number(highSpeedSteering[8]),
    highSpeedSteeringCollision: highSpeedSteering[9] === 'True'
  };
}).filter(Boolean);

if (process.exitCode) process.exit();

const fps = results.map((result) => result.fps).sort((a, b) => a - b);
const zeroTo100 = results.map((result) => result.zeroTo100);
const brake160 = results.map((result) => result.brake160);
const allPassed = results.every((result) => result.status === 'PASS'
  && result.fixedHz >= 118 && result.fixedHz <= 122
  && result.resets === 10 && result.resetFailures === 0
  && result.steeringInput === 0.1
  && result.steeringGroundingLossSamples === 0
  && !result.steeringCollision
  && result.highSpeedSteeringStartSpeed >= 155
  && result.highSpeedSteeringGroundingLossSamples === 0
  && !result.highSpeedSteeringCollision);
const accelerationSpread = Math.max(...zeroTo100) - Math.min(...zeroTo100);
const brakingSpread = Math.max(...brake160) - Math.min(...brake160);

for (const result of results) {
  console.log(`${result.status} ${result.fps} FPS · fixed=${result.fixedHz.toFixed(1)} Hz `
    + `0-100=${result.zeroTo100.toFixed(3)} s brake160=${result.brake160.toFixed(1)} m `
    + `latG=${result.lateralG.toFixed(2)} slip=${result.slip.toFixed(2)} `
    + `steerYaw=${result.steeringYawRate.toFixed(3)} rad/s `
    + `steerSlip=${result.steeringSlipAngle.toFixed(3)} rad `
    + `steerLatG=${result.steeringLateralG.toFixed(2)} `
    + `steerGroundingLoss=${result.steeringGroundingLossSamples} `
    + `steerCollision=${result.steeringCollision} `
    + `highSpeedYaw=${result.highSpeedSteeringYawRate.toFixed(3)} rad/s `
    + `highSpeedSlip=${result.highSpeedSteeringSlipAngle.toFixed(3)} rad `
    + `highSpeedLatG=${result.highSpeedSteeringLateralG.toFixed(2)} `
    + `highSpeedGroundingLoss=${result.highSpeedSteeringGroundingLossSamples} `
    + `highSpeedCollision=${result.highSpeedSteeringCollision} `
    + `resets=${result.resets}/${result.resetFailures}`);
}

if (!allPassed) fail('one or more runtime gates failed');
if (accelerationSpread > 0.10) fail(`0-100 spread too large: ${accelerationSpread.toFixed(3)} s`);
if (brakingSpread > 5.0) fail(`braking spread too large: ${brakingSpread.toFixed(1)} m`);
if (fps.join(',') !== '30,60,120,144') fail(`expected FPS matrix 30,60,120,144; got ${fps.join(',')}`);

if (!process.exitCode) {
  console.log(`Vehicle FPS regression audit passed · acceleration spread=${accelerationSpread.toFixed(3)} s `
    + `braking spread=${brakingSpread.toFixed(1)} m`);
}
