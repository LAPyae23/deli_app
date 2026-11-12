import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RestaurantProfile from '@/models/RestaurantProfile';
import SystemConfig from '@/models/SystemConfig';
import Order from '@/models/Order';
import { sharedGetOrSet as cacheGetOrSet } from '@/lib/sharedCache';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const approvedOnly = searchParams.get('approved') === '1';

    const query: Record<string, unknown> = approvedOnly
      ? { approvalStatus: 'APPROVED' }
      : {};

    const body = await cacheGetOrSet(
      `restaurants:${approvedOnly ? 'approved' : 'all'}`,
      20_000,
      async () => {
        const [restaurants, systemConfig, hourly] = await Promise.all([
          RestaurantProfile.find(query)
            .select(
              'restaurantId restaurantName description logoImage coverImage township storeStatus location approvalStatus address rating reviewCount openingTime closingTime'
            )
            .sort({ restaurantName: 1 })
            .lean(),
          SystemConfig.findOne().select('maxDeliveryRadiusKm').lean(),
          // Orders per restaurant per Yangon hour, last 28 days (for "usually busy now").
          Order.aggregate<{ _id: { r: string; h: number }; n: number }>([
            { $match: { createdAt: { $gte: new Date(Date.now() - 28 * 86400_000) }, restaurantId: { $nin: [null, ''] } } },
            {
              $group: {
                _id: { r: '$restaurantId', h: { $hour: { date: '$createdAt', timezone: 'Asia/Yangon' } } },
                n: { $sum: 1 },
              },
            },
          ]).catch(() => []),
        ]);

        // Busy hours: hours with at least 1.5x the restaurant's average hourly orders (top 4).
        const perRestaurant = new Map<string, number[]>();
        for (const row of hourly) {
          const arr = perRestaurant.get(row._id.r) || Array(24).fill(0);
          arr[row._id.h] += row.n;
          perRestaurant.set(row._id.r, arr);
        }
        const busyHoursOf = (id: string) => {
          const arr = perRestaurant.get(id);
          if (!arr) return [];
          const active = arr.filter((n) => n > 0);
          if (active.length < 3) return [];
          const mean = active.reduce((a, b) => a + b, 0) / active.length;
          return arr
            .map((n, h) => ({ h, n }))
            .filter((x) => x.n >= Math.max(3, mean * 1.5))
            .sort((a, b) => b.n - a.n)
            .slice(0, 4)
            .map((x) => x.h)
            .sort((a, b) => a - b);
        };

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
            busyHours: busyHoursOf(String(r.restaurantId || '')),
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
