const KEY = 'srplus.settings.v1';
export const defaults = { hud: true, surface: true, minimap: true, debug: false };
export function loadSettings(storage = globalThis.localStorage) { try { return { ...defaults, ...JSON.parse(storage.getItem(KEY) || '{}') }; } catch { return { ...defaults }; } }
export function saveSettings(settings, storage = globalThis.localStorage) { storage.setItem(KEY, JSON.stringify(settings)); }
