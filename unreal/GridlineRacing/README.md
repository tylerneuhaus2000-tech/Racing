# GRIDLINE Unreal Engine 5

This is the new native production project for GRIDLINE. The existing Unity project remains in `native/GridlineRacing` as a reference until the Unreal prototype has been opened and verified.

## Target platforms

- Windows
- macOS
- iPadOS through the iOS target

The project is intentionally configured for scalable, low-cost rendering. Mobile and low-end presets are more important than high-end visual effects.

## First Unreal milestone

1. Open the project in Unreal Engine 5.
2. Create the `GridlinePrototype` map.
3. Import one existing vehicle asset and one existing track asset.
4. Build a Chaos Vehicles test car with stable fixed-step physics.
5. Add Enhanced Input for keyboard, controller, wheel architecture, and touch.
6. Add telemetry for speed, gear, RPM, throttle, brake, steering, and G-force.
7. Package a low-quality desktop build and an iPad test build.

No new pit lane, barriers, scenery, or track sections may be invented. Existing assets remain the source of truth.

## Editor requirement

Unreal Engine 5 is not currently installed on the development Mac, so the `.uproject` cannot be opened or packaged until the Epic Games Launcher installs a compatible UE5 version. The project is pinned to UE 5.6 and can be changed if a different installed version is selected.
