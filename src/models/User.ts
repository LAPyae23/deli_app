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
}, { timestamps: true }); // Create, Update လုပ်တဲ့ အချိန်တွေကို မှတ်သားဖို့

export default mongoose.models.User || mongoose.model('User', UserSchema);