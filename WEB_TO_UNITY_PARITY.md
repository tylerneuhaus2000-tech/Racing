# GRIDLINE Web -> Unity Parity

This file is the migration matrix for the native Unity rebuild. `VERIFIED`
means exercised in a running build, `IMPLEMENTED` means code and build support
exists but the full runtime/platform check is still outstanding.

## Reference slice

| Area | Web reference | Unity status |
| --- | --- | --- |
| Boot/loading | `gt3-web-racer.html`, GLTFLoader | IMPLEMENTED: Bootstrap and runtime GLB loading |
| Vehicle | Ferrari 296 GT3 GLB and browser GT3 model | IMPLEMENTED: native Ferrari GLB, Rigidbody, compound body collider, four raycast wheels |
| Track | Silverstone GP GLB and `silverstone-gp.json` | RUNTIME-VERIFIED: supplied GLB, clockwise centerline query, road/kerb/runoff/barrier MeshColliders |
| Physics | browser local velocity, tyre grip, aero, slip | IMPLEMENTED: fixed-step Rigidbody forces, load-sensitive friction circle, tyre temp/wear, aero drag/downforce |
| Input | keyboard, gamepad, wheel axes, touch | IMPLEMENTED: legacy axes, browser-parity steering response, wheel calibration, touch controls; physical hardware still needs device verification |
| HUD | lap/timing, dash, G-force, map, tyres | IMPLEMENTED: native HUD and telemetry; parity polish remains |
| Lap timing | progress, sectors, track limits | RUNTIME-VERIFIED for the Ferrari/Silverstone reference slice: direction-sensitive ordered gates, sectors, track limits, wrong-way invalidation, physical shortcut rejection, separate valid/invalid lap accounting, native time-trial result flow and two valid runtime laps; broader alternate-route coverage remains |
| Race modes | practice, time trial, race, qualifying, weekend | PARTIAL: native Silverstone time-trial and one-lap QA race result flow are runtime-verified; qualifying and weekend orchestration remain |
| AI | browser path AI | PARTIAL: two same-class Ferrari 296 GT3 QA drivers complete a one-lap Silverstone grid; strategy, flags, traffic behavior and full race control remain |
| Damage | browser collision/damage state | NOT STARTED in Unity |
| Weather | dry/rain/wet grip and transitions | NOT STARTED in Unity |
| Audio | engine, tyre, UI, engineer | PARTIAL: audio architecture exists; native race mix not migrated |
| Engineer | contextual calls | NOT STARTED in Unity |
| Profile/dashboard | ratings, stats, unlocks, Game Master | NOT STARTED in Unity |
| Persistence | browser profile/local storage/Firebase-adjacent flows | NOT STARTED in Unity |

## Web content inventory

This list is the migration source of truth. A native feature is not considered
ready simply because a placeholder exists: it must consume the supplied source
asset or an explicitly approved replacement.

### Vehicles

| Web class | Browser IDs / source GLBs | Native status |
| --- | --- | --- |
| GT3 | `dacia`, `porsche`, `amg`, `audi`, `lamborghini`, `mustang`, `bentley`, `bmw`, `ferrari296gt3`; `assets/models/*gt3*.glb` plus `amg.glb`, `audi.glb`, `porsche-gt3.glb` | Ferrari 296 GT3 is the active vertical slice. All other GT3 cars are queued, not placeholders. |
| LMP2 | `oreca07`, `alpine-lmp2`; `assets/models/lmp2.glb` | NOT STARTED |
| Hypercar | `ferrari499p`, `toyota-gr010`, `alpinea424`, `cadillac-vseriesr`, `peugeot9x8`, `genesis-magma`, `porsche963-penske`; `assets/models/ferrari_hyp.glb`, `hyp.glb`, `alpine_a424.glb`, `cadillac.glb`, `2024__peugeot_9x8_evo.glb`, `genesis.glb`, `porsche_hyp.glb` | NOT STARTED |
| Formula | `ferrari-sf25`, `redbull-rb22`, `aston-amr26`, `williams-fw48`, `f2-2024`, `tatuus-ft60`, `dallara-f312`; matching GLBs under `assets/models/` | NOT STARTED. F1 entitlement and Game Master release controls are native product requirements, not yet implemented. |
| Kart | `kart-rental-bumper`, `kart-rental`; matching GLBs under `assets/models/` | NOT STARTED. Kart content remains in scope. |

The browser vehicle definitions in `gt3-web-racer.html` also provide useful
baseline mass, power, braking, top-speed, grip, damping and aero values. They
are reference inputs for native tuning, not a substitute for physical setup.

### Track assets

| Asset / supporting data | Native status |
| --- | --- |
| `assets/tracks/silverstone_gp.glb` | RUNTIME-VERIFIED as the active physical reference slice. Unity renders a glTFast-compatible source derivative because glTFast does not support `EXT_texture_webp`; decoded mesh/material data and all 69 decoded texture images match the source. Native traversal is officially clockwise; the logical centerline and S/F anchor remain aligned with the unchanged physical geometry. |
| `assets/tracks/monza_2020.glb`, `monza_2020_layout.glb`, `monza.centerline.json`, `monza.osm.json` | NOT STARTED |
| `assets/tracks/spa_francorchamps_2022.glb`, `spa_francorchamps_2022.centerline.json` | NOT STARTED |
| `assets/tracks/bahrain_2026.glb` | NOT STARTED |
| `assets/tracks/redbull_ring.glb`, `redbull_ring_2025_layout.glb`, `redbull-ring.centerline.json` | NOT STARTED |
| `assets/tracks/sachsenring.glb`, `sachsenring.centerline.json` | NOT STARTED |
| `assets/tracks/shanghai_2018.glb`, `shanghai_2018.centerline.json`, `shanghai_raceline.centerline.json` | NOT STARTED |
| `assets/tracks/hanoi_street_circuit.glb` | NOT STARTED |
| `assets/tracks/madring_2026.glb`, `madring_2026.centerline.json` | NOT STARTED |
| `assets/tracks/barcelona_catalunya_2023_layout.glb` | REMOVED FROM ACTIVE NATIVE SCOPE at the user's request; preserve source asset only. |
| `assets/tracks/kartbahn_lider.glb` | NOT STARTED |

`assets/tracks.js` additionally contains browser-only procedural, custom and
legacy layouts. They are reference content, but must not displace supplied
GLB circuits in the native production order.

### Systems and supporting content

| System | Browser reference | Native status / required migration work |
| --- | --- | --- |
| Player physics | `gt3-web-racer.html` vehicle update, tyre/grip/aero logic | RUNTIME-VERIFIED for the reference slice: Rigidbody/raycast wheels, physical suspension, combined tyre forces, aero, braking, reverse, handbrake, reset, two valid clockwise Silverstone laps, invalid-lap exclusion and 30/60/120/144 FPS vehicle QA. Subjective hardware feel remains open. |
| Input | keyboard/gamepad/wheel/touch handling in `gt3-web-racer.html` | PARTIAL. Device-specific controller, wheel and iPad touch verification remain. |
| AI and race control | browser AI around the race loop; `SafetyCar` implementation | NOT STARTED. Requires deterministic path following, grids, flags, safety car and penalties. |
| Lap rules | browser progress, sector and limits logic | VERIFIED for Silverstone runtime laps and classified wrong-way, track-limit, ordered-checkpoint-skip, physical-shortcut and reset probes; broader alternate-route coverage remains. |
| Weather | browser weather state and wet-grip changes | NOT STARTED |
| Damage | browser collision/damage state | NOT STARTED |
| Audio and engineer | browser sample manifest and engineer calls | PARTIAL audio plumbing only. Native licensed sound import and contextual engineer queue are NOT STARTED. |
| HUD/dashboard | browser HUD, draggable controls and telemetry | PARTIAL. Native telemetry exists; visual parity and editable gas/brake/steering placement remain. |
| Profile, safety, entitlement | `assets/gt3-career.js`, `assets/gridline-account.js`, `assets/gt3-firebase.js` | NOT STARTED. Includes safety rating, stats, Platinum F1 lock and Game Master unlock authority. |
| Aircraft | `assets/airplane/models/*.glb` | NOT STARTED. Requires actual flyovers and low passes, not static scenery. |
| Cloud/Firebase | browser Firebase modules and account flow | NOT STARTED. Native service must use server-authoritative grants and never trust a client-side Platinum flag. |

### Native build order

1. Complete the Ferrari 296 GT3 plus supplied Silverstone GP: correct direction,
   controls, tyres, collision, valid lap, limits and reset.
2. Lock repeatable macOS, Windows and iOS/Xcode builds, then profile the iPad A16 target.
3. Build time trial and race rules on the same validated track data.
4. Add AI/race control, then weather, damage and audio/engineer systems.
5. Migrate vehicles and GLB tracks one at a time with their own collision,
   direction, lap-gate and performance acceptance tests.
6. Add accounts, safety rating, entitlement and Game Master tools only after
   native gameplay data is authoritative.

## Current gate

The Rigidbody-driven and repeatable Silverstone lap gate is passed for the
Ferrari 296 GT3 reference slice in the official clockwise direction. The two
older reverse-direction autonomous laps are explicitly excluded from this gate.
The current build also passes the bounded one-lap QA grid with two same-class
AI cars; short AI kerb-contact events remain a follow-up telemetry item.
The centerline remains telemetry/path data only; its alignment to the supplied
GLB asphalt is audited offline. Vehicle support and elevation come from the
imported track collision geometry.

The shortcut, wrong-way and reset probes are now runtime-validated on the
current macOS player, and the fresh `e3fe8bdd` player has passed the native
time-trial result gate plus two consecutive valid clockwise laps. The remaining
gates are manual controller/wheel input, iPad/Windows runtime validation and
broader alternate-route coverage. Those results must remain separate from
automated-driver evidence.
