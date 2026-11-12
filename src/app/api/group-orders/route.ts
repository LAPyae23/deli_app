import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import GroupOrder from '@/models/GroupOrder';
import RestaurantProfile from '@/models/RestaurantProfile';
import { getSession, unauthorized } from '@/lib/auth';
import { GROUP_TTL_MS, displayName, newGroupCode } from '@/lib/groupOrders';

/** POST /api/group-orders { restaurantId } — start a group order and get a share code. */
export async function POST(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  await dbConnect();
  const body = await request.json().catch(() => ({}));
  const restaurantId = String(body.restaurantId || '').trim();
  const restaurant = restaurantId
    ? await RestaurantProfile.findOne({ restaurantId }).select('restaurantName storeStatus').lean<{
        restaurantName?: string;
        storeStatus?: string;
      }>()
    : null;
  if (!restaurant) {
    return NextResponse.json({ success: false, message: 'Pick a restaurant first' }, { status: 400 });
  }

  const name = await displayName(session.userId);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const group = await GroupOrder.create({
        code: newGroupCode(),
        hostId: session.userId,
        hostName: name,
        restaurantId,
        restaurantName: restaurant.restaurantName || '',
        members: [{ customerId: session.userId, name, items: [] }],
        expiresAt: new Date(Date.now() + GROUP_TTL_MS),
      });
      return NextResponse.json({ success: true, code: group.code });
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e; // retry only on duplicate code
    }
  }
  return NextResponse.json({ success: false, message: 'Please try again' }, { status: 500 });
}
