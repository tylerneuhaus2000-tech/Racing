# GRIDLINE Unity Reference Test Matrix

## Primary targets

- Benchmark track: Silverstone.
- Mobile device: iPad with A16 chip.
- Desktop inputs: keyboard, game controller, steering wheel.

## Acceptance targets

- 60 FPS target on the A16 iPad at the low-quality preset.
- 60 FPS target on the reference Mac and Windows build.
- Physics remains fixed at 60 Hz when rendering is tested at 30, 60, 120, and 144 FPS.
- Controller analogue steering, throttle, brake, handbrake, reset, and pause work.
- Steering-wheel input has a separate mapping path and does not depend on keyboard keys.
- Silverstone remains the only reference track until its surface, collision, elevation, boundaries, start/finish, checkpoints, and lap validation are complete.

## Required manual hardware pass

1. Drive one clean lap with the controller.
2. Drive one clean lap with the steering wheel.
3. Repeat the same braking and steering test at each render-FPS cap.
4. Run the same session on the A16 iPad using touch controls.
5. Repeat ten restarts and record any state leakage.
