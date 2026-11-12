import Order from '@/models/Order';
import CustomerProfile from '@/models/CustomerProfile';
import { pointsEarnedFor } from '@/lib/loyalty';

/** Gives the customer points for a delivered order (only once per order). */
export async function awardOrderPoints(orderId: string) {
  const order = await Order.findById(orderId).select('customerId totals items pointsEarned status').lean<{
    customerId?: string;
    totals?: { subtotal?: number };
    pointsEarned?: number;
    status?: string;
  }>();
  if (!order || order.status !== 'DELIVERED' || Number(order.pointsEarned) > 0) return 0;
  const points = pointsEarnedFor(Number(order.totals?.subtotal) || 0);
  if (points <= 0 || !order.customerId) return 0;
  // Claim the award on the order first so a retry cannot pay twice.
  const claimed = await Order.updateOne(
    { _id: orderId, $or: [{ pointsEarned: 0 }, { pointsEarned: { $exists: false } }] },
    { $set: { pointsEarned: points } }
  );
  if (claimed.modifiedCount !== 1) return 0;
  await CustomerProfile.updateOne(
    { customerId: order.customerId },
    { $inc: { loyaltyPoints: points, lifetimePoints: points } },
    { upsert: true }
  );
  return points;
}

/** Returns spent points when an order is cancelled or rejected (only once). */
export async function refundOrderPoints(orderId: string) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, pointsRedeemed: { $gt: 0 }, pointsRefunded: { $ne: true } },
    { $set: { pointsRefunded: true } },
    { new: true }
  ).lean<{ customerId?: string; pointsRedeemed?: number }>();
  if (!order?.customerId) return 0;
  const points = Number(order.pointsRedeemed) || 0;
  await CustomerProfile.updateOne({ customerId: order.customerId }, { $inc: { loyaltyPoints: points } });
  return points;
}
