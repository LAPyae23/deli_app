// models/GroupOrder.ts — several customers fill one cart from one restaurant; the host checks out
import mongoose from 'mongoose';

const GroupItemSchema = new mongoose.Schema(
  {
    menuItemId: { type: String, required: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1, max: 20 },
  },
  { _id: false }
);

const MemberSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true },
    name: { type: String, default: 'Guest' },
    items: { type: [GroupItemSchema], default: [] },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const GroupOrderSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    hostId: { type: String, required: true, index: true },
    hostName: { type: String, default: '' },
    restaurantId: { type: String, required: true },
    restaurantName: { type: String, default: '' },
    /** OPEN: members can edit; LOCKED: host is checking out; PLACED / CANCELLED: finished. */
    status: { type: String, enum: ['OPEN', 'LOCKED', 'PLACED', 'CANCELLED'], default: 'OPEN' },
    members: { type: [MemberSchema], default: [] },
    orderId: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Unfinished groups disappear a day after they expire.
GroupOrderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 3600 });

if (mongoose.models.GroupOrder) delete mongoose.models.GroupOrder;
export default mongoose.model('GroupOrder', GroupOrderSchema);
