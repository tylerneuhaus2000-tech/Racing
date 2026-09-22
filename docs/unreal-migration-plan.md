# GRIDLINE Unreal Migration

The production target is now Unreal Engine 5. Unity remains preserved as a reference until the first Unreal build is verified.

## Migration order

1. Install and verify Unreal Engine 5.
2. Open the project and create the empty prototype map.
3. Import existing GLB vehicle and track assets only.
4. Build vehicle physics with Chaos Vehicles and fixed substepping.
5. Build the track from its real mesh, materials, elevation, and collision.
6. Add checkpoints, lap validation, wrong-way detection, and reset logic.
7. Add the low-cost HUD and telemetry.
8. Add keyboard, controller, wheel, and iPad touch input.
9. Add race sessions, AI, aircraft ambience, dashboard, saves, and unlocks.
10. Package and profile Windows, macOS, and iPadOS.

## Acceptance rule

The first finished milestone is one car on one accurately represented existing track. No additional track or invented pit lane is added until that reference implementation survives restart, lap, collision, pause, and performance tests.
