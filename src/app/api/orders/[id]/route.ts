import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import RiderProfile from '@/models/RiderProfile';

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

    const order = await Order.findById(id);
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
      updateData.riderId = String(body.riderId);
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

    // Offline riders cannot accept / be assigned to dispatches
    const nextStatus = String(body.status || updateData.status || '').toUpperCase();
    if (body.riderId != null && nextStatus === 'OUT_FOR_DELIVERY') {
      const riderId = String(body.riderId);
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

    if (
      String(body.status || '').toUpperCase() === 'DELIVERED' ||
      updateData.status === 'DELIVERED'
    ) {
      updateData.completedAt = new Date();
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

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Order PATCH error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update order' },
      { status: 500 }
    );
  }
}
