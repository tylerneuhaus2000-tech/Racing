import { classifySurface, percentages, safeStep } from '../core/logic.js';
export class Trip {
  constructor(clock = () => performance.now()) { this.clock = clock; this.reset(); }
  reset() { this.started = this.clock(); this.last = null; this.distance = 0; this.stats = { road: 0, offroad: 0, other: 0 }; this.samples = 0; this.path = []; }
  update(sample) { this.samples++; const p = sample.position; const d = safeStep(this.last, p); if (d > 0) { const key = classifySurface(sample.surface); this.stats[key === 'ROAD' ? 'road' : key === 'OFFROAD' ? 'offroad' : 'other'] += d; this.distance += d; this.path.push({ x: p.x, y: p.y, z: p.z }); } if (p) this.last = p; }
  snapshot() { return { distance: this.distance, elapsed: Math.max(0, this.clock() - this.started), stats: { ...this.stats }, percentages: percentages(this.stats), path: this.path.slice(-1000), samples: this.samples }; }
}
