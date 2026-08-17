import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { cacheGetOrSet } from '@/lib/ttlCache';
import {
  computeChurn,
  computeMarketBasket,
  computeRegression,
  parseDateRange,
  rangeCutoff,
  type AnalyticsOrder,
  type DateRangeKey,
} from '@/lib/mlAnalytics';

const MAX_ORDERS = 8_000;

function rangeLabel(range: DateRangeKey) {
  if (range === '7d') return 'Last 7 Days';
  if (range === '30d') return 'Last 30 Days';
  if (range === '90d') return 'Last 90 Days';
  return 'All Time';
}

export async function GET(request: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const range = parseDateRange(searchParams.get('range'));
    const payload = await cacheGetOrSet(`ml-analytics:${range}`, 60_000, async () => {
      const cutoff = rangeCutoff(range);
      const query: Record<string, unknown> = {};
      if (cutoff) query.createdAt = { $gte: cutoff };

      const orders = (await Order.find(query)
        .select(
          'customerId customerName distanceKm durationMins customerOrderCount createdAt items.name status'
        )
        .limit(MAX_ORDERS)
        .lean()) as AnalyticsOrder[];

      const regression = computeRegression(orders);
      const baskets = computeMarketBasket(orders, 5);
      const churn = computeChurn(orders);

      return {
        success: true,
        range,
        rangeLabel: rangeLabel(range),
        orderCount: orders.length,
        regression,
        baskets,
        churn,
        generatedAt: new Date().toISOString(),
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Admin ML analytics GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to run ML analytics' },
      { status: 500 }
    );
  }
}
