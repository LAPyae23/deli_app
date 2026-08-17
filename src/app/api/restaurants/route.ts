import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RestaurantProfile from '@/models/RestaurantProfile';
import SystemConfig from '@/models/SystemConfig';
import { cacheGetOrSet } from '@/lib/ttlCache';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const approvedOnly = searchParams.get('approved') === '1';

    const query = approvedOnly
      ? { approvalStatus: 'APPROVED' }
      : {};

    const body = await cacheGetOrSet(
      `restaurants:${approvedOnly ? 'approved' : 'all'}`,
      20_000,
      async () => {
        const [restaurants, systemConfig] = await Promise.all([
          RestaurantProfile.find(query)
            .select(
              'restaurantId restaurantName description logoImage coverImage township storeStatus location approvalStatus address rating reviewCount openingTime closingTime'
            )
            .sort({ restaurantName: 1 })
            .lean(),
          SystemConfig.findOne().select('maxDeliveryRadiusKm').lean(),
        ]);

        const payload = restaurants.map((r) => {
          const stored = Number(r.rating);
          const rating = Number.isFinite(stored) && stored > 0 ? stored : null;
          const reviews = Number(r.reviewCount) > 0 ? Number(r.reviewCount) : 0;

          return {
            ...r,
            logoImage: r.logoImage || '',
            coverImage: r.coverImage || '',
            rating,
            reviews,
          };
        });

        const radius = Number(systemConfig?.maxDeliveryRadiusKm);
        const maxDeliveryRadiusKm =
          Number.isFinite(radius) && radius >= 1 ? Math.min(20, Math.round(radius)) : 7;

        return {
          success: true,
          restaurants: payload,
          maxDeliveryRadiusKm,
        };
      }
    );

    return NextResponse.json(body);
  } catch (error) {
    console.error('Restaurants GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch restaurants' },
      { status: 500 }
    );
  }
}
