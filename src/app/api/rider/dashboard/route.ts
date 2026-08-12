import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

type LeanOrder = {
  baseRiderFee?: number;
  tipAmount?: number;
  distanceKm?: number;
  completedAt?: Date | string | null;
  createdAt?: Date | string | null;
  totals?: { deliveryFee?: number; total?: number } | null;
};

function orderDate(order: LeanOrder): Date {
  const raw = order.completedAt || order.createdAt;
  return raw ? new Date(raw) : new Date(0);
}

function orderEarnings(order: LeanOrder): number {
  const tip = Number(order.tipAmount) || 0;
  if (order.baseRiderFee != null && Number.isFinite(Number(order.baseRiderFee))) {
    return Number(order.baseRiderFee) + tip;
  }
  const deliveryFee = Number(order.totals?.deliveryFee) || 0;
  return deliveryFee + tip;
}

function startOfLocalDay(d = new Date()): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** JS getDay(): Sun=0 … Sat=6 → WEEKLY_DATA index Mon=0 … Sun=6 */
function dayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const riderId = searchParams.get('riderId');

    if (!riderId) {
      return NextResponse.json(
        { success: false, message: 'riderId is required' },
        { status: 400 }
      );
    }

    const deliveredFilter = { riderId, status: 'DELIVERED' };

    const recentTrips = await Order.find(deliveredFilter)
      .sort({ completedAt: -1, createdAt: -1 })
      .limit(10)
      .lean();

    const todayStart = startOfLocalDay();
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);

    // Pull a recent window of delivered trips, then bucket in memory
    const candidateOrders = (await Order.find(deliveredFilter)
      .sort({ completedAt: -1, createdAt: -1 })
      .limit(200)
      .lean()) as LeanOrder[];

    const weekOrders = candidateOrders.filter((o) => orderDate(o) >= weekStart);
    const todayOrders = weekOrders.filter((o) => orderDate(o) >= todayStart);

    const todayEarnings = todayOrders.reduce((sum, o) => sum + orderEarnings(o), 0);
    const todayTips = todayOrders.reduce((sum, o) => sum + (Number(o.tipAmount) || 0), 0);
    const todayTrips = todayOrders.length;
    const todayDistance = todayOrders.reduce(
      (sum, o) => sum + (Number(o.distanceKm) || 0),
      0
    );

    const weeklyTotals = DAY_LABELS.map(() => 0);
    for (const order of weekOrders) {
      weeklyTotals[dayIndex(orderDate(order))] += orderEarnings(order);
    }

    const weeklyChartData = DAY_LABELS.map((day, i) => ({
      day,
      earnings: Math.round(weeklyTotals[i] * 100) / 100,
    }));

    return NextResponse.json({
      success: true,
      recentTrips,
      todayStats: {
        todayEarnings: Math.round(todayEarnings * 100) / 100,
        todayTips: Math.round(todayTips * 100) / 100,
        todayTrips,
        todayDistance: Math.round(todayDistance * 100) / 100,
      },
      weeklyChartData,
    });
  } catch (error) {
    console.error('Rider dashboard GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch rider dashboard data' },
      { status: 500 }
    );
  }
}
