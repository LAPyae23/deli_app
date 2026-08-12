// models/RiderRoute.ts
import mongoose from 'mongoose';

const ActiveStopSchema = new mongoose.Schema(
  {
    location: { type: String, default: '' },
    orderId: { type: String, required: true },
    stopType: {
      type: String,
      enum: ['PICKUP', 'DROPOFF'],
      required: true,
    },
    sequence: { type: Number, required: true },
    status: {
      type: String,
      enum: ['COMPLETED', 'PENDING'],
      default: 'PENDING',
    },
  },
  { _id: false }
);

const RiderRouteSchema = new mongoose.Schema(
  {
    riderId: { type: String, required: true, index: true },
    activeStops: { type: [ActiveStopSchema], default: [] },
  },
  { timestamps: true }
);

if (mongoose.models.RiderRoute) {
  delete mongoose.models.RiderRoute;
}

export default mongoose.model('RiderRoute', RiderRouteSchema);
