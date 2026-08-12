import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';

type LeanOrder = {
  status?: string;
  prepTime?: number;
  totals?: { total?: number } | null;
  createdAt?: Date | string | null;
};

function startOfLocalDay(d = new Date()): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return start;
}

function orderGMV(order: LeanOrder): number {
  const total = Number(order.totals?.total);
  return Number.isFinite(total) ? total : 0;
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export async function GET(_request: Request) {
  try {
    await dbConnect();

    const todayStart = startOfLocalDay();
    const now = new Date();

    const orders = (await Order.find({
      createdAt: { $gte: todayStart, $lte: now },
    }).lean()) as LeanOrder[];

    const totalOrders = orders.length;
    const totalGMV = orders.reduce((sum, o) => sum + orderGMV(o), 0);

    const cancelledOrders = orders.filter((o) => {
      const status = String(o.status || '').toUpperCase();
      return status === 'CANCELLED' || status === 'REJECTED';
    }).length;

    const prepTimes = orders
      .map((o) => Number(o.prepTime))
      .filter((n) => Number.isFinite(n) && n > 0);
    const avgPrepTime =
      prepTimes.length > 0
        ? Math.round((prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) * 10) / 10
        : 0;

    const currentHour = now.getHours();
    const buckets = new Map<string, { hour: string; orders: number; gmv: number }>();
    for (let h = 0; h <= currentHour; h++) {
      const label = hourLabel(h);
      buckets.set(label, { hour: label, orders: 0, gmv: 0 });
    }

    for (const order of orders) {
      if (!order.createdAt) continue;
      const created = new Date(order.createdAt);
      if (Number.isNaN(created.getTime())) continue;
      const label = hourLabel(created.getHours());
      const bucket = buckets.get(label);
      if (!bucket) continue;
      bucket.orders += 1;
      bucket.gmv += orderGMV(order);
    }

    const hourlyData = Array.from(buckets.values()).map((b) => ({
      hour: b.hour,
      orders: b.orders,
      gmv: Math.round(b.gmv * 100) / 100,
    }));

    const activeRiders = await User.countDocuments({ role: 'RIDER' });

    return NextResponse.json({
      success: true,
      kpis: {
        totalGMV: Math.round(totalGMV * 100) / 100,
        totalOrders,
        cancelledOrders,
        avgPrepTime,
        activeRiders,
      },
      hourlyData,
    });
  } catch (error) {
    console.error('Admin stats GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch admin stats' },
      { status: 500 }
    );
  }
}
