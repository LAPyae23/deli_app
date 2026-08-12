import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';

type LeanOrder = {
  status?: string;
  prepTime?: number;
  totals?: { total?: number } | null;
};

function startOfLocalDay(d = new Date()): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return start;
}

function orderTotal(order: LeanOrder): number {
  const total = Number(order.totals?.total);
  return Number.isFinite(total) ? total : 0;
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

    const todayStart = startOfLocalDay();
    const now = new Date();

    const orders = (await Order.find({
      createdAt: { $gte: todayStart, $lte: now },
      $or: restaurantMatch,
    }).lean()) as LeanOrder[];

    const totalOrders = orders.length;

    const revenue = orders.reduce((sum, order) => {
      const status = String(order.status || '').toUpperCase();
      if (status === 'REJECTED' || status === 'CANCELLED') return sum;
      return sum + orderTotal(order);
    }, 0);

    const completedOrders = orders.filter(
      (o) => String(o.status || '').toUpperCase() === 'DELIVERED'
    ).length;

    const rejectedOrders = orders.filter(
      (o) => String(o.status || '').toUpperCase() === 'REJECTED'
    ).length;

    const acceptanceRate =
      totalOrders > 0
        ? Math.round(((totalOrders - rejectedOrders) / totalOrders) * 100)
        : 100;

    const acceptedOrders = orders.filter((o) => {
      const status = String(o.status || '').toUpperCase();
      return status !== 'REJECTED' && status !== 'CANCELLED';
    });

    const prepTimes = acceptedOrders
      .map((o) => Number(o.prepTime))
      .filter((n) => Number.isFinite(n) && n > 0);

    const avgPrepTime =
      prepTimes.length > 0
        ? Math.round((prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) * 10) / 10
        : 20;

    return NextResponse.json({
      success: true,
      stats: {
        revenue: Math.round(revenue * 100) / 100,
        completedOrders,
        rejectedOrders,
        acceptanceRate,
        avgPrepTime,
        totalOrders,
      },
    });
  } catch (error) {
    console.error('Restaurant stats GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch restaurant stats' },
      { status: 500 }
    );
  }
}
