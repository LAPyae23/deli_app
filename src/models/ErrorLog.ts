// models/ErrorLog.ts — server and browser errors, kept 14 days, for the admin health screen
import mongoose from 'mongoose';

const ErrorLogSchema = new mongoose.Schema(
  {
    source: { type: String, enum: ['server', 'client'], default: 'server' },
    route: { type: String, default: '' },
    method: { type: String, default: '' },
    message: { type: String, default: '' },
    stack: { type: String, default: '' },
    digest: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
);

ErrorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 14 * 24 * 3600 });
ErrorLogSchema.index({ source: 1, createdAt: -1 });

if (mongoose.models.ErrorLog) delete mongoose.models.ErrorLog;
export default mongoose.model('ErrorLog', ErrorLogSchema);
