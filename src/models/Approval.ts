// models/Approval.ts
import mongoose from 'mongoose';

const ApprovalSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['VENDOR', 'RIDER'],
      required: true,
    },
    name: { type: String, required: true },
    submittedBy: { type: String, default: '' },
    email: { type: String, default: '' },
    documents: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    commissionRate: { type: Number },
    vehicleType: { type: String },
    flagged: { type: Boolean, default: false },
    submittedAt: { type: String, default: '' },
  },
  { timestamps: true }
);

if (mongoose.models.Approval) {
  delete mongoose.models.Approval;
}

export default mongoose.model('Approval', ApprovalSchema);
