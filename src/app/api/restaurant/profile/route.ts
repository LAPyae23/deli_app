// app/api/restaurant/profile/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RestaurantProfile from '@/models/RestaurantProfile';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurantId');

    if (!restaurantId) {
      return NextResponse.json(
        { success: false, message: 'restaurantId is required' },
        { status: 400 }
      );
    }

    const profile = await RestaurantProfile.findOne({ restaurantId });
    return NextResponse.json({ success: true, profile: profile || null });
  } catch (error) {
    console.error('Restaurant profile GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch restaurant profile' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const restaurantId = body.restaurantId;

    if (!restaurantId) {
      return NextResponse.json(
        { success: false, message: 'restaurantId is required' },
        { status: 400 }
      );
    }

    const update = {
      restaurantId,
      restaurantName: body.restaurantName || '',
      description: body.description || '',
      logoImage: body.logoImage || '',
      coverImage: body.coverImage || '',
      address: body.address || '',
      location: {
        lat: Number(body.location?.lat) || 16.8409,
        lng: Number(body.location?.lng) || 96.1735,
      },
      openingTime: body.openingTime || '09:00',
      closingTime: body.closingTime || '22:00',
    };

    const profile = await RestaurantProfile.findOneAndUpdate(
      { restaurantId },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      success: true,
      profile,
      message: 'Restaurant profile saved successfully',
    });
  } catch (error) {
    console.error('Restaurant profile POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save restaurant profile' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const restaurantId = body.restaurantId;
    const storeStatus = body.storeStatus;

    if (!restaurantId) {
      return NextResponse.json(
        { success: false, message: 'restaurantId is required' },
        { status: 400 }
      );
    }

    if (!['OPEN', 'BUSY', 'CLOSED'].includes(String(storeStatus))) {
      return NextResponse.json(
        { success: false, message: 'Invalid storeStatus' },
        { status: 400 }
      );
    }

    const updatedProfile = await RestaurantProfile.findOneAndUpdate(
      { restaurantId },
      { storeStatus },
      { new: true }
    );

    if (!updatedProfile) {
      return NextResponse.json(
        { success: false, message: 'Restaurant profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error) {
    console.error('Restaurant profile PATCH error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update store status' },
      { status: 500 }
    );
  }
}
