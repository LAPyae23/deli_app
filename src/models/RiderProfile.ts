// models/RiderProfile.ts
import mongoose from 'mongoose';

const RiderProfileSchema = new mongoose.Schema(
  {
    riderId: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    vehicle: { type: String, default: '' },
    vehicleType: {
      type: String,
      enum: ['Motorcycle', 'Bicycle', 'Car'],
      default: 'Motorcycle',
    },
    status: {
      type: String,
      enum: ['Online', 'Offline'],
      default: 'Offline',
    },
    licensePlate: { type: String, default: '' },
    profileImage: { type: String, default: '' },
    township: { type: String, default: '', index: true },
    /** Static / last-known position — offline riders keep fixed township coords for map tests */
    riderCoords: {
      lat: { type: Number },
      lng: { type: Number },
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    approvalStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'APPROVED',
      index: true,
    },
    /** Rider COD float — negative means the rider owes the platform */
    walletBalance: { type: Number, default: 0 },
    /** Auto-set when rider COD wallet hits -50,000 MMK; blocked riders get no new orders */
    isBlocked: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

if (mongoose.models.RiderProfile) {
  delete mongoose.models.RiderProfile;
}

export default mongoose.model('RiderProfile', RiderProfileSchema);
