import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RestaurantProfile from '@/models/RestaurantProfile';
import RiderProfile from '@/models/RiderProfile';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    await dbConnect();
    const { id } = await Promise.resolve(params);
    const body = await request.json();
    const status = String(body.status || '').toUpperCase();
    const type = String(body.type || '').toUpperCase();

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Approval ID required' },
        { status: 400 }
      );
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { success: false, message: 'status must be APPROVED or REJECTED' },
        { status: 400 }
      );
    }

    let approval: Record<string, unknown> | null = null;

    if (type !== 'RIDER') {
      const restaurant = await RestaurantProfile.findOneAndUpdate(
        { restaurantId: id },
        { approvalStatus: status },
        { new: true }
      );
      if (restaurant) {
        approval = {
          _id: restaurant.restaurantId,
          type: 'VENDOR',
          name: restaurant.restaurantName,
          status: restaurant.approvalStatus,
        };
      }
    }

    if (!approval && type !== 'VENDOR') {
      const rider = await RiderProfile.findOneAndUpdate(
        { riderId: id },
        { approvalStatus: status },
        { new: true }
      );
      if (rider) {
        approval = {
          _id: rider.riderId,
          type: 'RIDER',
          name: rider.name,
          status: rider.approvalStatus,
        };
      }
    }

    // Fallback: try the other collection if type omitted
    if (!approval) {
      const restaurant = await RestaurantProfile.findOneAndUpdate(
        { restaurantId: id },
        { approvalStatus: status },
        { new: true }
      );
      if (restaurant) {
        approval = {
          _id: restaurant.restaurantId,
          type: 'VENDOR',
          name: restaurant.restaurantName,
          status: restaurant.approvalStatus,
        };
      } else {
        const rider = await RiderProfile.findOneAndUpdate(
          { riderId: id },
          { approvalStatus: status },
          { new: true }
        );
        if (rider) {
          approval = {
            _id: rider.riderId,
            type: 'RIDER',
            name: rider.name,
            status: rider.approvalStatus,
          };
        }
      }
    }

    if (!approval) {
      return NextResponse.json(
        { success: false, message: 'Approval not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, approval });
  } catch (error) {
    console.error('Admin approval PATCH error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update approval' },
      { status: 500 }
    );
  }
}
