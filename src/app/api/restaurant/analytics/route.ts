import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import RestaurantProfile from '@/models/RestaurantProfile';
import { getSession, unauthorized } from '@/lib/auth';
import { cacheGetOrSet } from '@/lib/ttlCache';

const DAYS = 30;
const LIVE = { $nin: ['CANCELLED', 'REJECTED'] };

type Facet = {
  topDishes: Array<{ _id: string; qty: number; revenue: number }>;
  heat: Array<{ _id: { d: number; h: number }; n: number }>;
  customers: Array<{ _id: string; n: number }>;
  ratings: Array<{ _id: number; n: number }>;
  weatherDays: Array<{ _id: { day: string; wet: boolean }; n: number }>;
  wetDishes: Array<{ _id: string; qty: number }>;
  daily: Array<{ _id: string; revenue: number; orders: number }>;
  status: Array<{ _id: string; n: number }>;
};

/**
 * GET /api/restaurant/analytics — last 30 days for the signed-in restaurant:
 * top dishes, busiest hours, repeat customers, ratings, wet vs dry weather
 * demand, daily revenue and cancellation rate.
 */
export async function GET(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  await dbConnect();

  const requested = new URL(request.url).searchParams.get('restaurantId');
  const restaurantId = session.role === 'ADMIN' && requested ? requested : session.userId;

  const data = await cacheGetOrSet(`restaurant-analytics:${restaurantId}`, 60_000, async () => {
    const profile = await RestaurantProfile.findOne({ restaurantId })
      .select('restaurantName')
      .lean<{ restaurantName?: string }>();
    const name = String(profile?.restaurantName || '').trim();
    const since = new Date(Date.now() - DAYS * 86400_000);
    const who = name ? { $or: [{ restaurantId }, { restaurantName: name }] } : { restaurantId };

    const [facet] = await Order.aggregate<Facet>([
      { $match: { ...who, createdAt: { $gte: since } } },
      {
        $facet: {
          topDishes: [
            { $match: { status: LIVE } },
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.name',
                qty: { $sum: { $ifNull: ['$items.quantity', 1] } },
                revenue: {
                  $sum: {
                    $multiply: [
                      { $ifNull: ['$items.unitPrice', '$items.price'] },
                      { $ifNull: ['$items.quantity', 1] },
                    ],
                  },
                },
              },
            },
            { $sort: { qty: -1 } },
            { $limit: 8 },
          ],
          heat: [
            { $match: { status: LIVE } },
            {
              $group: {
                _id: {
                  d: { $dayOfWeek: { date: '$createdAt', timezone: 'Asia/Yangon' } },
                  h: { $hour: { date: '$createdAt', timezone: 'Asia/Yangon' } },
                },
                n: { $sum: 1 },
              },
            },
          ],
          customers: [
            { $match: { status: LIVE, customerId: { $nin: [null, ''] } } },
            { $group: { _id: '$customerId', n: { $sum: 1 } } },
          ],
          ratings: [
            { $match: { restaurantRating: { $gte: 1 } } },
            { $group: { _id: { $round: ['$restaurantRating', 0] }, n: { $sum: 1 } } },
          ],
          weatherDays: [
            { $match: { status: LIVE } },
            {
              $group: {
                _id: {
                  day: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d', timezone: 'Asia/Yangon' } },
                  wet: { $in: ['$weather', ['Rainy', 'Stormy']] },
                },
                n: { $sum: 1 },
              },
            },
          ],
          wetDishes: [
            { $match: { status: LIVE, weather: { $in: ['Rainy', 'Stormy'] } } },
            { $unwind: '$items' },
            { $group: { _id: '$items.name', qty: { $sum: { $ifNull: ['$items.quantity', 1] } } } },
            { $sort: { qty: -1 } },
            { $limit: 3 },
          ],
          daily: [
            { $match: { status: LIVE, createdAt: { $gte: new Date(Date.now() - 14 * 86400_000) } } },
            {
              $group: {
                _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d', timezone: 'Asia/Yangon' } },
                revenue: { $sum: { $ifNull: ['$totals.subtotal', 0] } },
                orders: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          status: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
        },
      },
    ]);

    // Busiest hours: 7 x 24 grid (Mon..Sun), plus the top 3 slots.
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
    for (const c of facet.heat) {
      const row = (c._id.d + 5) % 7; // Mongo: 1 = Sunday → Monday-first rows
      grid[row][c._id.h] += c.n;
    }
    const slots = facet.heat
      .map((c) => ({ day: (c._id.d + 5) % 7, hour: c._id.h, orders: c.n }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 3);

    const customerCount = facet.customers.length;
    const repeat = facet.customers.filter((c) => c.n > 1).length;
    const ratingCount = facet.ratings.reduce((s, r) => s + r.n, 0);
    const ratingSum = facet.ratings.reduce((s, r) => s + r._id * r.n, 0);

    // Wet vs dry: average orders per day of each kind.
    const dayKinds = new Map<string, { wet: number; dry: number }>();
    for (const w of facet.weatherDays) {
      const cur = dayKinds.get(w._id.day) || { wet: 0, dry: 0 };
      if (w._id.wet) cur.wet += w.n;
      else cur.dry += w.n;
      dayKinds.set(w._id.day, cur);
    }
    let wetDays = 0;
    let wetOrders = 0;
    let dryDays = 0;
    let dryOrders = 0;
    for (const v of dayKinds.values()) {
      const total = v.wet + v.dry;
      if (v.wet > v.dry) {
        wetDays += 1;
        wetOrders += total;
      } else {
        dryDays += 1;
        dryOrders += total;
      }
    }
    const wetAvg = wetDays ? wetOrders / wetDays : 0;
    const dryAvg = dryDays ? dryOrders / dryDays : 0;

    const statusCount = Object.fromEntries(facet.status.map((s) => [s._id, s.n]));
    const totalOrders = facet.status.reduce((s, x) => s + x.n, 0);
    const lost = (statusCount.CANCELLED || 0) + (statusCount.REJECTED || 0);

    return {
      days: DAYS,
      totalOrders,
      topDishes: facet.topDishes.map((d) => ({ name: d._id, qty: d.qty, revenue: Math.round(d.revenue) })),
      heatmap: grid,
      busiest: slots,
      customers: { total: customerCount, repeat, repeatRate: customerCount ? repeat / customerCount : 0 },
      rating: {
        average: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
        count: ratingCount,
        distribution: [1, 2, 3, 4, 5].map((star) => facet.ratings.find((r) => r._id === star)?.n || 0),
      },
      weather: {
        wetDays,
        dryDays,
        wetAvgOrders: Math.round(wetAvg * 10) / 10,
        dryAvgOrders: Math.round(dryAvg * 10) / 10,
        changePct: dryAvg ? Math.round(((wetAvg - dryAvg) / dryAvg) * 100) : null,
        topWetDishes: facet.wetDishes.map((d) => ({ name: d._id, qty: d.qty })),
      },
      daily: facet.daily.map((d) => ({ day: d._id, revenue: Math.round(d.revenue), orders: d.orders })),
      cancelRate: totalOrders ? lost / totalOrders : 0,
    };
  });

  return NextResponse.json({ success: true, ...data });
}
