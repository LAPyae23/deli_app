import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

type LeanOrder = {
  prepTime?: number;
  weather?: string;
  createdAt?: Date;
  items?: Array<{ name?: string; quantity?: number }> | null;
};

function getPrepMins(order: LeanOrder): number {
  const n = Number(order.prepTime);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

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

    const restaurantMatch = [];
    if (restaurantId) restaurantMatch.push({ restaurantId });
    if (restaurantName) restaurantMatch.push({ restaurantName });

    const orders = (await Order.find({ $or: restaurantMatch })
      .select('prepTime weather createdAt items')
      .lean()) as LeanOrder[];

    // --- Logic 1: Kitchen bottleneck by day of week ---
    const byDay: Record<
      string,
      { sum: number; count: number }
    > = Object.fromEntries(DAY_NAMES.map((d) => [d, { sum: 0, count: 0 }]));

    let overallSum = 0;
    let overallCount = 0;

    for (const order of orders) {
      const prep = getPrepMins(order);
      if (prep <= 0 || !order.createdAt) continue;
      const day = DAY_NAMES[new Date(order.createdAt).getDay()];
      byDay[day].sum += prep;
      byDay[day].count += 1;
      overallSum += prep;
      overallCount += 1;
    }

    const prepByDay = DAY_NAMES.map((day) => {
      const bucket = byDay[day];
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

    // --- Logic 2: Weather demand forecasting ---
    const rainyItemCounts = new Map<string, number>();
    const weatherTotals: Record<string, number> = {};

    for (const order of orders) {
      const weather = String(order.weather || 'Sunny');
      weatherTotals[weather] = (weatherTotals[weather] || 0) + 1;

      if (weather !== 'Rainy') continue;
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const name = String(item?.name || '').trim();
        if (!name) continue;
        const qty = Number(item?.quantity);
        const add = Number.isFinite(qty) && qty > 0 ? qty : 1;
        rainyItemCounts.set(name, (rainyItemCounts.get(name) || 0) + add);
      }
    }

    const rainyTopItems = Array.from(rainyItemCounts.entries())
      .map(([name, quantitySold]) => ({ name, quantitySold }))
      .sort((a, b) => b.quantitySold - a.quantitySold);

    const topRainyItem = rainyTopItems[0] || null;
    const suggestedPrepQty = topRainyItem
      ? Math.max(30, Math.ceil(topRainyItem.quantitySold * 0.35))
      : 30;

    const forecastAlert = topRainyItem
      ? `🌧️ Rainy day expected tomorrow. Prepare ${suggestedPrepQty}+ bowls of ${topRainyItem.name} based on past data.`
      : '🌧️ Rainy-weather forecast ready once you have Rainy-day sales history. Seed or complete more orders to unlock this alert.';

    return NextResponse.json({
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
          rainyTopItems: rainyTopItems.slice(0, 5),
          weatherOrderCounts: weatherTotals,
          alert: forecastAlert,
        },
      },
      orderCount: orders.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Restaurant insights GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to build kitchen insights' },
      { status: 500 }
    );
  }
}
