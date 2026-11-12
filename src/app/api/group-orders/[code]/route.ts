import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import GroupOrder from '@/models/GroupOrder';
import MenuItem from '@/models/MenuItem';
import { getSession, unauthorized } from '@/lib/auth';
import { MAX_MEMBERS, displayName } from '@/lib/groupOrders';

type Params = { params: Promise<{ code: string }> };
const clean = (raw: string) => raw.trim().toUpperCase().slice(0, 12);

/** GET /api/group-orders/[code] — the group cart (any signed-in customer with the code). */
export async function GET(request: Request, { params }: Params) {
  const session = getSession(request);
  if (!session) return unauthorized();
  await dbConnect();
  const group = await GroupOrder.findOne({ code: clean((await params).code) }).lean();
  if (!group) return NextResponse.json({ success: false, message: 'Group order not found' }, { status: 404 });
  return NextResponse.json({
    success: true,
    group,
    me: session.userId,
    isHost: group.hostId === session.userId,
    isMember: group.members.some((m: { customerId: string }) => m.customerId === session.userId),
  });
}

/**
 * PATCH /api/group-orders/[code]
 *   { action: 'join' }                          join the group
 *   { action: 'set', menuItemId, quantity }     set my quantity of a dish (0 removes)
 *   { action: 'leave' }                         leave (not the host)
 *   { action: 'lock' | 'unlock' | 'cancel' }    host only
 * Every write is conditional on the group still being OPEN.
 */
export async function PATCH(request: Request, { params }: Params) {
  const session = getSession(request);
  if (!session) return unauthorized();
  await dbConnect();
  const code = clean((await params).code);
  const body = await request.json().catch(() => ({}));
  const me = session.userId;
  const group = await GroupOrder.findOne({ code }).lean<{
    hostId: string;
    restaurantId: string;
    status: string;
    expiresAt: Date;
    members: Array<{ customerId: string }>;
  }>();
  if (!group) return NextResponse.json({ success: false, message: 'Group order not found' }, { status: 404 });
  const isHost = group.hostId === me;
  const fail = (message: string, status = 409) => NextResponse.json({ success: false, message }, { status });
  if (new Date(group.expiresAt).getTime() < Date.now() && group.status === 'OPEN') {
    return fail('This group order has expired');
  }

  switch (body.action) {
    case 'join': {
      if (group.members.some((m) => m.customerId === me)) return NextResponse.json({ success: true });
      const name = await displayName(me);
      const res = await GroupOrder.updateOne(
        { code, status: 'OPEN', 'members.customerId': { $ne: me }, [`members.${MAX_MEMBERS - 1}`]: { $exists: false } },
        { $push: { members: { customerId: me, name, items: [] } } }
      );
      return res.modifiedCount ? NextResponse.json({ success: true }) : fail('This group is closed or full');
    }
    case 'set': {
      const menuItemId = String(body.menuItemId || '');
      const quantity = Math.max(0, Math.min(20, Math.floor(Number(body.quantity) || 0)));
      if (!mongoose.Types.ObjectId.isValid(menuItemId)) return fail('Unknown dish', 400);
      const dish = await MenuItem.findOne({ _id: menuItemId, restaurantId: group.restaurantId })
        .select('name price discountPrice isAvailable')
        .lean<{ name: string; price: number; discountPrice?: number; isAvailable?: boolean }>();
      if (!dish) return fail('This dish is not on this restaurant’s menu', 400);
      if (quantity > 0 && dish.isAvailable === false) return fail(`${dish.name} is sold out`);
      const unitPrice =
        Number(dish.discountPrice) > 0 ? Math.min(dish.price, Number(dish.discountPrice)) : dish.price;

      // Remove the line, then add it back with the new quantity (both only while OPEN).
      const pulled = await GroupOrder.updateOne(
        { code, status: 'OPEN', 'members.customerId': me },
        { $pull: { 'members.$.items': { menuItemId } } }
      );
      if (!pulled.matchedCount) return fail('Join the group first, or the host has locked the cart');
      if (quantity > 0) {
        await GroupOrder.updateOne(
          { code, status: 'OPEN', 'members.customerId': me },
          { $push: { 'members.$.items': { menuItemId, name: dish.name, unitPrice, quantity } } }
        );
      }
      return NextResponse.json({ success: true });
    }
    case 'leave': {
      if (isHost) return fail('The host cannot leave. Cancel the group instead.');
      await GroupOrder.updateOne({ code, status: 'OPEN' }, { $pull: { members: { customerId: me } } });
      return NextResponse.json({ success: true });
    }
    case 'lock':
    case 'unlock':
    case 'cancel': {
      if (!isHost) return fail('Only the host can do this', 403);
      const next = body.action === 'lock' ? 'LOCKED' : body.action === 'unlock' ? 'OPEN' : 'CANCELLED';
      const from: Array<'OPEN' | 'LOCKED'> = body.action === 'lock' ? ['OPEN'] : ['OPEN', 'LOCKED'];
      const res = await GroupOrder.updateOne({ code, status: { $in: from } }, { $set: { status: next } });
      return res.modifiedCount ? NextResponse.json({ success: true }) : fail('The group already changed');
    }
    default:
      return fail('Unknown action', 400);
  }
}
