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

export async function GET(
  _request: Request,
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
    const pricing = pricingFromOrder(existingOrder);

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

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!updatedOrder) {
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
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
