import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import GroupOrder from '@/models/GroupOrder';
import Order from '@/models/Order';
import { getSession, unauthorized } from '@/lib/auth';
import { splitBill } from '@/lib/groupOrders';
import { sendPush } from '@/lib/push';
import { POST as createOrder } from '@/app/api/orders/route';

type Member = {
  customerId: string;
  name: string;
  items: Array<{ menuItemId: string; name: string; unitPrice: number; quantity: number }>;
};

/**
 * POST /api/group-orders/[code]/place { deliveryAddress, tipAmount?, promoCodeUsed?, scheduledFor? }
 * Host only. Locks the group, places one normal order through the order
 * route (same prices, promos, stock checks) and saves who owes what.
 */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = getSession(request);
  if (!session) return unauthorized();
  await dbConnect();
  const code = (await params).code.trim().toUpperCase();
  const body = await request.json().catch(() => ({}));

  // Lock so nobody edits while we check out (only the host, only from OPEN/LOCKED).
  const group = await GroupOrder.findOneAndUpdate(
    { code, hostId: session.userId, status: { $in: ['OPEN', 'LOCKED'] } },
    { $set: { status: 'LOCKED' } },
    { new: true }
  ).lean<{ restaurantId: string; restaurantName: string; members: Member[] }>();
  if (!group) {
    return NextResponse.json({ success: false, message: 'Only the host can place an open group order' }, { status: 409 });
  }

  const lines = group.members.flatMap((m) =>
    m.items.map((i) => ({ id: i.menuItemId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, note: `For ${m.name}` }))
  );
  if (lines.length === 0) {
    await GroupOrder.updateOne({ code }, { $set: { status: 'OPEN' } });
    return NextResponse.json({ success: false, message: 'The group cart is empty' }, { status: 400 });
  }

  // Re-use the normal order route so pricing and checks are identical.
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.set('content-type', 'application/json');
  const orderRequest = new Request(new URL('/api/orders', request.url), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      items: lines,
      restaurantId: group.restaurantId,
      restaurantName: group.restaurantName,
      deliveryAddress: body.deliveryAddress,
      paymentMethod: 'cash',
      tipAmount: body.tipAmount,
      promoCodeUsed: body.promoCodeUsed,
      scheduledFor: body.scheduledFor,
      customerName: `${group.members[0]?.name || 'Group'} + ${Math.max(0, group.members.length - 1)}`,
    }),
  });
  const res = await createOrder(orderRequest);
  const data = await res.json();
  if (!res.ok || !data.success) {
    await GroupOrder.updateOne({ code }, { $set: { status: 'OPEN' } });
    return NextResponse.json({ success: false, message: data.message || 'Could not place the order' }, { status: res.status });
  }

  const totals = data.totals || {};
  const shares = splitBill(group.members, {
    subtotal: Number(totals.subtotal) || 0,
    tax: Number(totals.tax) || 0,
    deliveryFee: Number(totals.deliveryFee) || 0,
    tipAmount: Number(totals.tipAmount) || 0,
    discount: (Number(totals.discount) || 0) + (Number(totals.pointsValue) || 0),
    total: Number(totals.total) || 0,
  });
  await Promise.all([
    Order.updateOne({ _id: data.orderId }, { $set: { groupCode: code, groupShares: shares } }),
    GroupOrder.updateOne({ code }, { $set: { status: 'PLACED', orderId: data.orderId } }),
  ]);

  // Tell the other members their food is ordered and what they owe the host.
  await sendPush(
    group.members.filter((m) => m.customerId !== session.userId).map((m) => m.customerId),
    {
      title: `Group order ${data.orderNumber} placed`,
      body: `${group.restaurantName} · your share is in the group page`,
      url: `/customer-dashboard/group/${code}`,
      tag: `group-${code}`,
    }
  ).catch(() => {});

  return NextResponse.json({ success: true, orderId: data.orderId, orderNumber: data.orderNumber, shares });
}
