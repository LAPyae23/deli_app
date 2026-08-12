import { NextResponse } from 'next/server';
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

async function resolveContactName(contactId: string, contactRole: string): Promise<string> {
  try {
    if (contactRole === 'RESTAURANT') {
      const profile = await RestaurantProfile.findOne({ restaurantId: contactId }).lean();
      if (profile?.restaurantName) return String(profile.restaurantName);
    }

    const user = await User.findById(contactId).lean();
    if (user) {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      if (name) return name;
      if (user.email) return String(user.email);
    }
  } catch {
    // fall through
  }

  const roleLabel =
    contactRole === 'CUSTOMER'
      ? 'Customer'
      : contactRole === 'RIDER'
        ? 'Rider'
        : contactRole === 'RESTAURANT'
          ? 'Restaurant'
          : contactRole || 'User';

  return `${roleLabel} · ${contactId.slice(-6)}`;
}

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
      .sort({ createdAt: -1 })
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

    const conversations = await Promise.all(
      Array.from(conversationMap.values()).map(async (conv) => ({
        ...conv,
        contactName: await resolveContactName(conv.contactId, conv.contactRole),
      }))
    );

    conversations.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return NextResponse.json({ success: true, conversations });
  } catch (error) {
    console.error('Admin messages GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
