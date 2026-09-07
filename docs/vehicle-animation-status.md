# Vehicle import and animation status

## Imports

The vehicle downloads dated September 7 were compared with the catalog:

| Download | Integration |
| --- | --- |
| Dacia Logan Ollis Garage Racing | Already present as `dacia` |
| Porsche 992 GT3 R | Already present as Porsche livery `992gt3r` |
| Mercedes AMG Vecarz | Added as AMG livery `vecarz`; retains Classic |
| Lamborghini Huracan GT3 Evo | Correct model for existing Huracan entry |
| Ford Mustang GT3 | Added as separate GT3 entry |
| Bentley Continental Centenary | Added as separate GT3 entry |

Mustang and Bentley physics values are game balancing values, not verified
manufacturer specifications. New entries are available through the ordinary
vehicle catalog; career contract progression has not been changed.

## Animation implementation

`assets/vehicle-animation.js` splits recognized wheel triangles into four
car-local groups. Y steering and X rolling have separate pivots. Rolling uses
signed speed and detected radius, including reverse and rear wheel slip.
Brake calipers steer but do not roll. Steering-wheel parts rotate around a
separate pivot with a configurable column axis and steering ratio.

Quantized integer position/normal/tangent attributes are decoded before
transformation. Geometry is cloned so cached templates are not modified.

## Remaining work

This is not a completed all-vehicle rigging pass. Geometry detection is a
candidate rig, not a visual confirmation of correct part membership.

- No wheel geometry detected: Classic Porsche, BMW M4, both LMP2 entries,
  Toyota GR010 placeholder, Alpine A424, unbumpered rental kart.
- No steering wheel detected: the above plus Classic AMG, Audi, Huracan,
  Mustang, Bentley, Cadillac, Genesis, Porsche 963, Tatuus and bumper kart.
- Anonymous exports and fused/merged meshes need component segmentation and
  explicit pivots verified against a rendered model.
- Mustang detection currently finds rim-sized components; tire membership
  must be checked visually before release.
- New model orientation, cockpit camera placement, steering-column axes,
  texture appearance and iPad performance still need visual testing.
- AI cars retain their existing procedural wheel and cockpit animations.

## Verification

Run `node tools/vehicle-animation-audit.cjs /path/to/three-r128.cjs` using the
same Three.js r128 distribution loaded by the game. The audit loads every
catalog GLB with the production GLTFLoader and Meshopt decoder, stubbing only
texture loading. It checks finite wheel transforms, plausible radii, fixed
pivots, front steering and reverse rotation with a translated/rotated car.

The browser automation connection failed during setup with a sandbox metadata
error. No browser/iPad visual verification or production deployment was done.
