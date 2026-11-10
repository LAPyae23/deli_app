import { NextResponse } from 'next/server';
import { getYangonWeather, isWet } from '@/lib/weather';
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
                      _id: { $dayOfWeek: { date: '$createdAt', timezone: 'Asia/Yangon' } },
                      sum: { $sum: '$prepTime' },
                      count: { $sum: 1 },
                    },
                  },
                ],
                // Quantity per dish per Yangon day, split by real wet / dry weather.
                dayDishes: [
                  { $match: { weather: { $in: ['Sunny', 'Cloudy', 'Rainy', 'Stormy'] }, status: { $nin: ['CANCELLED', 'REJECTED'] } } },
                  { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
                  {
                    $group: {
                      _id: {
                        wet: { $in: ['$weather', ['Rainy', 'Stormy']] },
                        dish: { $ifNull: ['$items.name', 'Item'] },
                      },
                      qty: { $sum: { $ifNull: ['$items.quantity', 1] } },
                    },
                  },
                ],
                classDays: [
                  { $match: { weather: { $in: ['Sunny', 'Cloudy', 'Rainy', 'Stormy'] }, status: { $nin: ['CANCELLED', 'REJECTED'] } } },
                  {
                    $group: {
                      _id: {
                        wet: { $in: ['$weather', ['Rainy', 'Stormy']] },
                        day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Yangon' } },
                      },
                    },
                  },
                  { $group: { _id: '$_id.wet', days: { $sum: 1 } } },
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
        const dayDishes = (facet?.dayDishes || []) as Array<{ _id: { wet: boolean; dish: string }; qty: number }>;
        const classDays = (facet?.classDays || []) as Array<{ _id: boolean; days: number }>;
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
            ? `⚠️ Your prep time increases by ${prepIncreaseMins} mins on ${bottleneckDay.day}s. Riders are waiting. Consider adding kitchen staff.`
            : `⚠️ ${bottleneckDay.day} is your busiest kitchen day (avg ${bottleneckDay.avgPrepMins} mins prep). Keep staffing ready so riders aren't waiting.`
          : '⚠️ Not enough prep-time history yet. Complete more orders to unlock bottleneck insights.';

        // Tomorrow's real forecast (Open-Meteo) decides which history applies.
        const live = await getYangonWeather();
        const rainChance = live.tomorrow.rainChancePct;
        const wetTomorrow = isWet(live.tomorrow.kind) || (rainChance != null && rainChance >= 60);

        const daysOf = (wet: boolean) => classDays.find((d) => d._id === wet)?.days || 0;
        const perDay = (wet: boolean) => {
          const days = daysOf(wet);
          const m = new Map<string, number>();
          for (const r of dayDishes) {
            if (r._id.wet !== wet || !days) continue;
            m.set(String(r._id.dish), (m.get(String(r._id.dish)) || 0) + (Number(r.qty) || 0) / days);
          }
          return m;
        };
        const target = perDay(wetTomorrow);
        const other = perDay(!wetTomorrow);
        const targetDays = daysOf(wetTomorrow);
        const topItems = [...target.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, avg]) => ({
            name,
            avgPerDay: Math.round(avg * 10) / 10,
            vsOtherWeatherPct: other.get(name) ? Math.round((avg / other.get(name)! - 1) * 100) : null,
          }));
        const top = topItems[0] || null;
        // Prep the typical day's amount plus a 10% buffer.
        const suggestedPrepQty = top ? Math.max(1, Math.ceil(top.avgPerDay * 1.1)) : 0;

        const weatherTotals: Record<string, number> = {};
        for (const row of weatherRows) {
          weatherTotals[String(row._id || 'Unknown')] = Number(row.count) || 0;
        }

        const chanceText = rainChance != null ? `${rainChance}% rain chance` : 'seasonal estimate';
        const vsText = top?.vsOtherWeatherPct != null && Math.abs(top.vsOtherWeatherPct) >= 10
          ? ` (${top.vsOtherWeatherPct > 0 ? '+' : ''}${top.vsOtherWeatherPct}% vs ${wetTomorrow ? 'dry' : 'rainy'} days)`
          : '';
        const forecastAlert = !top || targetDays < 3
          ? `${wetTomorrow ? '🌧️ Rain likely' : '☀️ Dry weather'} tomorrow (${chanceText}). Not enough ${wetTomorrow ? 'rainy' : 'dry'}-day sales history yet to suggest prep amounts.`
          : wetTomorrow
            ? `🌧️ Rain likely tomorrow (${chanceText}). On rainy days you sell about ${top.avgPerDay} ${top.name} a day${vsText}. Prepare ${suggestedPrepQty}.`
            : `☀️ Tomorrow looks dry (${chanceText}). On dry days your top seller is ${top.name}, about ${top.avgPerDay} a day${vsText}. Prepare ${suggestedPrepQty}.`;

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
              weather: live.tomorrow.kind,
              wetTomorrow,
              rainChancePct: rainChance,
              date: live.tomorrow.date,
              source: live.source,
              topItem: top?.name || null,
              avgPerDay: top?.avgPerDay ?? 0,
              historyDays: targetDays,
              suggestedPrepQty,
              topItems,
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
