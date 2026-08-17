import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import RiderProfile from '@/models/RiderProfile';
import {
  dashboardChartMeta,
  dashboardPeriodLabel,
  dashboardRangeStart,
  dashboardSummaryTitle,
  parseDashboardRange,
  type DashboardRange,
} from '@/lib/dashboardRange';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const TODAY_BUCKETS = ['12a–4a', '4a–8a', '8a–12p', '12p–4p', '4p–8p', '8p–12a'] as const;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const dateExpr = { $ifNull: ['$completedAt', '$createdAt'] };
const earningsExpr = {
  $add: [
    {
      $ifNull: [
        '$baseRiderFee',
        { $round: [{ $multiply: [{ $ifNull: ['$totals.deliveryFee', 0] }, 0.9] }, 0] },
      ],
    },
    { $ifNull: ['$tipAmount', 0] },
  ],
};

type KpiAgg = {
  weeklyEarnings?: number;
  weeklyTips?: number;
  weeklyTrips?: number;
  weeklyDistance?: number;
};

type ChartBucket = { _id?: number; earnings?: number };

function emptyChart(range: DashboardRange, start: Date) {
  if (range === 'today') {
    return TODAY_BUCKETS.map((day) => ({ day, earnings: 0 }));
  }
  if (range === '30d') {
    const bucketMs = 5 * 24 * 60 * 60 * 1000;
    return Array.from({ length: 6 }, (_, i) => {
      const t = new Date(start.getTime() + i * bucketMs);
      const day = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Yangon',
        month: 'short',
        day: 'numeric',
      }).format(t);
      return { day, earnings: 0 };
    });
  }
  return DAY_LABELS.map((day) => ({ day, earnings: 0 }));
}

function chartBucketExpr(range: DashboardRange, start: Date) {
  if (range === 'today') {
    return {
      $min: [
        5,
        {
          $floor: {
            $divide: [{ $hour: { date: dateExpr, timezone: 'Asia/Yangon' } }, 4],
          },
        },
      ],
    };
  }
  if (range === '30d') {
    const bucketMs = 5 * 24 * 60 * 60 * 1000;
    return {
      $min: [
        5,
        {
          $max: [
            0,
            {
              $floor: {
                $divide: [{ $subtract: [dateExpr, start] }, bucketMs],
              },
            },
          ],
        },
      ],
    };
  }
  return {
    $subtract: [{ $isoDayOfWeek: { date: dateExpr, timezone: 'Asia/Yangon' } }, 1],
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = parseDashboardRange(searchParams.get('range'));

  try {
    await dbConnect();
    const riderId = searchParams.get('riderId');

    if (!riderId) {
      return NextResponse.json(
        { success: false, message: 'riderId is required' },
        { status: 400 }
      );
    }

    const start = dashboardRangeStart(range);
    const deliveredFilter = {
      riderId,
      status: 'DELIVERED',
      createdAt: { $gte: start },
    };

    const [recentTrips, [stats], riderWallet] = await Promise.all([
      Order.find({ riderId, status: 'DELIVERED' })
        .select(
          'orderNumber restaurantName customerName status baseRiderFee tipAmount distanceKm durationMins completedAt createdAt totals deliveryAddress'
        )
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      Order.aggregate(
        [
          { $match: deliveredFilter },
          {
            $facet: {
              kpi: [
                {
                  $group: {
                    _id: null,
                    weeklyEarnings: { $sum: earningsExpr },
                    weeklyTips: { $sum: { $ifNull: ['$tipAmount', 0] } },
                    weeklyTrips: { $sum: 1 },
                    weeklyDistance: { $sum: { $ifNull: ['$distanceKm', 0] } },
                  },
                },
              ],
              chart: [
                {
                  $group: {
                    _id: chartBucketExpr(range, start),
                    earnings: { $sum: earningsExpr },
                  },
                },
              ],
            },
          },
        ],
        { allowDiskUse: true }
      ) as Promise<Array<{ kpi?: KpiAgg[]; chart?: ChartBucket[] }>>,
      RiderProfile.findOne({ riderId }).select('walletBalance isBlocked').lean(),
    ]);

    const kpi = stats?.kpi?.[0];
    const chart = emptyChart(range, start);
    for (const bucket of stats?.chart || []) {
      const idx = Number(bucket._id);
      if (Number.isInteger(idx) && idx >= 0 && idx < chart.length) {
        chart[idx].earnings = round2(Number(bucket.earnings) || 0);
      }
    }

    const chartMeta = dashboardChartMeta(range);

    return NextResponse.json({
      success: true,
      range,
      periodLabel: dashboardPeriodLabel(range),
      summaryTitle: dashboardSummaryTitle(range),
      chartTitle: chartMeta.title,
      chartSubtitle: chartMeta.subtitle,
      recentTrips,
      weeklyStats: {
        weeklyEarnings: round2(Number(kpi?.weeklyEarnings) || 0),
        weeklyTips: round2(Number(kpi?.weeklyTips) || 0),
        weeklyTrips: Number(kpi?.weeklyTrips) || 0,
        weeklyDistance: round2(Number(kpi?.weeklyDistance) || 0),
      },
      weeklyChartData: chart,
      wallet: {
        walletBalance: Number(riderWallet?.walletBalance) || 0,
        isBlocked: riderWallet?.isBlocked === true,
      },
    });
  } catch (error) {
    console.error('Rider dashboard GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load rider dashboard' },
      { status: 500 }
    );
  }
}
