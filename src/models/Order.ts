import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true },
    restaurantName: { type: String },
    restaurantId: { type: String },
    customerName: { type: String, default: 'Customer' },
    status: { type: String, default: 'PENDING' },
    prepTime: { type: Number },
    restaurantCoords: {
      lat: { type: Number },
      lng: { type: Number },
    },
    riderId: { type: String },
    riderName: { type: String },
    riderCoords: {
      lat: { type: Number },
      lng: { type: Number },
    },
    items: { type: mongoose.Schema.Types.Mixed },
    totals: { type: mongoose.Schema.Types.Mixed },
    deliveryAddress: { type: mongoose.Schema.Types.Mixed },
    paymentMethod: { type: String },
    restaurantRating: { type: Number },
    riderRating: { type: Number },
    reviewComment: { type: String },
  },
  { timestamps: true }
);

if (mongoose.models.Order) {
  delete mongoose.models.Order;
}

export default mongoose.model('Order', OrderSchema);
