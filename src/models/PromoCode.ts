// models/PromoCode.ts — platform-wide promo campaigns created by admins
import mongoose from 'mongoose';

const PromoCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    /** PERCENT: value % off the subtotal; FLAT: value Ks off; FREE_DELIVERY: delivery fee off. */
    kind: { type: String, enum: ['PERCENT', 'FLAT', 'FREE_DELIVERY'], default: 'PERCENT' },
    value: { type: Number, default: 0 },
    /** Upper limit for PERCENT discounts (0 = no cap). */
    maxDiscount: { type: Number, default: 0 },
    minSubtotal: { type: Number, default: 0 },
    firstOrderOnly: { type: Boolean, default: false },
    /** How many times one customer may use the code. */
    perUserLimit: { type: Number, default: 1 },
    /** Total uses across all customers (0 = unlimited). */
    totalLimit: { type: Number, default: 0 },
    usedCount: { type: Number, default: 0 },
    startsAt: { type: Date },
    expiresAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

if (mongoose.models.PromoCode) delete mongoose.models.PromoCode;
export default mongoose.model('PromoCode', PromoCodeSchema);
