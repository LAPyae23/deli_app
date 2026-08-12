import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import RiderProfile from '@/models/RiderProfile';
import RestaurantProfile from '@/models/RestaurantProfile';

type LeanOrder = {
  status?: string;
  prepTime?: number;
  travelMins?: number;
  durationMins?: number;
  distanceKm?: number;
  restaurantName?: string;
  customerId?: string;
  customerName?: string;
  customerOrderCount?: number;
  createdAt?: Date | string | null;
  deliveryAddress?: { township?: string } | null;
  totals?: { total?: number; totalAmount?: number; township?: string } | null;
};

type RfmSegment = 'Top VIP' | 'Sleeping Beauty' | 'New/Normal';

function orderGMV(order: LeanOrder): number {
  const total = Number(order.totals?.total ?? order.totals?.totalAmount);
  return Number.isFinite(total) ? total : 0;
}

function startOfLocalDay(d = new Date()): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return start;
}

function daysSince(date: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function matchTownship(value: unknown, township: string) {
  const text = String(value || '');
  if (!text) return false;
  if (text === township) return true;
  const short = township.split('(')[0].trim();
  return text.includes(township) || (short.length > 3 && text.includes(short));
}

/**
 * GET /api/admin/executive-summary
 * Compiles platform, RFM, and ops bottleneck metrics for the PDF report.
 */
export async function GET() {
  try {
    await dbConnect();
    const now = new Date();
    const todayStart = startOfLocalDay(now);

    const [allOrders, todayOrders, riderUsers, onlineRiders, restaurants] =
      await Promise.all([
        Order.find({})
          .select(
            'status prepTime travelMins durationMins distanceKm restaurantName customerId customerName customerOrderCount createdAt deliveryAddress totals'
          )
          .lean() as Promise<LeanOrder[]>,
        Order.find({ createdAt: { $gte: todayStart, $lte: now } })
          .select('status prepTime totals')
          .lean() as Promise<LeanOrder[]>,
        User.countDocuments({ role: 'RIDER' }),
        RiderProfile.countDocuments({ status: 'Online' }),
        RestaurantProfile.find({}).select('restaurantName township').lean(),
      ]);

    const totalGMV = allOrders.reduce((s, o) => s + orderGMV(o), 0);
    const todayGMV = todayOrders.reduce((s, o) => s + orderGMV(o), 0);
    const todayOrderCount = todayOrders.length;

    const todayCancelled = todayOrders.filter((o) => {
      const s = String(o.status || '').toUpperCase();
      return s === 'CANCELLED' || s === 'REJECTED';
    }).length;

    const prepTimes = todayOrders
      .map((o) => Number(o.prepTime))
      .filter((n) => Number.isFinite(n) && n > 0);
    const avgPrepTime =
      prepTimes.length > 0
        ? Math.round((prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) * 10) / 10
        : 0;

    // --- RFM segments ---
    type Agg = {
      customerId: string;
      customerName: string;
      orderCount: number;
      monetary: number;
      lastOrderAt: Date;
    };
    const byCustomer = new Map<string, Agg>();

    for (const order of allOrders) {
      const status = String(order.status || '').toUpperCase();
      if (status === 'CANCELLED' || status === 'REJECTED') continue;

      const customerId = String(order.customerId || '').trim();
      const customerName = String(order.customerName || 'Customer').trim() || 'Customer';
      const key = customerId || `name:${customerName.toLowerCase()}`;
      const created = order.createdAt ? new Date(order.createdAt) : now;
      const amount = orderGMV(order);

      const existing = byCustomer.get(key);
      if (!existing) {
        byCustomer.set(key, {
          customerId: customerId || key,
          customerName,
          orderCount: 1,
          monetary: amount,
          lastOrderAt: created,
        });
      } else {
        existing.orderCount += 1;
        existing.monetary += amount;
        if (created > existing.lastOrderAt) {
          existing.lastOrderAt = created;
          existing.customerName = customerName || existing.customerName;
        }
      }
    }

    const customers = Array.from(byCustomer.values());
    const frequencies = customers.map((c) => c.orderCount).sort((a, b) => a - b);
    const monetaries = customers.map((c) => c.monetary).sort((a, b) => a - b);
    const recencies = customers
      .map((c) => daysSince(c.lastOrderAt, now))
      .sort((a, b) => a - b);

    const highF = Math.max(2, percentile(frequencies, 0.55));
    const highM = Math.max(1, percentile(monetaries, 0.55));
    const lowR = percentile(recencies, 0.45);
    const highR = Math.max(lowR + 1, percentile(recencies, 0.6));

    const counts: Record<RfmSegment, number> = {
      'Top VIP': 0,
      'Sleeping Beauty': 0,
      'New/Normal': 0,
    };

    let churnedHeuristic = 0;
    for (const c of customers) {
      const recencyDays = daysSince(c.lastOrderAt, now);
      const isHighF = c.orderCount >= highF;
      const isHighM = c.monetary >= highM;
      const isLowR = recencyDays <= lowR;
      const isHighR = recencyDays >= highR;

      let segment: RfmSegment = 'New/Normal';
      if (isHighF && isHighM && isLowR) segment = 'Top VIP';
      else if ((isHighM || isHighF) && isHighR) segment = 'Sleeping Beauty';
      counts[segment] += 1;

      // Align with ML churn heuristic: idle >60d + low frequency
      if (recencyDays > 60 && c.orderCount <= 1) churnedHeuristic += 1;
    }

    const totalCustomers = customers.length || 1;
    const churnRate =
      Math.round((churnedHeuristic / totalCustomers) * 1000) / 10;

    // --- Kitchen & operational bottlenecks ---
    const slowPrep = allOrders.filter((o) => Number(o.prepTime) >= 30).length;
    const longDuration = allOrders.filter((o) => Number(o.durationMins) >= 55).length;
    const activeStatuses = new Set(['PENDING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']);
    const activeOrders = allOrders.filter((o) =>
      activeStatuses.has(String(o.status || '').toUpperCase())
    );

    // Township pressure: active orders vs restaurants (proxy for kitchen load)
    const TOWNSHIPS = [
      'South Dagon',
      'Bahan',
      'Kyauktada',
      'Pabedan',
      'Latha',
      'Lanmadaw',
      'Sanchaung',
      'Mayangone',
      'South Okkalapa',
      'North Okkalapa',
    ];

    const kitchenHotspots = TOWNSHIPS.map((township) => {
      const zoneActive = activeOrders.filter((o) => {
        const addr = o.deliveryAddress;
        const totals = o.totals;
        return (
          matchTownship(addr?.township, township) ||
          matchTownship(totals?.township, township)
        );
      }).length;
      const zoneRestaurants = restaurants.filter((r) =>
        matchTownship(r.township, township)
      ).length;
      const pressure =
        zoneRestaurants > 0
          ? Number((zoneActive / zoneRestaurants).toFixed(2))
          : zoneActive;
      return { township, activeOrders: zoneActive, restaurants: zoneRestaurants, pressure };
    })
      .filter((z) => z.activeOrders > 0 || z.pressure >= 1)
      .sort((a, b) => b.pressure - a.pressure)
      .slice(0, 5);

    const topSlowRestaurants = Object.entries(
      allOrders.reduce((acc, o) => {
        if (Number(o.prepTime) < 28) return acc;
        const name = String(o.restaurantName || 'Unknown').trim() || 'Unknown';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    )
      .map(([name, slowOrders]) => ({ name, slowOrders }))
      .sort((a, b) => b.slowOrders - a.slowOrders)
      .slice(0, 5);

    const avgDuration =
      allOrders
        .map((o) => Number(o.durationMins))
        .filter((n) => Number.isFinite(n) && n > 0)
        .reduce((a, b, _, arr) => a + b / arr.length, 0) || 0;

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      platform: {
        totalGMV: Math.round(totalGMV),
        todayGMV: Math.round(todayGMV),
        todayOrders: todayOrderCount,
        todayCancelled,
        activeRiders: onlineRiders || riderUsers,
        registeredRiders: riderUsers,
        avgPrepTime,
      },
      segmentation: {
        totalCustomers: customers.length,
        topVipCount: counts['Top VIP'],
        sleepingBeautyCount: counts['Sleeping Beauty'],
        newNormalCount: counts['New/Normal'],
        churnedCount: churnedHeuristic,
        churnRate,
      },
      operations: {
        activeOrders: activeOrders.length,
        slowPrepOrders: slowPrep,
        longDurationOrders: longDuration,
        avgDurationMins: Math.round(avgDuration * 10) / 10,
        kitchenHotspots,
        topSlowRestaurants,
        insight:
          kitchenHotspots[0] && kitchenHotspots[0].pressure >= 1.5
            ? `${kitchenHotspots[0].township} shows the highest kitchen pressure (${kitchenHotspots[0].pressure} active orders per restaurant).`
            : avgPrepTime > 30
              ? `Average prep time is elevated at ${avgPrepTime} min — monitor high-volume kitchens.`
              : 'Kitchen load looks balanced across townships.',
      },
    });
  } catch (error) {
    console.error('Executive summary GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to build executive summary' },
      { status: 500 }
    );
  }
}
