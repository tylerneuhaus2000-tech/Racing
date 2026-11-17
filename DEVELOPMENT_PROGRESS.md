# GRIDLINE Development Progress

## Current milestone

Native physics foundation: Ferrari 296 GT3 on Silverstone GP.

## This run

- Corrected Silverstone's logical traversal after runtime review: the exported
  browser points are counter-clockwise in Unity X/Z, while official Silverstone
  GP racing is clockwise. `reverseDirection=true` now reverses only the logical
  centerline order, preserves the physical GLB and S/F anchor, and maps the
  99% source grid to 1% of the runtime order.
- Reworked the deterministic QA driver to use look-ahead steering and
  conservative speed planning. It remains fully input/Rigidbody driven.
- Added ordered, direction-sensitive Silverstone checkpoint gates, wrong-way
  invalidation and checkpoint telemetry in the native HUD.
- Added runtime collision meshes extracted from the supplied Silverstone GLB,
  classified by asphalt, kerb, runoff and barrier materials.
- Replaced transform locomotion with a Rigidbody controller, compound body
  collider, four raycast suspension contacts, spring/damper loads, combined
  tyre forces, aero, braking and rear-wheel drive.
- Added standstill reverse selection, physical handbrake force and Rigidbody
  reset state clearing.
- Preserved the browser centerline geometry and imported GLB while applying the
  official clockwise traversal, ordered checkpoints, sectors, progress,
  wrong-way detection, QA path following and reset headings through the same
  `GridlineTrackData` direction.
- Added the web-game stability layer to native physics: speed-limited yaw
  target, lateral velocity damping and catchable rear support under throttle.
- Added deterministic `-gridline-qa-lap` driver for repeatable native tests.
- Added strict failed-lap cause telemetry. The lap system records the first
  validation rule and progress; the QA driver classifies each failure as
  `VEHICLE_PHYSICS`, `TRACK_COLLISION`, `SURFACE_DETECTION`, `LAP_VALIDATION`,
  `QA_DRIVER`, `INPUT`, `RESET` or `UNKNOWN` before any driver change.
- Added fresh collision evidence (contact name, impulse and fixed-time window)
  so stale barrier labels cannot be used to blame the track or vehicle.
- Reconciled the native yaw-stability layer with the browser reference after
  manual handling feedback: the clean-grip assist now follows the browser's
  grip-envelope response instead of using a fixed 0.18 gain, while genuine
  tire saturation still reduces the assist.
- Added progress-stall telemetry to the QA driver. A grounded, collision-free
  lap that stops advancing is classified as `QA_DRIVER` before recovery; it is
  never counted as evidence of realistic handling.
- Fixed lap-result accounting so an invalidated lap is recorded separately and
  can never satisfy the valid time-trial/QA lap quota. The runtime now exposes
  `ValidCompletedLaps`, `InvalidCompletedLaps`, `LastLapWasValid` and the
  completed invalidation reason.
- Added the persistent web parity matrix.
- Added a native `TIME TRIAL` session component. It owns session start/restart
  and result telemetry while leaving timing and validity authoritative in the
  production lap system; dedicated QA mode exits only after a valid result.

## Verified

- Clean Unity 6000.5.1f1 macOS runtime loaded the supplied Ferrari 296 GT3 and
  Silverstone GLBs with 19 physical track mesh colliders and 4/4 grounded wheel
  contacts at the real spawn.
- Two consecutive autonomous Silverstone laps completed validly in the final
  macOS build (`244602520097c90c17b42e5f3a064e39e2c8dd5edfedf8eca82b5639b6e9403d`):
  318.544 s and 321.044 s in the official clockwise direction. The runtime
  log reports `validCount=2`, `invalidCount=0`, no QA/lap failure, collision,
  reset failure, or invalidation.
  Earlier reverse-direction laps remain useful vehicle tests but are not valid
  Silverstone reference-slice verification.
- The clean two-lap log contains no classified lap failure or QA failure. The
  QA driver changes were limited to look-ahead/recovery behavior and input
  sequencing; the handling correction was a browser-parity yaw/input response
  change and was revalidated against the real Rigidbody runtime.
- Fixed-step vehicle QA passed at 30/60/120/144 render FPS. All four runs kept
  the simulation at approximately 120 Hz and passed acceleration, braking,
  skidpad, wheel-contact and reset checks. The reset gate now exercises ten
  consecutive physical reset cycles after suspension settling.
- Final `24460252` FPS matrix measurements: 0-100 km/h = 3.542/3.517/3.517/3.517 s
  and braking distance from 160 km/h = 86.3/84.3/83.1/83.0 m at 30/60/120/144
  FPS; acceleration spread 0.025 s and braking spread 3.3 m.
- Ten-reset runtime evidence at 30 FPS: `resets=10/0`, with stabilized 4/4
  wheel contact and no residual speed, yaw or collision state.
- Added `npm run test:vehicle-qa`, which parses the four runtime logs and
  rejects FPS-dependent acceleration/braking drift, fixed-step drift and reset
  failures. Current matrix result: acceleration spread 0.025 s, braking spread
  3.3 m, all four runs PASS on the final binary.
- Rebuilt the macOS player after the direction correction, lap-result accounting
  fix and final QA-harness cleanup. The production matrix and fresh
  direction-sensitive rules runtime audit pass; controller and wheel feel remain
  pending manual validation.
- Exported the same reference slice successfully to an iOS/Xcode project for
  the iPad A16 target and to a Windows Standalone build. These are build gates,
  not claims of iPad or Windows runtime validation.
- Added a separate `-gridline-qa-rules` runtime harness. On the real
  Silverstone build it passes intentional wrong-way invalidation, off-track
  track-limit invalidation, an ordered-checkpoint skip probe, a physical
  shortcut attempt, post-reset lap-state cleanup and a complete invalidated lap
  that is excluded from valid results; `npm run test:rules-qa` audits the log.
- Re-ran the two-lap reference gate from the fresh current player after the
  lap-result accounting fix. The log contains the explicit clockwise configuration,
  ordered checkpoint crossings, no `Gridline QA failure`, no lap-failure
  reason, no collision contact and no runtime error.
- The same final two-lap log contains 308 `Track`, 7 `Kerb` and 5 `Grass`
  surface telemetry samples; 319 of 320 logged contact samples report `4/4`
  grounded, one Kerb sample reports `3/4`, and all 320 report
  `collision=none`. This is surface/collision evidence, not a claim of manual
  handling realism.
- Static native, track and physics audits pass. The offline GLB-to-centerline
  audit reports 720 spline samples at 1.35 m mean, 3.41 m p95 and 6.00 m max
  distance from asphalt.
- Fresh macOS build `3cbe759a1de10c6479e0b679d1c5f03d356bcaf376701326f3ef901e2c7ead75`
  passed the native time-trial runtime gate. A dedicated one-lap run recorded
  `318.553 s`, `valid=True`, `validCount=1` and exited with
  `Gridline time trial QA PASS`. The same binary then completed two consecutive
  official-clockwise laps at `318.278 s` and `321.227 s`, both valid, with
  `validCount=2`, `invalidCount=0` and no QA/lap failure.
- The fresh two-lap log contains 310 `Track`, 6 `Kerb` and 4 `Grass` samples;
  all 320 logged contact samples report `4/4` grounded and every logged
  collision is `none`. Render telemetry stayed around 57-60 FPS with a 120 Hz
  fixed step. Compared with the prior verified `24460252` build, lap deltas
  were `-0.266 s` and `+0.183 s`; this is run variation, not a physics or
  track change.
- Follow-up macOS build `b4c5520bb437daff9fb9ca7221123bfc6d8a88473614ee06f520c4d915c8b5b6`
  contains only the time-trial reset-counter/telemetry edge-case fix. Its
  runtime restart probe passed on the official clockwise configuration:
  `reset requested` -> `reason=vehicle_reset` -> `restart QA PASS`, with no
  duplicate restart result and no runtime error.

## Overnight runtime record: 2026-09-24

- `BUILD_TOOLING`: the first post-direction build was blocked by a restricted
  Package Manager IPC socket (`/tmp/Unity-Upm-26283.sock`, `EPERM`). A stale
  headless Licensing Client was cleaned up while the active Hub client stayed
  untouched; the next build completed successfully.
- `IMPLEMENTED`: Silverstone logical direction correction plus exporter/static
  audit expectations. No physical GLB rotation or mirroring was introduced for
  this correction.
- `RUNTIME-VERIFIED`: final macOS build launched and identified itself through
  the clockwise configuration log; two valid autonomous laps completed on the
  fresh `24460252` binary with explicit valid/invalid counters.
- `RUNTIME-VERIFIED`: fresh 30/60/120/144 FPS vehicle QA and six fresh lap-rule
  probes, including invalid-lap exclusion. One initial shortcut probe was
  classified `QA_DRIVER` and fixed by extending its probe timeout; no vehicle
  physics or track geometry was changed.
- Compared with the previous verified vehicle matrix, this rebuild changes
  acceleration by `+0.009/0.000/0.000/0.000 s` and braking by
  `+0.0/+0.3/-0.5/+0.4 m` at 30/60/120/144 FPS. The lap-result accounting
  correction did not alter vehicle physics or track geometry.
- `IMPLEMENTED` and `RUNTIME-VERIFIED`: native time-trial session/result flow
  and fresh macOS build `3cbe759a`; one dedicated valid time-trial result and
  two consecutive valid Silverstone laps completed on that exact binary.
- `RUNTIME-VERIFIED`: follow-up binary `b4c5520b` restart telemetry regression;
  the current player detects an in-session vehicle reset exactly once and
  exits the dedicated QA probe successfully.

## Direction and race gate: 2026-09-24 04:45-10:00

- `IMPLEMENTED`: confirmed the official Silverstone GP direction as clockwise
  and kept the physical GLB unchanged. The logical centerline is reversed
  around the existing S/F anchor; grid, ordered checkpoints, sectors,
  progress, wrong-way checks and reset heading all use that same traversal.
- `IMPLEMENTED`: race-only input/lap gating now checks `Race.Enabled`, so the
  disabled race component cannot suppress ordinary time-trial input or lap
  processing. This was found by runtime evidence, not by static tests.
- `IMPLEMENTED`: race AI follows the validated QA-driver steering profile and
  records off-track/contact events as `AI_DRIVER` telemetry with bounded
  recovery. No vehicle grip, suspension or physical track geometry was tuned
  to make the AI pass.
- `IMPLEMENTED`: bounded QA race timeout and `tools/native-race-audit.mjs`.
  The audit requires the official clockwise config, final ordered gates, two
  valid time-trial laps, two AI laps and an all-participants race result.
- `RUNTIME-VERIFIED`: macOS build
  `e3fe8bdd8d9cc851bd1757d40eae18f9f6438574f1530e85f1e0aef908ad1b7f`.
  On that exact binary, autonomous Silverstone laps were `318.511 s` and
  `321.319 s`, both `valid=True`, `validCount=2`, `invalidCount=0`, with
  ordered `10 -> 11 -> 0` crossings and no QA/lap failure.
- `RUNTIME-VERIFIED`: the same binary completed the one-lap QA grid with two
  Ferrari 296 GT3 AI cars: player `321.652 s valid=True`, `aiFinished=2/2`,
  `status=all_ai_finished`, `Gridline race QA PASS`.
- `PARTIAL`: both AI cars produced short `AI_DRIVER` grounding/contact events
  near progress 65.2-65.6% on the kerb transition. They recovered without a
  reset, invalid lap or collision. This is retained as a follow-up telemetry
  item; it is not evidence to claim perfect AI or manual handling.
- `RUNTIME-VERIFIED`: render telemetry stayed about 57-60 FPS with a 120 Hz
  fixed step in both fresh runs. The earlier reverse-direction laps remain
  excluded from Silverstone validation and are retained only as vehicle tests.

## Current validation boundary

- The macOS runtime and automated reference slice are currently usable. Manual
  controller/steering-wheel feel, device calibration and subjective realism
  still require hardware validation; automated laps do not prove those claims.
- iOS/Xcode and Windows exports are now build-verified; Windows and iPad
  device/runtime validation remains open.
- The physical shortcut probe now drives the Rigidbody off the racing line with
  gas and steering, records 18.0 m of movement and `lateral=13.0 m`, and is
  rejected by the real track-limit validator without completing a lap.
- Manual input regression remains open. The current macOS player is open for
  direct controller/steering-wheel testing; automated QA must not be used as a
  substitute for that subjective handling check.

## Next task

- Keep investigating the bounded AI kerb-contact telemetry without changing
  vehicle physics merely to improve QA completion.
- Keep expanding Silverstone alternate-route coverage while preserving the
  existing failure taxonomy and requiring runtime evidence for each scenario.
- Keep the validated native time-trial flow as the base for the next race-rule
  slice; automated laps remain separate from manual handling evidence.
- Perform manual macOS driving with the available controller and wheel, then
  record input/calibration findings separately from simulation evidence. If a
  new failure appears, classify it before changing vehicle physics.
- Investigate large source GLB triangle PhysX cooking warnings only after
  measuring whether they affect contacts or performance.

## Endurance test and build blocker: 2026-09-24 05:20-05:55

- `IMPLEMENTED` (not runtime-verified): the QA race accepts
  `-gridline-qa-race-laps=N` and records AI contact-loss and recovery-reset
  counters in the final result. The two-lap audit is available through
  `npm run test:race-endurance`; it intentionally requires a fresh runtime log
  and does not treat the earlier one-lap race as an endurance result.
- `IMPLEMENTED` (not runtime-verified): vehicle telemetry now exposes the
  grounded wheel count, and AI contact events distinguish `off_track` from
  `ground_contact_loss`. This is diagnostic classification only; no grip,
  suspension, collision or track geometry was changed.
- `BLOCKED`: a fresh macOS build containing these changes could not reach
  `BuildPipeline`. Seven controlled attempts were stopped after the Unity
  Licensing Client failed its IPC initialization with
  `LicenseClient-tylerneuhaus[-6000.5.1]` missing and a 74.85 second timeout.
  The current Hub client successfully refreshed the Personal entitlement and
  wrote `UnityEntitlementLicense.xml`, but the batch editor still could not
  connect to its expected licensing channel. A manually launched licensing
  client did listen on the expected `/tmp/Unity-LicenseClient-...sock`, yet
  Unity did not connect and spawned another client. No license file, project
  asset, Library cache or source file was deleted or reset.
- `RUNTIME-VERIFIED` remains limited to the previous build
  `e3fe8bdd8d9cc851bd1757d40eae18f9f6438574f1530e85f1e0aef908ad1b7f`:
  two valid clockwise time-trial laps and the one-lap race gate. The new
  two-lap race result is explicitly pending a successful build.
- Offline checks after the changes: `test:native`, `test:physics`,
  `test:track`, `test:race`, `node --check tools/native-race-endurance-audit.mjs`
  and `git diff --check` pass. The endurance runtime audit is `BLOCKED` because
  `/private/tmp/gridline-race-endurance-direction-fix-1.log` does not exist.
