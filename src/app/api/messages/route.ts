import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Message from '@/models/Message';
import { SUPPORT_ADMIN_ID, SUPPORT_ADMIN_ROLE } from '@/lib/support';

const SUPPORT_BOT_TEXT =
  'Hello! FoodDash Support Bot here. We have received your message. A human agent will assist you shortly.';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const senderId = searchParams.get('senderId')?.trim() || '';
    const receiverId = searchParams.get('receiverId')?.trim() || '';
    const orderId = searchParams.get('orderId')?.trim() || '';

    if (!senderId || !receiverId) {
      return NextResponse.json(
        { success: false, message: 'senderId and receiverId are required' },
        { status: 400 }
      );
    }

    const query: Record<string, unknown> = {
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    };

    if (orderId) {
      query.orderId = orderId;
    }

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();
    return NextResponse.json({ success: true, messages });
  } catch (error) {
    console.error('Messages GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();

    const senderId = String(body.senderId || '').trim();
    const senderRole = String(body.senderRole || '').trim();
    const receiverId = String(body.receiverId || '').trim();
    const receiverRole = String(body.receiverRole || '').trim();
    const text = String(body.text || '').trim();
    const orderId = body.orderId ? String(body.orderId) : undefined;

    if (!senderId || !senderRole || !receiverId || !receiverRole || !text) {
      return NextResponse.json(
        { success: false, message: 'Missing required message fields' },
        { status: 400 }
      );
    }

    const newMessage = await Message.create({
      orderId,
      senderId,
      senderRole,
      receiverId,
      receiverRole,
      text,
      isRead: false,
    });

    const messagingSupport =
      receiverId === SUPPORT_ADMIN_ID &&
      senderId !== SUPPORT_ADMIN_ID &&
      senderRole.toUpperCase() !== 'ADMIN';

    if (messagingSupport) {
      await Message.create({
        orderId,
        senderId: SUPPORT_ADMIN_ID,
        senderRole: SUPPORT_ADMIN_ROLE,
        receiverId: senderId,
        receiverRole: senderRole,
        text: SUPPORT_BOT_TEXT,
        isRead: false,
      });
    }

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Messages POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to send message' },
      { status: 500 }
    );
  }
}
