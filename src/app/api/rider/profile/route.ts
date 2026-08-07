// app/api/rider/profile/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RiderProfile from '@/models/RiderProfile';

const DEFAULT_RIDER_ID = 'rider-demo-id';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const riderId = searchParams.get('riderId') || DEFAULT_RIDER_ID;

    const profile = await RiderProfile.findOne({ riderId });
    return NextResponse.json({ success: true, profile: profile || null });
  } catch (error) {
    console.error('Rider profile GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch rider profile' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const riderId = body.riderId || DEFAULT_RIDER_ID;

    const update = {
      riderId,
      name: body.name || '',
      phone: body.phone || '',
      vehicle: body.vehicle || '',
      licensePlate: body.licensePlate || '',
      profileImage: body.profileImage || '',
    };

    const profile = await RiderProfile.findOneAndUpdate(
      { riderId },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      success: true,
      profile,
      message: 'Rider profile saved successfully',
    });
  } catch (error) {
    console.error('Rider profile POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save rider profile' },
      { status: 500 }
    );
  }
}
