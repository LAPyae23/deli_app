import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';

const ALLOWED_STATUSES = new Set([
  'PENDING',
  'PREPARING',
  'READY',
  'REJECTED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    await dbConnect();
    const { id } = await Promise.resolve(params);

    if (!id) {
      return NextResponse.json({ success: false, message: 'Order ID required' }, { status: 400 });
    }

    const order = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
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
      return NextResponse.json({ success: false, message: 'Order ID required' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};

    if (body.status != null) {
      const status = String(body.status).toUpperCase();
      if (!ALLOWED_STATUSES.has(status)) {
        return NextResponse.json(
          { success: false, message: `Invalid status: ${body.status}` },
          { status: 400 }
        );
      }
      update.status = status;
    }

    if (body.prepTime != null) {
      const prepTime = Number(body.prepTime);
      if (!Number.isFinite(prepTime) || prepTime <= 0) {
        return NextResponse.json(
          { success: false, message: 'Invalid prepTime' },
          { status: 400 }
        );
      }
      update.prepTime = prepTime;
    }

    if (body.riderId != null) {
      update.riderId = String(body.riderId);
    }
    if (body.riderName != null) {
      update.riderName = String(body.riderName);
    }
    if (body.riderCoords != null) {
      const lat = Number(body.riderCoords.lat);
      const lng = Number(body.riderCoords.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        update.riderCoords = { lat, lng };
      }
    }

    if (body.restaurantRating != null) {
      const rating = Number(body.restaurantRating);
      if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
        update.restaurantRating = rating;
      }
    }
    if (body.riderRating != null) {
      const rating = Number(body.riderRating);
      if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
        update.riderRating = rating;
      }
    }
    if (body.reviewComment != null) {
      update.reviewComment = String(body.reviewComment);
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const order = await Order.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      order,
      message: 'Order updated successfully',
    });
  } catch (error) {
    console.error('Order PATCH error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update order' },
      { status: 500 }
    );
  }
}
