import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RestaurantProfile from '@/models/RestaurantProfile';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const approvedOnly = searchParams.get('approved') === '1';

    const query = approvedOnly
      ? { approvalStatus: 'APPROVED' }
      : {};

    const restaurants = await RestaurantProfile.find(query)
      .select(
        'restaurantId restaurantName logoImage coverImage township storeStatus location approvalStatus address'
      )
      .sort({ restaurantName: 1 })
      .lean();

    return NextResponse.json({ success: true, restaurants });
  } catch (error) {
    console.error('Restaurants GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch restaurants' },
      { status: 500 }
    );
  }
}
