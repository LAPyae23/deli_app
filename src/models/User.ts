// models/User.ts
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true }, // Production မှာဆိုရင် Password ကို Hash လုပ်ပြီးမှ သိမ်းသင့်ပါတယ်
  role: { 
    type: String, 
    required: true, 
    enum: ['CUSTOMER', 'RESTAURANT', 'RIDER', 'ADMIN'] 
  },
  displayId: { type: String },
  /** Rider COD float — negative means the rider owes the platform */
  walletBalance: { type: Number, default: 0 },
  /** Auto-set when rider COD wallet hits -50,000 MMK */
  isBlocked: { type: Boolean, default: false, index: true },
}, { timestamps: true }); // Create, Update လုပ်တဲ့ အချိန်တွေကို မှတ်သားဖို့

if (mongoose.models.User) {
  delete mongoose.models.User;
}

export default mongoose.model('User', UserSchema);