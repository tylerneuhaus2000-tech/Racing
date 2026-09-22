# Gridline Racing Native

This is the native rebuild of Gridline. It is intentionally separate from the current web game so the live game can stay playable while the native version is rebuilt cleanly.

## Current Slice
- Unity 6000.5.1f1 project foundation.
- One bootstrap scene reserved for the native game.
- Runtime-generated low-spec driving prototype is now the first implementation slice.
- Fixed 60 Hz physics baseline with speed, throttle, brake, steering, and G-force telemetry.
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

The Unity 6000.5.1f1 editor is installed on the development Mac. Headless compilation currently requires an activated Unity Editor license; until that is activated, repository tests can validate the project structure but cannot claim a Unity compile.

Unity CLI currently requires an activated editor license on this machine before batch builds can run.

## Controls
- `Enter`: start driving from the menu overlay
- `W` / `Up`: throttle
- `S` / `Down`: brake / reverse
- `A` / `Left`: steer left
- `D` / `Right`: steer right
- `Space`: handbrake
- `R`: reset car
- `Esc`: return to menu

## Build Goal
The first native milestone is not feature parity with the web game. It is a better foundation: stable driving, correct wheel visuals, predictable frame-rate behavior, and a real app build.
