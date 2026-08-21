import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Message from '@/models/Message';
import User from '@/models/User';
import RestaurantProfile from '@/models/RestaurantProfile';
import { SUPPORT_ADMIN_ID } from '@/lib/support';

type LeanMessage = {
  senderId?: string;
  senderRole?: string;
  receiverId?: string;
  receiverRole?: string;
  text?: string;
  createdAt?: Date | string;
};

type Conversation = {
  contactId: string;
  contactName: string;
  contactRole: string;
  lastMessageText: string;
  updatedAt: string;
};

export async function GET() {
  try {
    await dbConnect();

    const messages = (await Message.find({
      $or: [
        { senderRole: 'ADMIN' },
        { receiverRole: 'ADMIN' },
        { senderId: SUPPORT_ADMIN_ID },
        { receiverId: SUPPORT_ADMIN_ID },
      ],
    })
      .select('senderId senderRole receiverId receiverRole text createdAt')
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean()) as LeanMessage[];

    const conversationMap = new Map<string, Conversation>();

    for (const msg of messages) {
      const senderRole = String(msg.senderRole || '').toUpperCase();
      const senderId = String(msg.senderId || '');
      const receiverId = String(msg.receiverId || '');

      const adminIsSender =
        senderRole === 'ADMIN' || senderId === SUPPORT_ADMIN_ID;
      const contactId = adminIsSender ? receiverId : senderId;
      const contactRole = adminIsSender
        ? String(msg.receiverRole || 'USER')
        : String(msg.senderRole || 'USER');

      if (!contactId || contactId === SUPPORT_ADMIN_ID || conversationMap.has(contactId)) {
        continue;
      }

      const updatedAt = msg.createdAt
        ? new Date(msg.createdAt).toISOString()
        : new Date().toISOString();

      conversationMap.set(contactId, {
        contactId,
        contactName: contactId,
        contactRole: contactRole.toUpperCase(),
        lastMessageText: String(msg.text || ''),
        updatedAt,
      });
    }

    const rows = Array.from(conversationMap.values());
    const restaurantIds = rows
      .filter((row) => row.contactRole === 'RESTAURANT')
      .map((row) => row.contactId);
    const userIds = rows
      .map((row) => row.contactId)
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    const [restaurants, users] = await Promise.all([
      restaurantIds.length
        ? RestaurantProfile.find({ restaurantId: { $in: restaurantIds } })
            .select('restaurantId restaurantName')
            .lean()
        : Promise.resolve([]),
      userIds.length
        ? User.find({ _id: { $in: userIds } })
            .select('firstName lastName email')
            .lean()
        : Promise.resolve([]),
    ]);

    const restaurantNameById = new Map(
      restaurants.map((r) => [String(r.restaurantId), String(r.restaurantName || '')])
    );
    const userNameById = new Map(
      users.map((u) => {
        const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
        return [String(u._id), name || String(u.email || '')] as const;
      })
    );

    const conversations = rows.map((conv) => {
      const fromRestaurant = restaurantNameById.get(conv.contactId);
      const fromUser = userNameById.get(conv.contactId);
      return {
        ...conv,
        contactName:
          fromRestaurant ||
          fromUser ||
          `${conv.contactRole || 'User'} · ${conv.contactId.slice(-6)}`,
      };
    });

    conversations.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return NextResponse.json({ success: true, conversations });
  } catch (error) {
    console.error('Admin messages GET error:', error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Failed to fetch conversations';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
