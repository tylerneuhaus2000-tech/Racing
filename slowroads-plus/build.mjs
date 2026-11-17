import { readFile, mkdir, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
const files = ['src/core/logic.js', 'src/core/settings.js', 'src/adapters/slowroads.js', 'src/telemetry/trip.js', 'src/ui/hud.js', 'src/ui/menu.js', 'src/ui/minimap.js', 'src/ui/debug.js', 'src/vehicle/manager.js', 'src/main.js'];
let out = `// ==UserScript==
// @name SR+ Slow Roads Plus
// @namespace sr-plus
// @version 0.1.0-alpha
// @match https://slowroads.io/*
// @run-at document-idle
// ==/UserScript==
// SR+ v0.1.0-alpha — generated userscript\n`;
for (const file of files) { let source = await readFile(file, 'utf8'); source = source.replace(/^import .*;\n/gm, '').replace(/^export /gm, ''); out += `\n/* ${file} */\n${source}\n`; }
await writeFile('dist/sr-plus.user.js', out);
console.log('Built dist/sr-plus.user.js');
