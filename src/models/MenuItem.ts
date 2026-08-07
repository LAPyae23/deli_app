// models/MenuItem.ts
import mongoose from 'mongoose';

const AddonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    extraPrice: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const MenuItemSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    discountPrice: { type: Number },
    prepTime: { type: Number },
    stockQuantity: { type: Number, required: true, default: 0 },
    isAvailable: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
    dietaryTags: [{ type: String }],
    addons: [AddonSchema],
    image: { type: String, default: '' },
    imageAlt: { type: String, default: '' },
  },
  { timestamps: true }
);

// Recompile model so schema upgrades apply during hot reload
if (mongoose.models.MenuItem) {
  delete mongoose.models.MenuItem;
}

export default mongoose.model('MenuItem', MenuItemSchema);
