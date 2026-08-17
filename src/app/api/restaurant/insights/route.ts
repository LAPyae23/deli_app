import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { cacheGetOrSet } from '@/lib/ttlCache';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

type DayAgg = { _id?: number; sum?: number; count?: number };
type RainyAgg = { _id?: string; quantitySold?: number };
type WeatherAgg = { _id?: string; count?: number };

export async function GET(request: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const restaurantName = searchParams.get('restaurantName')?.trim() || '';
    const restaurantId = searchParams.get('restaurantId')?.trim() || '';

    if (!restaurantName && !restaurantId) {
      return NextResponse.json(
        { success: false, message: 'restaurantName or restaurantId is required' },
        { status: 400 }
      );
    }

    const payload = await cacheGetOrSet(
      `restaurant-insights:${restaurantId || restaurantName}`,
      30_000,
      async () => {
        const match = restaurantId ? { restaurantId } : { restaurantName };

        const [facet] = await Order.aggregate(
          [
            { $match: match },
            {
              $facet: {
                byDay: [
                  { $match: { prepTime: { $gt: 0 } } },
                  {
                    $group: {
                      _id: { $dayOfWeek: '$createdAt' },
                      sum: { $sum: '$prepTime' },
                      count: { $sum: 1 },
                    },
                  },
                ],
                rainyItems: [
                  { $match: { weather: 'Rainy' } },
                  { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
                  {
                    $group: {
                      _id: { $ifNull: ['$items.name', 'Item'] },
                      quantitySold: {
                        $sum: { $ifNull: ['$items.quantity', 1] },
                      },
                    },
                  },
                  { $sort: { quantitySold: -1 } },
                  { $limit: 5 },
                ],
                weatherCounts: [
                  {
                    $group: {
                      _id: { $ifNull: ['$weather', 'Sunny'] },
                      count: { $sum: 1 },
                    },
                  },
                ],
                total: [{ $count: 'count' }],
              },
            },
          ],
          { allowDiskUse: true }
        );

        const byDay = (facet?.byDay || []) as DayAgg[];
        const rainyItems = (facet?.rainyItems || []) as RainyAgg[];
        const weatherRows = (facet?.weatherCounts || []) as WeatherAgg[];
        const orderCount = Number(facet?.total?.[0]?.count) || 0;

        const dayMap = new Map<number, { sum: number; count: number }>();
        for (const row of byDay) {
          const idx = Number(row._id);
          if (!Number.isFinite(idx)) continue;
          dayMap.set(idx, {
            sum: Number(row.sum) || 0,
            count: Number(row.count) || 0,
          });
        }

        let overallSum = 0;
        let overallCount = 0;
        const prepByDay = DAY_NAMES.map((day, i) => {
          const mongoDay = i + 1;
          const bucket = dayMap.get(mongoDay) || { sum: 0, count: 0 };
          overallSum += bucket.sum;
          overallCount += bucket.count;
          const avgPrepMins =
            bucket.count > 0
              ? Math.round((bucket.sum / bucket.count) * 10) / 10
              : 0;
          return { day, avgPrepMins, orderCount: bucket.count };
        });

        const overallAvgPrep =
          overallCount > 0
            ? Math.round((overallSum / overallCount) * 10) / 10
            : 0;

        const bottleneckDay = [...prepByDay]
          .filter((d) => d.orderCount > 0)
          .sort((a, b) => b.avgPrepMins - a.avgPrepMins)[0];

        const prepIncreaseMins = bottleneckDay
          ? Math.max(0, Math.round(bottleneckDay.avgPrepMins - overallAvgPrep))
          : 0;

        const bottleneckAlert = bottleneckDay
          ? prepIncreaseMins > 0
            ? `⚠️ Your prep time increases by ${prepIncreaseMins} mins on ${bottleneckDay.day} evenings. Riders are waiting. Consider adding kitchen staff.`
            : `⚠️ ${bottleneckDay.day} is your busiest kitchen day (avg ${bottleneckDay.avgPrepMins} mins prep). Keep staffing ready so riders aren't waiting.`
          : '⚠️ Not enough prep-time history yet. Complete more orders to unlock bottleneck insights.';

        const rainyTopItems = rainyItems.map((row) => ({
          name: String(row._id || 'Item'),
          quantitySold: Number(row.quantitySold) || 0,
        }));
        const topRainyItem = rainyTopItems[0] || null;
        const suggestedPrepQty = topRainyItem
          ? Math.max(30, Math.ceil(topRainyItem.quantitySold * 0.35))
          : 30;

        const weatherTotals: Record<string, number> = {};
        for (const row of weatherRows) {
          weatherTotals[String(row._id || 'Sunny')] = Number(row.count) || 0;
        }

        const forecastAlert = topRainyItem
          ? `🌧️ Rainy day expected tomorrow. Prepare ${suggestedPrepQty}+ bowls of ${topRainyItem.name} based on past data.`
          : '🌧️ Rainy-weather forecast ready once you have Rainy-day sales history. Seed or complete more orders to unlock this alert.';

        return {
          success: true,
          insights: {
            bottleneck: {
              day: bottleneckDay?.day || null,
              avgPrepMins: bottleneckDay?.avgPrepMins ?? 0,
              overallAvgPrepMins: overallAvgPrep,
              prepIncreaseMins,
              prepByDay,
              alert: bottleneckAlert,
            },
            forecast: {
              weather: 'Rainy',
              topItem: topRainyItem?.name || null,
              quantitySold: topRainyItem?.quantitySold || 0,
              suggestedPrepQty,
              rainyTopItems,
              weatherOrderCounts: weatherTotals,
              alert: forecastAlert,
            },
          },
          orderCount,
          generatedAt: new Date().toISOString(),
        };
      }
    );

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Restaurant insights GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to build kitchen insights' },
      { status: 500 }
    );
  }
}
