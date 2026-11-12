// models/PromoRedemption.ts — one row per use of a campaign code
import mongoose from 'mongoose';

const PromoRedemptionSchema = new mongoose.Schema(
  {
    /** `${code}:${customerId}:${n}` — unique, so two parallel orders cannot both take use n. */
    key: { type: String, required: true, unique: true },
    code: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    orderId: { type: String, default: '' },
    discount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

if (mongoose.models.PromoRedemption) delete mongoose.models.PromoRedemption;
export default mongoose.model('PromoRedemption', PromoRedemptionSchema);
