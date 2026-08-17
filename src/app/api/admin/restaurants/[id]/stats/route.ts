import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RestaurantProfile from '@/models/RestaurantProfile';
import Order from '@/models/Order';
import { mockRestaurantStats } from '@/lib/restaurantDemoStats';

const foodSubtotalExpr = {
  $let: {
    vars: {
      sub: { $ifNull: ['$totals.subtotal', 0] },
      total: {
        $ifNull: ['$totals.total', { $ifNull: ['$totals.totalAmount', 0] }],
      },
      tax: { $ifNull: ['$totals.tax', 0] },
      delivery: { $ifNull: ['$totals.deliveryFee', 0] },
      tip: { $ifNull: ['$totals.tipAmount', { $ifNull: ['$tipAmount', 0] }] },
    },
    in: {
      $cond: [
        { $gt: ['$$sub', 0] },
        '$$sub',
        {
          $cond: [
            { $gt: [{ $add: ['$$tax', '$$delivery', '$$tip'] }, 0] },
            {
              $max: [
                0,
                { $subtract: ['$$total', { $add: ['$$tax', '$$delivery', '$$tip'] }] },
              ],
            },
            0,
          ],
        },
      ],
    },
  },
};

const netRevenueExpr = {
  $max: [
    0,
    {
      $subtract: [
        foodSubtotalExpr,
        {
          $ifNull: [
            '$totals.restaurantCommission',
            { $multiply: [foodSubtotalExpr, 0.3] },
          ],
        },
      ],
    },
  ],
};

type KpiAgg = {
  totalRevenue?: number;
  totalOrdersCompleted?: number;
};

type ItemAgg = {
  _id?: string;
  quantity?: number;
  revenue?: number;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    await dbConnect();
    const { id } = await Promise.resolve(params);
    const restaurantId = String(id || '').trim();

    if (!restaurantId) {
      return NextResponse.json(
        { success: false, message: 'Restaurant ID required' },
        { status: 400 }
      );
    }

    const profile = await RestaurantProfile.findOne({
      restaurantId,
    }).lean();

    const storeStatus = String(profile?.storeStatus || 'OPEN').toUpperCase();
    const isActive = storeStatus !== 'CLOSED';

    const restaurant = {
      id: restaurantId,
      name: String(profile?.restaurantName || 'Restaurant'),
      township: String(profile?.township || ''),
      address: String(profile?.address || ''),
      storeStatus,
      isActive,
      location:
        [profile?.township, profile?.address].filter(Boolean).join(' · ') ||
        'Yangon',
    };

    const match = profile?.restaurantName
      ? {
          $or: [{ restaurantId }, { restaurantName: profile.restaurantName }],
        }
      : { restaurantId };

    const [facet] = (await Order.aggregate(
      [
        { $match: { ...match, status: 'DELIVERED' } },
        {
          $facet: {
            kpis: [
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: netRevenueExpr },
                  totalOrdersCompleted: { $sum: 1 },
                },
              },
            ],
            topItems: [
              { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
              {
                $group: {
                  _id: { $ifNull: ['$items.name', 'Item'] },
                  quantity: { $sum: { $ifNull: ['$items.quantity', 1] } },
                  revenue: {
                    $sum: {
                      $multiply: [
                        { $ifNull: ['$items.quantity', 1] },
                        {
                          $ifNull: [
                            '$items.unitPrice',
                            { $ifNull: ['$items.price', 0] },
                          ],
                        },
                        0.7,
                      ],
                    },
                  },
                },
              },
              { $sort: { quantity: -1 } },
              { $limit: 3 },
            ],
          },
        },
      ],
      { allowDiskUse: true }
    )) as Array<{ kpis?: KpiAgg[]; topItems?: ItemAgg[] }>;

    const kpiRow = facet?.kpis?.[0];
    const liveCount = Number(kpiRow?.totalOrdersCompleted) || 0;

    let source: 'live' | 'mock' = 'mock';
    let kpis = mockRestaurantStats(restaurantId);
    let topItems = kpis.topItems;

    if (liveCount > 0) {
      source = 'live';
      const totalRevenue = Math.max(0, Math.round(Number(kpiRow?.totalRevenue) || 0));
      const totalOrdersCompleted = liveCount;
      const averageOrderValue =
        totalOrdersCompleted > 0
          ? Math.round(totalRevenue / totalOrdersCompleted)
          : 0;

      topItems = (facet?.topItems || []).map((row) => ({
        name: String(row._id || 'Item'),
        quantity: Number(row.quantity) || 0,
        revenue: Math.round(Number(row.revenue) || 0),
      }));

      if (topItems.length < 3) {
        const fallback = mockRestaurantStats(restaurantId).topItems;
        for (const item of fallback) {
          if (topItems.length >= 3) break;
          if (!topItems.some((t) => t.name === item.name)) topItems.push(item);
        }
      }

      kpis = {
        totalRevenue,
        totalOrdersCompleted,
        averageOrderValue,
        topItems,
      };
    }

    return NextResponse.json({
      success: true,
      restaurant,
      kpis,
      topItems,
      source,
    });
  } catch (error) {
    console.error('Admin restaurant stats GET error:', error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Failed to load restaurant stats';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
