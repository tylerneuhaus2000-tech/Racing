export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function classifySurface(value) {
  const s = String(value ?? '').toLowerCase();
  if (!s) return 'UNKNOWN';
  if (/road|asphalt|pavement|tarmac/.test(s)) return 'ROAD';
  if (/grass|off.?road|dirt|gravel|sand|mud|snow/.test(s)) return 'OFFROAD';
  return 'OTHER';
}
export function safeStep(previous, current, maxJump = 250) {
  if (!previous || !current) return 0;
  const d = Math.hypot(current.x - previous.x, current.y - previous.y, current.z - previous.z);
  return Number.isFinite(d) && d <= maxJump ? d : 0;
}
export function percentages(stats) {
  const total = stats.road + stats.offroad + stats.other;
  return total ? { road: stats.road / total * 100, offroad: stats.offroad / total * 100, other: stats.other / total * 100 } : { road: 0, offroad: 0, other: 0 };
}
