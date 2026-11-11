import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSession, unauthorized } from '@/lib/auth';
import { PushSubscriptionModel } from '@/lib/push';

/** POST /api/push/subscribe — save this browser's push subscription for the signed-in user. */
export async function POST(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const endpoint = String(body?.endpoint || '');
  const p256dh = String(body?.keys?.p256dh || '');
  const auth = String(body?.keys?.auth || '');
  if (!endpoint.startsWith('https://') || !p256dh || !auth) {
    return NextResponse.json({ success: false, message: 'Invalid subscription' }, { status: 400 });
  }
  await dbConnect();
  // One device = one endpoint; re-subscribing moves it to the current user.
  await PushSubscriptionModel.updateOne(
    { endpoint },
    { $set: { userId: session.userId, keys: { p256dh, auth } } },
    { upsert: true }
  );
  const count = await PushSubscriptionModel.countDocuments({ userId: session.userId });
  if (count > 10) {
    const old = await PushSubscriptionModel.find({ userId: session.userId }).sort({ updatedAt: 1 }).limit(count - 10).select('_id');
    await PushSubscriptionModel.deleteMany({ _id: { $in: old.map((o) => o._id) } });
  }
  return NextResponse.json({ success: true });
}

/** DELETE /api/push/subscribe — stop notifications on this browser. */
export async function DELETE(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  await dbConnect();
  await PushSubscriptionModel.deleteOne({ endpoint: String(body?.endpoint || ''), userId: session.userId });
  return NextResponse.json({ success: true });
}
