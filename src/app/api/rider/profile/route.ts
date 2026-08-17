// app/api/rider/profile/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RiderProfile from '@/models/RiderProfile';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const riderId = searchParams.get('riderId');

    if (!riderId) {
      return NextResponse.json(
        { success: false, message: 'riderId is required' },
        { status: 400 }
      );
    }

    const profile = await RiderProfile.findOne({ riderId }).lean();
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
    const riderId = body.riderId;

    if (!riderId) {
      return NextResponse.json(
        { success: false, message: 'riderId is required' },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {
      riderId,
    };

    if (body.name !== undefined) update.name = body.name || '';
    if (body.phone !== undefined) update.phone = body.phone || '';
    if (body.vehicle !== undefined) update.vehicle = body.vehicle || '';
    if (body.licensePlate !== undefined) update.licensePlate = body.licensePlate || '';
    if (body.profileImage !== undefined) update.profileImage = body.profileImage || '';
    if (body.vehicleType !== undefined) update.vehicleType = body.vehicleType;
    if (body.status === 'Online' || body.status === 'Offline') {
      update.status = body.status;
    }
    if (body.township !== undefined) update.township = body.township || '';
    if (body.riderCoords != null) {
      const lat = Number(body.riderCoords.lat);
      const lng = Number(body.riderCoords.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        update.riderCoords = { lat, lng };
        update.location = { lat, lng };
      }
    }
    if (body.location != null) {
      const lat = Number(body.location.lat);
      const lng = Number(body.location.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        update.location = { lat, lng };
        update.riderCoords = { lat, lng };
      }
    }

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
