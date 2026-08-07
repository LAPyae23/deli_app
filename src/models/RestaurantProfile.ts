// models/RestaurantProfile.ts
import mongoose from 'mongoose';

const RestaurantProfileSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, unique: true },
    restaurantName: { type: String, default: '' },
    description: { type: String, default: '' },
    logoImage: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    address: { type: String, default: '' },
    location: {
      lat: { type: Number, default: 16.8409 },
      lng: { type: Number, default: 96.1735 },
    },
    openingTime: { type: String, default: '09:00' },
    closingTime: { type: String, default: '22:00' },
  },
  { timestamps: true }
);

if (mongoose.models.RestaurantProfile) {
  delete mongoose.models.RestaurantProfile;
}

export default mongoose.model('RestaurantProfile', RestaurantProfileSchema);
