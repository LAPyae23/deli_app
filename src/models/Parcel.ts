// models/Parcel.ts — person-to-person parcel delivery (FoodDash Express)
import mongoose from 'mongoose';

const PlaceSchema = new mongoose.Schema(
  {
    address: { type: String, required: true },
    detail: { type: String, default: '' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const ParcelSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    senderId: { type: String, required: true, index: true },
    senderName: { type: String, default: '' },
    senderPhone: { type: String, default: '' },
    pickup: { type: PlaceSchema, required: true },
    dropoff: { type: PlaceSchema, required: true },
    recipientName: { type: String, required: true },
    recipientPhone: { type: String, required: true },
    /** Set when the recipient phone belongs to a FoodDash customer. */
    recipientId: { type: String, index: true },
    size: { type: String, enum: ['SMALL', 'MEDIUM', 'LARGE'], default: 'SMALL' },
    description: { type: String, default: '' },
    notes: { type: String, default: '' },
    /** Who pays the rider in cash. */
    payer: { type: String, enum: ['SENDER', 'RECIPIENT'], default: 'SENDER' },
    price: {
      roadKm: Number,
      baseFee: Number,
      distanceFee: Number,
      sizeFee: Number,
      total: Number,
      riderEarning: Number,
      platformFee: Number,
    },
    etaMins: { type: Number },
    status: {
      type: String,
      enum: ['REQUESTED', 'ACCEPTED', 'PICKED_UP', 'DELIVERED', 'CANCELLED'],
      default: 'REQUESTED',
      index: true,
    },
    /** 4-digit proof-of-delivery code; never shown to the rider. */
    deliveryPin: { type: String, required: true },
    riderId: { type: String, default: '', index: true },
    riderName: { type: String, default: '' },
    riderPhone: { type: String, default: '' },
    riderCoords: { lat: Number, lng: Number },
    acceptedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    cancelReason: { type: String, default: '' },
  },
  { timestamps: true }
);

ParcelSchema.index({ status: 1, createdAt: 1 });

if (mongoose.models.Parcel) {
  delete mongoose.models.Parcel;
}

export default mongoose.model('Parcel', ParcelSchema);
