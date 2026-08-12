// models/CustomerProfile.ts
import mongoose from 'mongoose';

const SavedAddressSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' },
    address: { type: String, default: '' },
    detail: { type: String, default: '' },
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: false }
);

const CustomerProfileSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    profileImage: { type: String, default: '' },
    savedAddresses: { type: [SavedAddressSchema], default: [] },

    /** Daily login streak (calendar days) */
    streakCount: { type: Number, default: 0 },
    /** Last dashboard check-in day (stored as Date at UTC midnight) */
    lastLoginDate: { type: Date, default: null },

    /** 7-day streak reward — 10% off voucher */
    hasStreakReward: { type: Boolean, default: false },
    streakDiscountPercent: { type: Number, default: 0 },
    streakVoucherCode: { type: String, default: '' },
  },
  { timestamps: true }
);

if (mongoose.models.CustomerProfile) {
  delete mongoose.models.CustomerProfile;
}

export default mongoose.model('CustomerProfile', CustomerProfileSchema);
