import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { cacheGetOrSet } from '@/lib/ttlCache';
import {
  dashboardPeriodLabel,
  dashboardRangeStart,
  dashboardSummaryTitle,
  parseDashboardRange,
} from '@/lib/dashboardRange';

/** Food subtotal only — never fall back to customer total (tax + delivery). */
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

/** Net restaurant earnings = food subtotal − commission (default 30%). */
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
  totalOrders?: number;
  totalRevenue?: number;
  completedOrders?: number;
  rejectedOrders?: number;
  avgPrepTime?: number;
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

export async function GET(request: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const restaurantName = searchParams.get('restaurantName')?.trim() || '';
    const restaurantId = searchParams.get('restaurantId')?.trim() || '';
    const range = parseDashboardRange(searchParams.get('range'));

    if (!restaurantName && !restaurantId) {
      return NextResponse.json(
        { success: false, message: 'restaurantName or restaurantId is required' },
        { status: 400 }
      );
    }

    const payload = await cacheGetOrSet(
      `restaurant-stats:${restaurantId || restaurantName}:${range}`,
      15_000,
      async () => {
        const start = dashboardRangeStart(range);
        const now = new Date();
        const match: Record<string, unknown> = {
          createdAt: { $gte: start, $lte: now },
        };
        if (restaurantId) match.restaurantId = restaurantId;
        else match.restaurantName = restaurantName;

        const [kpi] = (await Order.aggregate(
          [
            { $match: match },
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalRevenue: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', ['REJECTED', 'CANCELLED']] },
                      0,
                      netRevenueExpr,
                    ],
                  },
                },
                completedOrders: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0],
                  },
                },
                rejectedOrders: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0],
                  },
                },
                avgPrepTime: {
                  $avg: {
                    $cond: [
                      {
                        $and: [
                          { $gt: [{ $ifNull: ['$prepTime', 0] }, 0] },
                          {
                            $not: [
                              { $in: ['$status', ['REJECTED', 'CANCELLED']] },
                            ],
                          },
                        ],
                      },
                      '$prepTime',
                      null,
                    ],
                  },
                },
              },
            },
          ],
          { allowDiskUse: true }
        )) as KpiAgg[];

        const totalOrders = Number(kpi?.totalOrders) || 0;
        const revenue = Math.max(0, Number(kpi?.totalRevenue) || 0);
        const completedOrders = Number(kpi?.completedOrders) || 0;
        const rejectedOrders = Number(kpi?.rejectedOrders) || 0;
        const acceptanceRate =
          totalOrders > 0
            ? Math.round(((totalOrders - rejectedOrders) / totalOrders) * 100)
            : 100;
        const avgPrepTime =
          kpi?.avgPrepTime != null && Number.isFinite(Number(kpi.avgPrepTime))
            ? Math.round(Number(kpi.avgPrepTime) * 10) / 10
            : 20;

        const weeklyStats = {
          revenue: Math.round(revenue * 100) / 100,
          completedOrders,
          rejectedOrders,
          acceptanceRate,
          avgPrepTime,
          totalOrders,
        };

        return {
          success: true,
          range,
          periodLabel: dashboardPeriodLabel(range),
          summaryTitle: dashboardSummaryTitle(range),
          weeklyStats,
          stats: weeklyStats,
        };
      }
    );

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Restaurant stats GET error:', error);
    return NextResponse.json(
      { success: false, message: errorMessage(error, 'Failed to fetch restaurant stats') },
      { status: 500 }
    );
  }
}
