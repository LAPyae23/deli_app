import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import { YANGON_TZ, hourLabel, startOfYangonDay, yangonParts } from '@/lib/yangonTime';
import { cacheGetOrSet } from '@/lib/ttlCache';

const ACTIVE_STATUSES = ['PENDING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];

const gmvExpr = {
  $convert: {
    input: { $ifNull: ['$totals.total', { $ifNull: ['$totals.totalAmount', 0] }] },
    to: 'double',
    onError: 0,
    onNull: 0,
  },
};

type TodayAgg = {
  totalOrders?: number;
  totalGMV?: number;
  cancelledOrders?: number;
  avgPrepTime?: number;
};

type HourlyAgg = {
  _id?: number;
  orders?: number;
  gmv?: number;
};

export async function GET(_request: Request) {
  try {
    await dbConnect();

    const now = new Date();
    const todayStart = startOfYangonDay(now);
    const currentHour = yangonParts(now).hour;

    const payload = await cacheGetOrSet('admin-stats', 15_000, async () => {
    const [todayFacet, activeAgg] = await Promise.all([
      Order.aggregate(
        [
          { $match: { createdAt: { $gte: todayStart, $lte: now } } },
          {
            $facet: {
              kpis: [
                {
                  $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalGMV: {
                      $sum: {
                        $cond: [
                          { $in: ['$status', ['CANCELLED', 'REJECTED']] },
                          0,
                          gmvExpr,
                        ],
                      },
                    },
                    cancelledOrders: {
                      $sum: {
                        $cond: [
                          {
                            $in: ['$status', ['CANCELLED', 'REJECTED']],
                          },
                          1,
                          0,
                        ],
                      },
                    },
                    avgPrepTime: {
                      $avg: {
                        $cond: [
                          { $gt: [{ $ifNull: ['$prepTime', 0] }, 0] },
                          '$prepTime',
                          null,
                        ],
                      },
                    },
                  },
                },
              ],
              hourly: [
                {
                  $group: {
                    _id: { $hour: { date: '$createdAt', timezone: YANGON_TZ } },
                    orders: { $sum: 1 },
                    gmv: {
                      $sum: {
                        $cond: [
                          { $in: ['$status', ['CANCELLED', 'REJECTED']] },
                          0,
                          gmvExpr,
                        ],
                      },
                    },
                  },
                },
                { $sort: { _id: 1 } },
              ],
            },
          },
        ],
        { allowDiskUse: true }
      ) as Promise<
        Array<{
          kpis?: TodayAgg[];
          hourly?: HourlyAgg[];
        }>
      >,
      Order.aggregate(
        [{ $match: { status: { $in: ACTIVE_STATUSES } } }, { $count: 'count' }],
        { allowDiskUse: true }
      ) as Promise<Array<{ count?: number }>>,
    ]);

    const today = todayFacet[0]?.kpis?.[0];
    const totalOrders = Number(today?.totalOrders) || 0;
    const totalGMV = Number(today?.totalGMV) || 0;
    const cancelledOrders = Number(today?.cancelledOrders) || 0;
    const avgPrepTime =
      today?.avgPrepTime != null && Number.isFinite(Number(today.avgPrepTime))
        ? Math.round(Number(today.avgPrepTime) * 10) / 10
        : 0;
    const activeOrders = Number(activeAgg[0]?.count) || 0;

    const hourlyMap = new Map<number, { orders: number; gmv: number }>();
    for (const row of todayFacet[0]?.hourly || []) {
      const hour = Number(row._id);
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
      hourlyMap.set(hour, {
        orders: Number(row.orders) || 0,
        gmv: Number(row.gmv) || 0,
      });
    }

    const hourlyData = [];
    for (let h = 0; h <= currentHour; h++) {
      const bucket = hourlyMap.get(h);
      hourlyData.push({
        hour: hourLabel(h),
        orders: bucket?.orders || 0,
        gmv: Math.round((bucket?.gmv || 0) * 100) / 100,
      });
    }

    const activeRiders = await User.countDocuments({ role: 'RIDER' });

    return {
      success: true,
      kpis: {
        totalGMV: Math.round(totalGMV * 100) / 100,
        totalOrders,
        activeOrders,
        cancelledOrders,
        avgPrepTime,
        activeRiders,
      },
      hourlyData,
    };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Admin stats GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch admin stats' },
      { status: 500 }
    );
  }
}
