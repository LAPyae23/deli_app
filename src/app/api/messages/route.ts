import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Message from '@/models/Message';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const senderId = searchParams.get('senderId');
    const receiverId = searchParams.get('receiverId');

    const query: Record<string, unknown> = {};

    if (orderId) {
      query.orderId = orderId;
      // Optionally narrow to the two participants when provided
      if (senderId && receiverId) {
        query.$or = [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ];
      }
    } else if (senderId && receiverId) {
      query.$or = [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ];
    } else {
      return NextResponse.json(
        { success: false, message: 'orderId or senderId+receiverId required' },
        { status: 400 }
      );
    }

    const messages = await Message.find(query).sort({ createdAt: 1 });
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

    if (!senderId || !senderRole || !receiverId || !receiverRole || !text) {
      return NextResponse.json(
        { success: false, message: 'Missing required message fields' },
        { status: 400 }
      );
    }

    const newMessage = await Message.create({
      orderId: body.orderId ? String(body.orderId) : undefined,
      senderId,
      senderRole,
      receiverId,
      receiverRole,
      text,
      isRead: false,
    });

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Messages POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to send message' },
      { status: 500 }
    );
  }
}
