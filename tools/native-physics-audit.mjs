import fs from 'node:fs';

const root = new URL('../native/GridlineRacing/', import.meta.url);
const read = relative => fs.readFileSync(new URL(relative, root), 'utf8');
const bootstrap = read('Assets/Gridline/Scripts/Core/GridlineBootstrap.cs');
const vehicle = read('Assets/Gridline/Scripts/Vehicle/GridlineVehicleController.cs');
const input = read('Assets/Gridline/Scripts/Core/GridlineInputRouter.cs');
const probe = read('Assets/Gridline/Scripts/Core/GridlinePerformanceProbe.cs');
const lap = read('Assets/Gridline/Scripts/Core/GridlineLapSystem.cs');
const qaDriver = read('Assets/Gridline/Scripts/Core/GridlineQaDriver.cs');
const hud = read('Assets/Gridline/Scripts/UI/GridlineDebugHud.cs');
const touch = read('Assets/Gridline/Scripts/UI/GridlineTouchControls.cs');
const runtimeBuilder = read('Assets/Gridline/Scripts/Core/GridlineRuntimeBuilder.cs');
const timeTrial = read('Assets/Gridline/Scripts/Core/GridlineTimeTrialSession.cs');
const track = read('Assets/Resources/Tracks/monza.json');
const inputManager = read('ProjectSettings/InputManager.asset');

const checks = [
  ['120 Hz fixed simulation', /Time\.fixedDeltaTime\s*=\s*1f\s*\/\s*120f/.test(bootstrap)],
  ['render FPS override is available', /-gridline-fps/.test(bootstrap) && /Application\.targetFrameRate\s*=\s*ReadTargetFrameRate\(\)/.test(bootstrap)],
  ['runtime FPS probe reports render and fixed clocks', /Gridline PERF/.test(probe) && /private void FixedUpdate\(\)/.test(probe)],
  ['Rigidbody movement enters through FixedUpdate', /private void FixedUpdate\(\)[\s\S]*?StepPhysics\(dt\)/.test(vehicle) && /Rigidbody/.test(vehicle)],
  ['wheel axes configured', ['WheelSteering', 'WheelThrottle', 'WheelBrake'].every(axis => inputManager.includes(`m_Name: ${axis}`))],
  ['wheel axes read by router', ['WheelSteering', 'WheelThrottle', 'WheelBrake'].every(axis => input.includes(`Input.GetAxisRaw("${axis}")`))],
  ['lap system keeps vehicle segment hint', /Track\.Query\(Vehicle\.transform\.position,\s*Vehicle\.TrackSampleIndex\)/.test(lap)],
  ['Monza main track uses source-order clockwise traversal and 99% grid anchor', /"reverseDirection"\s*:\s*false/.test(track)
    && /"startGridPct"\s*:\s*99/.test(track)
    && /"Tracks\/monza"/.test(runtimeBuilder)
    && /holder\.transform\.localScale\s*=\s*Vector3\.one/.test(runtimeBuilder)],
  ['Silverstone spawn is within the physical wheel-ray settling range', /Vector3\.up \* 0\.45f/.test(runtimeBuilder)
    && /start_not_grounded/.test(qaDriver)],
  ['lap system uses ordered direction-sensitive checkpoints', /private const int CheckpointCount\s*=\s*12/.test(lap)
    && /ProcessCheckpointCrossing\(/.test(lap)
    && /CrossedCheckpoint\(/.test(lap)],
  ['wrong-way driving invalidates the lap', /public bool IsWrongWay/.test(lap)
    && /direction < -0\.45f/.test(lap)
    && /IsValidLap = false/.test(lap)],
  ['lap failures retain a validation reason and progress', /InvalidReason/.test(lap)
    && /MarkInvalid\("track_limits"/.test(lap)
    && /MarkInvalid\("wrong_way"/.test(lap)],
  ['invalid laps cannot count as valid time-trial results', /ValidCompletedLaps/.test(lap)
    && /InvalidCompletedLaps/.test(lap)
    && /LastLapWasValid/.test(lap)
    && /laps\.ValidCompletedLaps\s*>=\s*requiredLaps/.test(qaDriver)
    && /requiredLaps\s*=\s*timeTrialQa/.test(qaDriver)],
  ['native time-trial session owns runtime results and QA exit', /Gridline time trial result/.test(timeTrial)
    && /Gridline time trial restarted/.test(timeTrial)
    && /-gridline-qa-time-trial/.test(timeTrial)
    && /-gridline-qa-time-trial-restart/.test(timeTrial)
    && /ResetCount/.test(vehicle)
    && /TimeTrial\.Configure/.test(runtimeBuilder)],
  ['collision telemetry distinguishes recent barrier contact', /OnCollisionEnter\(Collision collision\)/.test(vehicle)
    && /LastCollisionImpulse/.test(vehicle)
    && /HasRecentCollision/.test(vehicle)],
  ['QA failures are classified before driver changes', /Gridline QA lap failure class=/.test(qaDriver)
    && ['VEHICLE_PHYSICS', 'TRACK_COLLISION', 'SURFACE_DETECTION', 'LAP_VALIDATION',
      'QA_DRIVER', 'INPUT', 'RESET', 'UNKNOWN'].every(category => qaDriver.includes(category))],
  ['tire temperature and wear feed grip', /UpdateTireModel\(dt, speed\)/.test(vehicle) && /TemperatureGrip\(/.test(vehicle)],
  ['tire telemetry reaches HUD', /Vehicle\.TireLabel/.test(hud)],
  ['checkpoint and wrong-way state reach HUD', /NEXT CHECKPOINT/.test(hud) && /WRONG WAY/.test(hud)],
  ['iPad touch controls can be repositioned and persisted', /layoutMode/.test(touch)
    && /draggingControl/.test(touch)
    && /PlayerPrefs\.SetFloat/.test(touch)
    && /SaveAndExitLayout\(\)/.test(touch)]
];

const failed = checks.filter(([, passed]) => !passed);
for (const [label, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
if (failed.length) process.exit(1);
console.log('Native physics audit passed (fixed-step, wheel input, continuous track query).');
