import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import RiderProfile from '@/models/RiderProfile';
import RestaurantProfile from '@/models/RestaurantProfile';

type RfmSegment = 'Top VIP' | 'Sleeping Beauty' | 'New/Normal';

const GMV_EXPR = {
  $cond: [
    { $in: ['$status', ['CANCELLED', 'REJECTED']] },
    0,
    { $ifNull: ['$totals.total', { $ifNull: ['$totals.totalAmount', 0] }] },
  ],
};

function startOfLocalDay(d = new Date()): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return start;
}

function daysSince(date: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function matchTownship(value: unknown, township: string) {
  const text = String(value || '');
  if (!text) return false;
  if (text === township) return true;
  const short = township.split('(')[0].trim();
  return text.includes(township) || (short.length > 3 && text.includes(short));
}

type PlatformAll = {
  totalGMV?: number;
  slowPrep?: number;
  longDuration?: number;
  durationSum?: number;
  durationN?: number;
  activeOrders?: number;
};

type PlatformToday = {
  todayGMV?: number;
  todayOrders?: number;
  todayCancelled?: number;
  prepSum?: number;
  prepN?: number;
};

type RfmCustomer = {
  _id?: string;
  customerName?: string;
  orderCount?: number;
  monetary?: number;
  lastOrderAt?: Date;
};

type TownshipActive = { _id?: string; activeOrders?: number };
type SlowRestaurant = { _id?: string; slowOrders?: number };

/**
 * GET /api/admin/executive-summary
 * Compiles platform, RFM, and ops bottleneck metrics for the PDF report.
 */
export async function GET() {
  try {
    await dbConnect();
    const now = new Date();
    const todayStart = startOfLocalDay(now);
    const cancelled = ['CANCELLED', 'REJECTED'];

    const [
      [platformAll],
      [platformToday],
      rfmCustomers,
      townshipActive,
      topSlowRestaurants,
      riderUsers,
      onlineRiders,
      restaurants,
    ] = await Promise.all([
      Order.aggregate(
        [
          {
            $group: {
              _id: null,
              totalGMV: { $sum: GMV_EXPR },
              slowPrep: {
                $sum: {
                  $cond: [{ $gte: [{ $ifNull: ['$prepTime', 0] }, 30] }, 1, 0],
                },
              },
              longDuration: {
                $sum: {
                  $cond: [{ $gte: [{ $ifNull: ['$durationMins', 0] }, 55] }, 1, 0],
                },
              },
              durationSum: {
                $sum: {
                  $cond: [{ $gt: [{ $ifNull: ['$durationMins', 0] }, 0] }, '$durationMins', 0],
                },
              },
              durationN: {
                $sum: {
                  $cond: [{ $gt: [{ $ifNull: ['$durationMins', 0] }, 0] }, 1, 0],
                },
              },
              activeOrders: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        '$status',
                        ['PENDING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        { allowDiskUse: true }
      ) as Promise<PlatformAll[]>,
      Order.aggregate([
        { $match: { createdAt: { $gte: todayStart, $lte: now } } },
        {
          $group: {
            _id: null,
            todayGMV: { $sum: GMV_EXPR },
            todayOrders: { $sum: 1 },
            todayCancelled: {
              $sum: {
                $cond: [{ $in: ['$status', cancelled] }, 1, 0],
              },
            },
            prepSum: {
              $sum: {
                $cond: [{ $gt: [{ $ifNull: ['$prepTime', 0] }, 0] }, '$prepTime', 0],
              },
            },
            prepN: {
              $sum: {
                $cond: [{ $gt: [{ $ifNull: ['$prepTime', 0] }, 0] }, 1, 0],
              },
            },
          },
        },
      ]) as Promise<PlatformToday[]>,
      Order.aggregate(
        [
          { $match: { status: { $nin: cancelled } } },
          {
            $group: {
              _id: {
                $ifNull: [
                  '$customerId',
                  {
                    $concat: [
                      'name:',
                      { $toLower: { $ifNull: ['$customerName', 'customer'] } },
                    ],
                  },
                ],
              },
              customerName: { $last: '$customerName' },
              orderCount: { $sum: 1 },
              monetary: { $sum: GMV_EXPR },
              lastOrderAt: { $max: '$createdAt' },
            },
          },
        ],
        { allowDiskUse: true }
      ) as Promise<RfmCustomer[]>,
      Order.aggregate([
        {
          $match: {
            status: { $in: ['PENDING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] },
          },
        },
        {
          $group: {
            _id: {
              $ifNull: ['$deliveryAddress.township', '$totals.township'],
            },
            activeOrders: { $sum: 1 },
          },
        },
      ]) as Promise<TownshipActive[]>,
      Order.aggregate(
        [
          { $match: { prepTime: { $gte: 28 } } },
          {
            $group: {
              _id: { $ifNull: ['$restaurantName', 'Unknown'] },
              slowOrders: { $sum: 1 },
            },
          },
          { $sort: { slowOrders: -1 } },
          { $limit: 5 },
        ],
        { allowDiskUse: true }
      ) as Promise<SlowRestaurant[]>,
      User.countDocuments({ role: 'RIDER' }),
      RiderProfile.countDocuments({ status: 'Online' }),
      RestaurantProfile.find({}).select('restaurantName township').lean(),
    ]);

    const totalGMV = Number(platformAll?.totalGMV) || 0;
    const todayGMV = Number(platformToday?.todayGMV) || 0;
    const todayOrderCount = Number(platformToday?.todayOrders) || 0;
    const todayCancelled = Number(platformToday?.todayCancelled) || 0;
    const avgPrepTime =
      Number(platformToday?.prepN) > 0
        ? Math.round(
            (Number(platformToday?.prepSum) / Number(platformToday?.prepN)) * 10
          ) / 10
        : 0;

    const customers = (rfmCustomers || []).map((c) => ({
      customerId: String(c._id || ''),
      customerName: String(c.customerName || 'Customer').trim() || 'Customer',
      orderCount: Number(c.orderCount) || 0,
      monetary: Number(c.monetary) || 0,
      lastOrderAt: c.lastOrderAt ? new Date(c.lastOrderAt) : now,
    }));
    const frequencies = customers.map((c) => c.orderCount).sort((a, b) => a - b);
    const monetaries = customers.map((c) => c.monetary).sort((a, b) => a - b);
    const recencies = customers
      .map((c) => daysSince(c.lastOrderAt, now))
      .sort((a, b) => a - b);

    const highF = Math.max(2, percentile(frequencies, 0.55));
    const highM = Math.max(1, percentile(monetaries, 0.55));
    const lowR = percentile(recencies, 0.45);
    const highR = Math.max(lowR + 1, percentile(recencies, 0.6));

    const counts: Record<RfmSegment, number> = {
      'Top VIP': 0,
      'Sleeping Beauty': 0,
      'New/Normal': 0,
    };

    let churnedHeuristic = 0;
    for (const c of customers) {
      const recencyDays = daysSince(c.lastOrderAt, now);
      const isHighF = c.orderCount >= highF;
      const isHighM = c.monetary >= highM;
      const isLowR = recencyDays <= lowR;
      const isHighR = recencyDays >= highR;

      let segment: RfmSegment = 'New/Normal';
      if (isHighF && isHighM && isLowR) segment = 'Top VIP';
      else if ((isHighM || isHighF) && isHighR) segment = 'Sleeping Beauty';
      counts[segment] += 1;

      if (recencyDays > 60 && c.orderCount <= 1) churnedHeuristic += 1;
    }

    const totalCustomers = customers.length || 1;
    const churnRate = Math.round((churnedHeuristic / totalCustomers) * 1000) / 10;

    const TOWNSHIPS = [
      'Insein',
      'South Dagon',
      'Hlaing',
      'Kamaryut',
      'Bahan',
      'Yankin',
      'Mingaladon',
      'North Dagon',
      'Mayangone',
      'Thingangyun',
    ];

    const kitchenHotspots = TOWNSHIPS.map((township) => {
      const zoneActive = (townshipActive || []).reduce((sum, row) => {
        return matchTownship(row._id, township)
          ? sum + (Number(row.activeOrders) || 0)
          : sum;
      }, 0);
      const zoneRestaurants = restaurants.filter((r) =>
        matchTownship(r.township, township)
      ).length;
      const pressure =
        zoneRestaurants > 0
          ? Number((zoneActive / zoneRestaurants).toFixed(2))
          : zoneActive;
      return { township, activeOrders: zoneActive, restaurants: zoneRestaurants, pressure };
    })
      .filter((z) => z.activeOrders > 0 || z.pressure >= 1)
      .sort((a, b) => b.pressure - a.pressure)
      .slice(0, 5);

    const durationN = Number(platformAll?.durationN) || 0;
    const avgDuration =
      durationN > 0 ? Number(platformAll?.durationSum) / durationN : 0;
    const activeOrders = Number(platformAll?.activeOrders) || 0;
    const slowPrep = Number(platformAll?.slowPrep) || 0;
    const longDuration = Number(platformAll?.longDuration) || 0;

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      platform: {
        totalGMV: Math.round(totalGMV),
        todayGMV: Math.round(todayGMV),
        todayOrders: todayOrderCount,
        todayCancelled,
        activeRiders: onlineRiders || riderUsers,
        registeredRiders: riderUsers,
        avgPrepTime,
      },
      segmentation: {
        totalCustomers: customers.length,
        topVipCount: counts['Top VIP'],
        sleepingBeautyCount: counts['Sleeping Beauty'],
        newNormalCount: counts['New/Normal'],
        churnedCount: churnedHeuristic,
        churnRate,
      },
      operations: {
        activeOrders,
        slowPrepOrders: slowPrep,
        longDurationOrders: longDuration,
        avgDurationMins: Math.round(avgDuration * 10) / 10,
        kitchenHotspots,
        topSlowRestaurants: (topSlowRestaurants || []).map((r) => ({
          name: String(r._id || 'Unknown').trim() || 'Unknown',
          slowOrders: Number(r.slowOrders) || 0,
        })),
        insight:
          kitchenHotspots[0] && kitchenHotspots[0].pressure >= 1.5
            ? `${kitchenHotspots[0].township} shows the highest kitchen pressure (${kitchenHotspots[0].pressure} active orders per restaurant).`
            : avgPrepTime > 30
              ? `Average prep time is elevated at ${avgPrepTime} min — monitor high-volume kitchens.`
              : 'Kitchen load looks balanced across townships.',
      },
    });
  } catch (error) {
    console.error('Executive summary GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to build executive summary' },
      { status: 500 }
    );
  }
}
