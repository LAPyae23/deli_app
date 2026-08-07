import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

function mapNotification(doc: Record<string, unknown>) {
  const createdAt = doc.createdAt ? new Date(String(doc.createdAt)) : new Date();

  return {
    id: String(doc._id),
    type: doc.type as string,
    title: (doc.title as string) || 'Notification',
    message: (doc.message as string) || '',
    name: (doc.name as string) || '',
    email: (doc.email as string) || '',
    read: Boolean(doc.read),
    createdAt: createdAt.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    createdAtIso: createdAt.toISOString(),
  };
}

export async function GET() {
  try {
    const db = await getDb();
    const notifications = await db
      .collection('adminnotifications')
      .find({ read: false })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const unreadCount = notifications.length;

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications: notifications.map((doc) => mapNotification(doc)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to fetch notifications', error: message },
      { status: 500 }
    );
  }
}

export async function PATCH() {
  try {
    const db = await getDb();

    // Admin opened the bell — remove seen notifications
    await db.collection('adminnotifications').deleteMany({ read: false });

    return NextResponse.json({
      success: true,
      message: 'Notifications cleared',
      unreadCount: 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to clear notifications', error: message },
      { status: 500 }
    );
  }
}
