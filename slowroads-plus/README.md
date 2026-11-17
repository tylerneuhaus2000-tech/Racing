# SR+ / Slow Roads Plus

Private client-side enhancement mod for [Slow Roads](https://slowroads.io/). SR+ does not copy or redistribute Slow Roads code or assets. It runs as a Tampermonkey userscript while the original site is open.

## v0.1-alpha

Includes an isolated loader, settings, HUD, trip statistics, safe distance filtering, driven-path minimap, discovery/debug report, and a documented VehicleManager foundation. Because the deployed game has not yet been inspected in-browser, the adapter starts in a clearly marked degraded mode: surface is `UNKNOWN`, and no game-state values are invented.

## Installation

1. Install Tampermonkey in Chrome/Chromium.
2. Run `npm run build` in this directory.
3. Create a new Tampermonkey script and paste `dist/sr-plus.user.js`.
4. Save, then open or reload `https://slowroads.io/`.

## Controls

F2 menu · H HUD · M minimap. Enable Debug mode in F2 to see discovery status and copy a report.

## Architecture

`src/adapters` isolates external-game discovery; `src/telemetry` owns normalized trip data; `src/ui` owns presentation; `src/core` contains pure logic; `assets/vehicles` is reserved for future user-owned GLB/GLTF models. See [docs/TESTING.md](docs/TESTING.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## Development

`npm test` runs pure logic tests. `npm run build` creates the installable userscript. Test inside Slow Roads and send the complete text from **COPY DEBUG REPORT** if discovery or telemetry does not work.
