# Gridline Racing: Unity Month

The native Unity project in `native/GridlineRacing` is now the production target. The browser game stays available as a reference while the finished game is rebuilt in a controlled sequence.

## Definition of done

- A packaged macOS game launches without the Unity editor.
- Driving is stable at 30, 60, 120, and 144 FPS.
- The car chassis stays stable while wheels steer and rotate independently.
- A complete lap can be driven repeatedly without invisible walls or false invalid-lap states.
- HUD shows speed, gear, RPM, throttle, brake, steering, lateral G, longitudinal G, tires, damage, and lap timing.
- Track, car, aircraft, audio, unlocks, save data, and dashboard are integrated behind testable systems.

## Order of work

1. Driving foundation and deterministic telemetry.
2. One reliable production track and lap system.
3. HUD and audio.
4. AI, aircraft, weather, damage, and safety rating.
5. Career dashboard, platinum F1 unlocks, and game-master override.
6. Builds, profiling, restart testing, and release checklist.

Every week ends with a playable build and a short regression pass before new content is added.
