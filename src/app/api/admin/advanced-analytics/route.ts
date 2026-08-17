import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { cacheGetOrSet } from '@/lib/ttlCache';

const STATUS_ORDER = [
  'PENDING',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'REJECTED',
  'CANCELLED',
] as const;

const gmvExpr = {
  $convert: {
    input: { $ifNull: ['$totals.totalAmount', { $ifNull: ['$totals.total', 0] }] },
    to: 'double',
    onError: 0,
    onNull: 0,
  },
};

type RestaurantAgg = {
  restaurantName?: string;
  revenue?: number;
};

type StatusAgg = {
  status?: string;
  count?: number;
};

export async function GET() {
  try {
    await dbConnect();

    const payload = await cacheGetOrSet('admin-advanced-analytics', 20_000, async () => {
      const [facet] = (await Order.aggregate(
        [
          {
            $facet: {
              topRestaurants: [
                { $match: { status: { $nin: ['CANCELLED', 'REJECTED'] } } },
                {
                  $group: {
                    _id: {
                      $cond: [
                        {
                          $or: [
                            { $eq: [{ $ifNull: ['$restaurantName', ''] }, ''] },
                            { $eq: ['$restaurantName', null] },
                          ],
                        },
                        'Unknown',
                        '$restaurantName',
                      ],
                    },
                    revenue: { $sum: gmvExpr },
                  },
                },
                { $sort: { revenue: -1 } },
                { $limit: 5 },
                {
                  $project: {
                    _id: 0,
                    restaurantName: '$_id',
                    revenue: { $round: ['$revenue', 0] },
                  },
                },
              ],
              statusDistribution: [
                {
                  $group: {
                    _id: { $ifNull: ['$status', 'UNKNOWN'] },
                    count: { $sum: 1 },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    status: '$_id',
                    count: 1,
                  },
                },
              ],
            },
          },
        ],
        { allowDiskUse: true }
      )) as Array<{
        topRestaurants?: RestaurantAgg[];
        statusDistribution?: StatusAgg[];
      }>;

      const topRestaurants = (facet?.topRestaurants || []).map((row) => ({
        restaurantName: String(row.restaurantName || 'Unknown'),
        revenue: Math.max(0, Number(row.revenue) || 0),
      }));

      const statusRank = new Map(STATUS_ORDER.map((status, i) => [status, i]));
      const statusDistribution = (facet?.statusDistribution || [])
        .map((row) => ({
          status: String(row.status || 'UNKNOWN').toUpperCase(),
          count: Math.max(0, Number(row.count) || 0),
        }))
        .sort((a, b) => {
          const ra = statusRank.get(a.status as (typeof STATUS_ORDER)[number]);
          const rb = statusRank.get(b.status as (typeof STATUS_ORDER)[number]);
          if (ra != null && rb != null) return ra - rb;
          if (ra != null) return -1;
          if (rb != null) return 1;
          return b.count - a.count;
        });

      return {
        success: true as const,
        topRestaurants,
        statusDistribution,
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Admin advanced-analytics GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load advanced analytics' },
      { status: 500 }
    );
  }
}
