import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true },
    restaurantName: { type: String },
    restaurantId: { type: String },
    customerId: { type: String, index: true },
    customerName: { type: String, default: 'Customer' },
    status: { type: String, default: 'PENDING' },
    // Kitchen cooking time (minutes) — separate from rider travel
    prepTime: { type: Number, default: 15 },
    // Rider on-road travel time (minutes)
    travelMins: { type: Number, default: 15 },
    restaurantCoords: {
      lat: { type: Number },
      lng: { type: Number },
    },
    riderId: { type: String },
    unassigned: { type: Boolean, default: true },
    riderName: { type: String },
    riderCoords: {
      lat: { type: Number },
      lng: { type: Number },
    },
    items: [
      {
        name: { type: String, required: true },
        category: {
          type: String,
          enum: ['Fast Food', 'Burmese', 'Drinks', 'Dessert'],
          default: 'Fast Food',
        },
        price: { type: Number, required: true },
        quantity: { type: Number, default: 1 },
        // Optional fields kept for cart / UI compatibility
        id: { type: String },
        options: { type: String },
        unitPrice: { type: Number },
        restaurantName: { type: String },
        image: { type: String },
        imageAlt: { type: String },
        note: { type: String },
      },
    ],
    totals: { type: mongoose.Schema.Types.Mixed },
    deliveryAddress: { type: mongoose.Schema.Types.Mixed },
    paymentMethod: { type: String },
    restaurantRating: { type: Number },
    riderRating: { type: Number },
    reviewComment: { type: String },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String },
    baseRiderFee: { type: Number },
    tipAmount: { type: Number, default: 0 },
    distanceKm: { type: Number, default: 3.5 },
    // Total end-to-end time ≈ prepTime + travelMins
    durationMins: { type: Number, default: 30 },
    customerOrderCount: { type: Number, default: 1 }, // Number of times this customer has ordered
    completedAt: { type: Date },
    discount: { type: Number, default: 0 },
    surgePrice: { type: Number, default: 0 },
    weather: {
      type: String,
      enum: ['Sunny', 'Rainy', 'Cloudy', 'Stormy'],
      default: 'Sunny',
    },
    vehicleType: {
      type: String,
      enum: ['Motorcycle', 'Bicycle', 'Car'],
      default: 'Motorcycle',
    },
    cancelReason: { type: String, default: '' },
  },
  { timestamps: true }
);

OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, createdAt: -1 });
OrderSchema.index({ restaurantName: 1, createdAt: -1 });
OrderSchema.index({ riderId: 1, status: 1, completedAt: -1 });
OrderSchema.index({ restaurantRating: 1 });
OrderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ customerId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ riderId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ status: 1, unassigned: 1, createdAt: -1 });

if (mongoose.models.Order) {
  delete mongoose.models.Order;
}

export default mongoose.model('Order', OrderSchema);
