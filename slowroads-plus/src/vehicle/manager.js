export class VehicleManager { constructor() { this.active = null; } register(config) { this.active = { ...config, type: config.type === 'motorcycle' ? 'motorcycle' : 'car' }; return this.active; } }
