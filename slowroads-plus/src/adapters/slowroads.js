export class SlowRoadsAdapter {
  constructor(root = globalThis) { this.root = root; this.hooks = {}; this.discover(); }
  discover() {
    const r = this.root;
    const candidates = Object.entries(r).filter(([, v]) => v && typeof v === 'object').slice(0, 200);
    this.hooks = { three: Boolean(r.THREE), scene: Boolean(r.scene || r.Scene), camera: Boolean(r.camera || r.Camera), vehicle: Boolean(r.vehicle || r.player || r.car), road: Boolean(r.road || r.roadGeometry) };
    this.telemetrySource = 'fallback (no verified Slow Roads hook)';
    this.candidateCount = candidates.length;
  }
  sample() { return { position: null, speed: null, heading: null, surface: 'UNKNOWN', source: this.telemetrySource }; }
  report() { return { ...this.hooks, telemetrySource: this.telemetrySource, candidateCount: this.candidateCount }; }
}
