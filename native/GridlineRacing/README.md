# Gridline Racing Native

This is the native rebuild of Gridline. It is intentionally separate from the current web game so the live game can stay playable while the native version is rebuilt cleanly.

## Current Slice
- Unity 6000.5.1f1 project skeleton.
- One bootstrap scene.
- Runtime-generated test track.
- One drivable prototype car.
- Animated wheel visuals.
- Chase camera.
- Debug HUD for speed, gear, RPM, throttle, brake, steering, lateral G, longitudinal G, and FPS.

## Run
Open this folder in Unity Hub:

```text
native/GridlineRacing
```

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
