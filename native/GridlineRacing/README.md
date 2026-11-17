# Gridline Racing Native

This is the native rebuild of Gridline. It is intentionally separate from the current web game so the live game can stay playable while the native version is rebuilt cleanly.

## Current Slice
- Unity 6000.5.1f1 project foundation.
- One bootstrap scene reserved for the native game.
- Runtime-generated low-spec driving prototype is now the first implementation slice.
- Fixed 120 Hz physics baseline with speed, throttle, brake, steering, and world-space G-force telemetry.

## Reference Test Targets

- Track benchmark: Silverstone.
- Mobile benchmark: iPad with A16 chip.
- Input test devices: game controller and steering wheel.
- The browser prototype is no longer the production target; Barcelona is removed from its track registry.

## One-Month Build Direction
1. Week 1: stable driving loop, input abstraction, camera, reset, pause, and frame-rate-independent physics.
2. Week 2: real track import, collision boundaries, lap timing, checkpoints, pit lane, and reliable lap validation.
3. Week 3: production HUD, G-force telemetry, tire/brake/engine state, audio hooks, and aircraft scenery.
4. Week 4: career/dashboard flow, unlocks, save data, performance pass, packaged macOS build, and regression testing.

The web game remains a reference/prototype only. New gameplay systems belong in this Unity project.

## Run
Open this folder in Unity Hub:

```text
native/GridlineRacing
```

The Unity 6000.5.1f1 editor is installed. The macOS player, Windows Standalone
build and iOS/Xcode export are built through the Unity CLI. Only the macOS
player has been runtime-tested in this environment; Windows and iPad hardware
validation remain open.

### Vehicle dynamics test facility

The current handling work can be tested independently from Silverstone on a large
flat facility with a high-speed loop, measurement lanes, skidpads and slalom
cones. Start the built macOS player with:

```text
native/GridlineRacing/Builds/macOS/Gridline.app/Contents/MacOS/GridlineRacing -gridline-testpad -screen-fullscreen 0 -screen-width 1600 -screen-height 900
```

The normal player remains on Silverstone when `-gridline-testpad` is omitted.
The development QA driver can complete two physical test-facility laps with:

```text
native/GridlineRacing/Builds/macOS/Gridline.app/Contents/MacOS/GridlineRacing -batchmode -nographics -gridline-testpad -gridline-qa-lap -logFile /private/tmp/gridline-testpad-qa.log
```

The vehicle dynamics QA runs acceleration, braking, skidpad, suspension-contact
and reset scenarios through the same Rigidbody and input router:

```text
native/GridlineRacing/Builds/macOS/Gridline.app/Contents/MacOS/GridlineRacing -batchmode -nographics -gridline-testpad -gridline-qa-vehicle -logFile /private/tmp/gridline-vehicle-qa.log
```

It writes the latest compact result to Unity's persistent data folder as
`Gridline/QA/vehicle-dynamics-latest.json`.

## Controls
- `Enter`: start driving from the menu overlay
- `W` / `Up`: throttle
- `S` / `Down`: brake / reverse
- `A` / `Left`: steer left
- `D` / `Right`: steer right
- `Space`: handbrake
- `F6`: recenter steering-wheel pedal calibration (release pedals first)
- `R`: reset car
- `Esc`: return to menu

The native input router reads `WheelSteering`, `WheelThrottle` and `WheelBrake`
axes in addition to the controller axes. The HUD top bar reports the active
source (`WHEEL`, `CONTROLLER`, `KEYBOARD`, `TOUCH` or `NONE`). Pedals are
normalized against their axis boundary rather than the first partial movement;
press `F6` after connecting or changing a wheel and leave both pedals released
for the new rest position.

The latest macOS build also uses the browser reference's grip-envelope
stabilization: it damps yaw and lateral velocity while the tires are inside
their available grip and backs off as the car genuinely saturates. This is a
runtime handling change, so controller and wheel feel still need manual
validation in the opened player.

## Build Goal
The first native milestone is not feature parity with the web game. It is a better foundation: stable driving, correct wheel visuals, predictable frame-rate behavior, and a real app build.
