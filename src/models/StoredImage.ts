// models/StoredImage.ts — uploaded images kept in MongoDB (Vercel has no writable disk).
import mongoose from 'mongoose';

const StoredImageSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    ownerId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

if (mongoose.models.StoredImage) {
  delete mongoose.models.StoredImage;
}

export default mongoose.model('StoredImage', StoredImageSchema);
