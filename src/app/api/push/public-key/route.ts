import { NextResponse } from 'next/server';
import { getVapidKeys } from '@/lib/push';

/** GET /api/push/public-key — VAPID public key for the browser's PushManager. */
export async function GET() {
  const { publicKey } = await getVapidKeys();
  return NextResponse.json({ success: true, publicKey });
}
