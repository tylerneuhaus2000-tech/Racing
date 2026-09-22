# GRIDLINE Unreal Import Manifest

This manifest keeps the first Unreal milestone tied to files already in the repository. It is deliberately small for Windows, macOS, and iPadOS.

## Reference track candidate

`assets/tracks/silverstone_gp.glb` is the first candidate because it is a moderate-size existing mesh and the repository already contains `assets/tracks/silverstone-gp-ai.js` for track logic reference.

Before import is accepted, Unreal must verify the mesh itself for:

- road and curb materials
- collision or collision source geometry
- elevation
- start/finish placement
- real pit lane availability
- usable track boundaries

If the source mesh does not contain a real pit lane, pit functionality stays disabled. No pit lane is generated.

## Reference vehicle

`assets/models/ferrari_296_gt3.glb` is the first vehicle candidate because it is already used by the racing prototype and is small enough for the low-quality target.

Before import is accepted, Unreal must verify:

- forward axis and scale
- wheel bones or wheel locations
- collision suitability
- material count
- whether a simplified collision/LOD is required

## Import rules

- Keep original source files unchanged.
- Import only the selected track and vehicle for the first milestone.
- Do not import Barcelona into the Unreal project.
- Do not create replacement scenery, barriers, or pit geometry.
- Record any source-asset limitation before compensating in code.
