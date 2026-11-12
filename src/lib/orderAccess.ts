import RestaurantProfile from '@/models/RestaurantProfile';
import type { Session } from '@/lib/auth';

export type OrderOwnership = {
  customerId?: unknown;
  restaurantId?: unknown;
  restaurantName?: unknown;
  riderId?: unknown;
  unassigned?: unknown;
  status?: unknown;
};

export function isUnassigned(order: OrderOwnership) {
  return order.unassigned === true || !String(order.riderId || '').trim();
}

/** Whether the signed-in user is a party to this order. */
export async function canAccessOrder(session: Session, order: OrderOwnership) {
  switch (session.role) {
    case 'ADMIN':
      return true;
    case 'CUSTOMER':
      return String(order.customerId || '') === session.userId;
    case 'RIDER':
      // Riders see their own deliveries and the open dispatch pool.
      return String(order.riderId || '') === session.userId || isUnassigned(order);
    case 'RESTAURANT': {
      if (String(order.restaurantId || '') === session.userId) return true;
      if (String(order.restaurantId || '')) return false;
      const profile = await RestaurantProfile.findOne({ restaurantId: session.userId })
        .select('restaurantName')
        .lean<{ restaurantName?: string }>();
      const ownName = String(profile?.restaurantName || '').trim();
      return Boolean(ownName) && String(order.restaurantName || '') === ownName;
    }
    default:
      return false;
  }
}

