# Gridline Native Rebuild Roadmap

## Objective
Rebuild Gridline as a real standalone racing game while keeping the current web game alive as a playable reference. The new version should feel like a finished game, not a browser prototype wrapped in a window.

## Direction
Primary target: Unity 6000.5.1f1.

Why Unity:
- Unity is installed on this machine.
- It gives us a real native desktop/mobile build pipeline.
- It has mature input, audio, physics, profiling, UI, asset, and release tooling.
- It lets us rebuild step by step without breaking the live web game.

The current web game remains the design and feature reference. We do not delete it. We extract what is valuable, then rebuild the game systems cleanly.

## Non-Negotiables
- Driving feel comes first.
- Stable FPS comes before new content.
- No feature is "done" until it is playable in a real build.
- The old game stays deployable while the new game is built.
- Every system gets a small vertical slice before it becomes large.

## Target Experience
- Native executable for macOS first, Windows next.
- Real game menu, garage, track select, race setup, pause, results, and settings.
- Polished F1/GT style HUD with movable telemetry widgets.
- Force feedback/controller-friendly input architecture.
- Proper engine, tire, wind, curb, crash, radio, and ambience audio layers.
- Track pipeline that supports polished official-style circuits and original tracks.
- Safety rating, licenses, progression, and unlocks preserved from the current game.
- Firebase/cloud sync only where it makes sense: account, license, safety, leaderboards.

## Month 1 Plan

### Week 1: Foundation
- Create a new Unity project in parallel to the web game.
- Set project structure, render pipeline, input system, scenes, and build targets.
- Build a tiny drivable prototype: flat test track, one car body, four visible wheels, camera follow.
- Add telemetry debug HUD: speed, gear, RPM placeholder, throttle, brake, steer, lateral G, longitudinal G.
- Define performance budget and baseline profiler scene.

Exit gate:
- Native app launches.
- Car drives, brakes, steers, and can spin.
- Wheels animate without moving the chassis incorrectly.
- HUD values update correctly.

### Week 2: Driving Core
- Replace placeholder movement with a clean vehicle controller.
- Tune tire grip, oversteer, understeer, braking, traction, and speed sensitivity.
- Add gearbox, rev limiter, ABS/TC assists, and setup values.
- Add restart/reset flow and run repeated restart tests.
- Compare 30/60/120/144 FPS behavior.

Exit gate:
- The car feels controllable and fun.
- Physics are frame-rate stable.
- Restart does not break input, camera, UI, or timing.

### Week 3: Race Loop
- Add lap timing, checkpoints, invalid laps, sectors, and results.
- Add one polished test circuit.
- Add AI placeholders only after the player car is stable.
- Add race engineer voice events without a text input field.
- Add first pass safety rating events: off track, crash, clean lap, dangerous driving.

Exit gate:
- A full solo session works from menu to finish screen.
- Safety rating is visible in menu and race summary.
- Engineer speaks useful stats automatically.

### Week 4: Product Shape
- Add garage and car classes.
- Add locked F1 vehicles behind platinum/game-master unlock.
- Add track list, settings, graphics presets, audio mixer, and input binding screen.
- Add proper desktop packaging.
- Decide what cloud systems migrate first.

Exit gate:
- First internal alpha build exists.
- macOS build is playable outside the editor.
- Known bugs are tracked by severity.

## Later Phases

### Phase 2: Content
- Import and clean car models.
- Build track conversion pipeline.
- Add planes, trackside objects, damage visuals, and better materials.
- Replace placeholder audio with licensed or self-owned samples.

### Phase 3: Career and Online
- Migrate account/license data carefully.
- Sync safety rating and progression.
- Add leaderboards.
- Add multiplayer only after solo race loop is stable.

### Phase 4: Release Quality
- App icon, splash, installer, code signing, notarization.
- Crash reporting and diagnostics.
- Automated smoke tests.
- Performance certification on target machines.

## First Build Slice
The first playable native build should not try to include every existing feature. It should include:
- One car.
- One simple test track.
- One chase camera.
- One telemetry HUD.
- One pause/restart flow.
- One results screen.

This is the base we improve until it feels better than the web version.

## Current Web Game Responsibilities
The web version remains:
- Public playable version.
- Feature reference.
- Data reference for cars, tracks, licenses, and safety rating behavior.
- Fallback if the native rebuild is temporarily broken.

## Immediate Next Step
Create the Unity project skeleton and commit it separately. The first milestone is a blank native app that opens into a simple main menu scene and a drivable prototype scene.
