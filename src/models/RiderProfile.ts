// models/RiderProfile.ts
import mongoose from 'mongoose';

const RiderProfileSchema = new mongoose.Schema(
  {
    riderId: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    vehicle: { type: String, default: '' },
    licensePlate: { type: String, default: '' },
    profileImage: { type: String, default: '' },
  },
  { timestamps: true }
);

if (mongoose.models.RiderProfile) {
  delete mongoose.models.RiderProfile;
}

export default mongoose.model('RiderProfile', RiderProfileSchema);
