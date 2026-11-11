import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import RiderProfile from '@/models/RiderProfile';
import {
  applyCodWalletDeduction,
  isCodPayment,
  isRiderBlocked,
} from '@/lib/riderWallet';
import { pricingFromOrder } from '@/lib/orderPricing';
import RestaurantProfile from '@/models/RestaurantProfile';
import { forbidden, getSession, unauthorized, type Session } from '@/lib/auth';

type OrderOwnership = {
  customerId?: unknown;
  restaurantId?: unknown;
  restaurantName?: unknown;
  riderId?: unknown;
  unassigned?: unknown;
  status?: unknown;
};

function isUnassigned(order: OrderOwnership) {
  return order.unassigned === true || !String(order.riderId || '').trim();
}

/** Whether the signed-in user is a party to this order. */
/** Which status changes each role may make: from → allowed next statuses. */
const STATUS_TRANSITIONS: Record<Exclude<Session['role'], 'ADMIN'>, Record<string, string[]>> = {
  CUSTOMER: {
    PENDING: ['CANCELLED'],
    PREPARING: ['CANCELLED'],
  },
  RESTAURANT: {
    PENDING: ['PREPARING', 'REJECTED'],
    PREPARING: ['READY', 'CANCELLED'],
  },
  RIDER: {
    PREPARING: ['OUT_FOR_DELIVERY'],
    READY: ['OUT_FOR_DELIVERY'],
    OUT_FOR_DELIVERY: ['DELIVERED'],
  },
};

/** Body fields each role may send; anything else is ignored. */
const ALLOWED_FIELDS: Record<Exclude<Session['role'], 'ADMIN'>, string[]> = {
  CUSTOMER: ['status', 'cancelReason', 'riderRating', 'restaurantRating', 'reviewComment'],
  RESTAURANT: ['status', 'prepTime', 'cancelReason'],
  RIDER: ['status', 'riderId', 'riderName', 'riderCoords', 'travelMins', 'distanceKm', 'durationMins'],
};

const RATING_FIELDS = ['riderRating', 'restaurantRating', 'reviewComment'];

async function canAccessOrder(session: Session, order: OrderOwnership) {
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    await dbConnect();
    const { id } = await Promise.resolve(params);

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Order ID required' },
        { status: 400 }
      );
    }

    const order = await Order.findById(id).lean();
    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      );
    }

    const session = getSession(request);
    if (!session) return unauthorized();
    if (!(await canAccessOrder(session, order))) {
      return forbidden('You do not have access to this order');
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('Order GET by id error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    await dbConnect();
    const { id } = await Promise.resolve(params);
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Order ID required' },
        { status: 400 }
      );
    }

    const session = getSession(request);
    if (!session) return unauthorized();
    const ownedOrder = await Order.findById(id)
      .select('customerId restaurantId restaurantName riderId unassigned status')
      .lean<OrderOwnership>();
    if (!ownedOrder) {
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      );
    }
    if (
      session.role === 'RIDER' &&
      body.riderId != null &&
      !isUnassigned(ownedOrder) &&
      String(ownedOrder.riderId) !== session.userId
    ) {
      return NextResponse.json(
        { success: false, message: 'Another rider has already taken this order' },
        { status: 409 }
      );
    }
    if (!(await canAccessOrder(session, ownedOrder))) {
      return forbidden('You do not have access to this order');
    }
    if (body.riderId != null && session.role !== 'ADMIN') {
      const requestedRider = String(body.riderId).trim();
      const currentRider = String(ownedOrder.riderId || '');
      // Riders may only claim an order for themselves or release their own order.
      const riderAllowed =
        session.role === 'RIDER' &&
        (requestedRider === session.userId ||
          (requestedRider === '' && currentRider === session.userId));
      if (!riderAllowed) {
        return forbidden('You cannot change the rider on this order');
      }
    }
    if (session.role === 'RIDER' && isUnassigned(ownedOrder) && body.riderId == null) {
      return forbidden('Accept the order before updating it');
    }

    if (session.role !== 'ADMIN') {
      // Drop fields this role is not allowed to change.
      const allowed = new Set(ALLOWED_FIELDS[session.role]);
      for (const key of Object.keys(body)) {
        if (!allowed.has(key)) delete body[key];
      }

      const currentStatus = String(ownedOrder.status || 'PENDING').toUpperCase();
      if (body.status != null) {
        const requested = String(body.status).toUpperCase();
        if (requested === currentStatus) {
          delete body.status; // no-op
        } else {
          const nextAllowed = STATUS_TRANSITIONS[session.role][currentStatus] || [];
          if (!nextAllowed.includes(requested)) {
            return NextResponse.json(
              {
                success: false,
                message: `Cannot change order from ${currentStatus} to ${requested}`,
              },
              { status: 409 }
            );
          }
        }
      }

      if (
        session.role === 'CUSTOMER' &&
        RATING_FIELDS.some((f) => body[f] != null) &&
        currentStatus !== 'DELIVERED'
      ) {
        return NextResponse.json(
          { success: false, message: 'You can rate an order after it is delivered' },
          { status: 409 }
        );
      }
      for (const f of ['riderRating', 'restaurantRating']) {
        if (body[f] != null) {
          const r = Number(body[f]);
          if (!Number.isFinite(r) || r < 1 || r > 5) {
            return NextResponse.json(
              { success: false, message: 'Rating must be between 1 and 5' },
              { status: 400 }
            );
          }
        }
      }
    }

    const updateData: Record<string, unknown> = {};

    if (body.status != null) {
      updateData.status = String(body.status).toUpperCase();
    }
    if (body.prepTime != null) {
      updateData.prepTime = Number(body.prepTime);
    }
    if (body.travelMins != null) {
      updateData.travelMins = Number(body.travelMins);
    }
    if (body.riderId != null) {
      const nextRiderId = String(body.riderId).trim();
      updateData.riderId = nextRiderId;
      updateData.unassigned = nextRiderId.length === 0;
    }
    if (body.riderName != null) {
      updateData.riderName = String(body.riderName);
    }
    if (body.riderCoords != null) {
      const lat = Number(body.riderCoords.lat);
      const lng = Number(body.riderCoords.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        updateData.riderCoords = { lat, lng };
      }
    }
    if (body.riderRating != null) {
      updateData.riderRating = Number(body.riderRating);
    }
    if (body.restaurantRating != null) {
      updateData.restaurantRating = Number(body.restaurantRating);
    }
    if (body.reviewComment != null) {
      updateData.reviewComment = String(body.reviewComment);
    }
    if (body.baseRiderFee != null) {
      const fee = Number(body.baseRiderFee);
      if (Number.isFinite(fee)) updateData.baseRiderFee = fee;
    }
    if (body.tipAmount != null) {
      const tip = Number(body.tipAmount);
      if (Number.isFinite(tip)) updateData.tipAmount = tip;
    }
    if (body.distanceKm != null) {
      const distance = Number(body.distanceKm);
      if (Number.isFinite(distance)) updateData.distanceKm = distance;
    }
    if (body.durationMins != null) {
      const duration = Number(body.durationMins);
      if (Number.isFinite(duration)) updateData.durationMins = duration;
    }
    if (body.cancelReason != null) {
      updateData.cancelReason = String(body.cancelReason);
    }

    // Blocked riders cannot be assigned any new orders
    const nextStatus = String(body.status || updateData.status || '').toUpperCase();
    if (body.riderId != null) {
      const riderId = String(body.riderId);
      if (await isRiderBlocked(riderId)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Rider is blocked due to outstanding COD wallet debt',
          },
          { status: 403 }
        );
      }
      // Offline riders cannot accept / be assigned to dispatches
      if (nextStatus === 'OUT_FOR_DELIVERY') {
        const rider = await RiderProfile.findOne({ riderId }).select('status').lean();
        if (!rider || String(rider.status) !== 'Online') {
          return NextResponse.json(
            {
              success: false,
              message: 'Rider is offline and cannot accept dispatches',
            },
            { status: 403 }
          );
        }
      }
    }

    const existingOrder = await Order.findById(id).lean();
    if (!existingOrder) {
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      );
    }

    const wasDelivered = String(existingOrder.status || '').toUpperCase() === 'DELIVERED';
    const becomingDelivered = nextStatus === 'DELIVERED' && !wasDelivered;
    const pricing = pricingFromOrder(existingOrder as unknown as Parameters<typeof pricingFromOrder>[0]);

    if (becomingDelivered) {
      updateData.completedAt = new Date();
      updateData.baseRiderFee = pricing.riderEarning;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Atomic guards: the write only lands if the order is still in the state
    // we checked. Stops two riders claiming the same order, and two people
    // changing the status at the same moment.
    const filter: Record<string, unknown> = { _id: id };
    const isClaim =
      body.riderId != null &&
      String(body.riderId).trim() !== '' &&
      String(body.riderId).trim() !== String(existingOrder.riderId || '');
    if (isClaim && session.role !== 'ADMIN') {
      filter.$or = [{ riderId: { $exists: false } }, { riderId: null }, { riderId: '' }];
    }
    if (updateData.status != null && existingOrder.status != null) {
      filter.status = existingOrder.status;
    }

    const updatedOrder = await Order.findOneAndUpdate(filter, { $set: updateData }, { new: true });

    if (!updatedOrder) {
      return NextResponse.json(
        {
          success: false,
          message: isClaim
            ? 'Another rider has already taken this order'
            : 'This order was just updated by someone else. Please refresh.',
        },
        { status: 409 }
      );
    }

    let wallet: Awaited<ReturnType<typeof applyCodWalletDeduction>> = null;
    if (becomingDelivered && isCodPayment(updatedOrder.paymentMethod)) {
      const riderId = String(updatedOrder.riderId || existingOrder.riderId || '');
      const owedAmount = pricing.owedAmount;
      if (riderId && owedAmount > 0) {
        wallet = await applyCodWalletDeduction(riderId, owedAmount);
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      ...(wallet
        ? {
            riderWallet: {
              deducted: wallet.deducted,
              owedAmount: pricing.owedAmount,
              riderEarning: pricing.riderEarning,
              walletBalance: wallet.walletBalance,
              isBlocked: wallet.isBlocked,
            },
          }
        : {}),
    });
  } catch (error) {
    console.error('Order PATCH error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update order' },
      { status: 500 }
    );
  }
}
