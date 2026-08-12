// models/SystemConfig.ts
import mongoose from 'mongoose';

const SurgeZoneStateSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    multiplier: { type: Number, default: 1.0 },
    active: { type: Boolean, default: false },
    autoActivated: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SystemConfigSchema = new mongoose.Schema(
  {
    globalCommission: { type: Number, default: 18 },
    platformFee: { type: Number, default: 0.5 },
    autoSurge: { type: Boolean, default: true },
    /** Activate surge when activeOrders / availableRiders >= this ratio */
    surgeImbalanceThreshold: { type: Number, default: 2 },
    /** Last auto/manual zone multipliers written by the balancer */
    surgeZones: { type: [SurgeZoneStateSchema], default: [] },
  },
  { timestamps: true }
);

if (mongoose.models.SystemConfig) {
  delete mongoose.models.SystemConfig;
}

export default mongoose.model('SystemConfig', SystemConfigSchema);
