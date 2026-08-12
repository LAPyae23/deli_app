// models/Message.ts
import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
  {
    orderId: { type: String },
    senderId: { type: String, required: true, index: true },
    senderRole: { type: String, required: true },
    receiverId: { type: String, required: true, index: true },
    receiverRole: { type: String, required: true },
    text: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

if (mongoose.models.Message) {
  delete mongoose.models.Message;
}

export default mongoose.model('Message', MessageSchema);
