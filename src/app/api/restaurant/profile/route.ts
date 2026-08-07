// app/api/restaurant/profile/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RestaurantProfile from '@/models/RestaurantProfile';

const DEFAULT_RESTAURANT_ID = 'burger-bliss-id';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurantId') || DEFAULT_RESTAURANT_ID;

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
    const restaurantId = body.restaurantId || DEFAULT_RESTAURANT_ID;

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
