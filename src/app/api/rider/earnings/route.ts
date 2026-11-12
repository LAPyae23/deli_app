import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import Parcel from '@/models/Parcel';
import RiderProfile from '@/models/RiderProfile';
import { getSession, unauthorized } from '@/lib/auth';
import { startOfYangonDay } from '@/lib/yangonTime';

const SERIES_DAYS = 14;
const dayKey = (date: unknown) => ({
  $dateToString: { date, format: '%Y-%m-%d', timezone: 'Asia/Yangon' },
});

type Row = { _id: string; fees: number; tips: number; trips: number; km: number };

/**
 * GET /api/rider/earnings — the signed-in rider's money in one place:
 * today / 7 days / 30 days split into delivery fees, tips and parcels,
 * a 14-day daily series, average rating and best hours to ride.
 */
export async function GET(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  await dbConnect();
  const requested = new URL(request.url).searchParams.get('riderId');
  const riderId = session.role === 'ADMIN' && requested ? requested : session.userId;

  const since30 = new Date(Date.now() - 30 * 86400_000);
  const when = { $ifNull: ['$completedAt', '$createdAt'] };

  const [foodDaily, parcelDaily, ratingAgg, hours, profile] = await Promise.all([
    Order.aggregate<Row>([
      { $match: { riderId, status: 'DELIVERED', $or: [{ completedAt: { $gte: since30 } }, { createdAt: { $gte: since30 } }] } },
      {
        $group: {
          _id: dayKey(when),
          fees: {
            $sum: {
              $subtract: [
                { $ifNull: ['$baseRiderFee', { $multiply: [{ $ifNull: ['$totals.deliveryFee', 0] }, 0.9] }] },
                // baseRiderFee includes the tip once delivered; keep tips separate.
                { $cond: [{ $gt: ['$completedAt', null] }, { $ifNull: ['$tipAmount', 0] }, 0] },
              ],
            },
          },
          tips: { $sum: { $ifNull: ['$tipAmount', 0] } },
          trips: { $sum: 1 },
          km: { $sum: { $ifNull: ['$distanceKm', 0] } },
        },
      },
    ]),
    Parcel.aggregate<Row>([
      { $match: { riderId, status: 'DELIVERED', deliveredAt: { $gte: since30 } } },
      {
        $group: {
          _id: dayKey('$deliveredAt'),
          fees: { $sum: { $ifNull: ['$price.riderEarning', 0] } },
          tips: { $sum: 0 },
          trips: { $sum: 1 },
          km: { $sum: { $ifNull: ['$price.roadKm', 0] } },
        },
      },
    ]),
    Order.aggregate<{ avg: number; n: number }>([
      { $match: { riderId, riderRating: { $gte: 1 } } },
      { $group: { _id: null, avg: { $avg: '$riderRating' }, n: { $sum: 1 } } },
    ]),
    Order.aggregate<{ _id: number; perTrip: number; trips: number }>([
      { $match: { riderId, status: 'DELIVERED', completedAt: { $gte: since30 } } },
      {
        $group: {
          _id: { $hour: { date: '$completedAt', timezone: 'Asia/Yangon' } },
          perTrip: { $avg: { $ifNull: ['$baseRiderFee', 0] } },
          trips: { $sum: 1 },
        },
      },
      { $match: { trips: { $gte: 2 } } },
      { $sort: { perTrip: -1 } },
      { $limit: 3 },
    ]),
    RiderProfile.findOne({ riderId }).select('walletBalance isBlocked').lean<{ walletBalance?: number; isBlocked?: boolean }>(),
  ]);

  // Merge food + parcel rows per day.
  const byDay = new Map<string, { food: number; tips: number; parcels: number; trips: number; km: number }>();
  for (const r of foodDaily) {
    const cur = byDay.get(r._id) || { food: 0, tips: 0, parcels: 0, trips: 0, km: 0 };
    cur.food += Math.max(0, r.fees);
    cur.tips += r.tips;
    cur.trips += r.trips;
    cur.km += r.km;
    byDay.set(r._id, cur);
  }
  for (const r of parcelDaily) {
    const cur = byDay.get(r._id) || { food: 0, tips: 0, parcels: 0, trips: 0, km: 0 };
    cur.parcels += r.fees;
    cur.trips += r.trips;
    cur.km += r.km;
    byDay.set(r._id, cur);
  }

  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yangon' });
  const todayStart = startOfYangonDay();
  const totalsSince = (days: number) => {
    const from = fmt.format(new Date(todayStart.getTime() - (days - 1) * 86400_000));
    const t = { food: 0, tips: 0, parcels: 0, trips: 0, km: 0 };
    for (const [day, v] of byDay) {
      if (day >= from) {
        t.food += v.food;
        t.tips += v.tips;
        t.parcels += v.parcels;
        t.trips += v.trips;
        t.km += v.km;
      }
    }
    const total = Math.round(t.food + t.tips + t.parcels);
    return {
      food: Math.round(t.food),
      tips: Math.round(t.tips),
      parcels: Math.round(t.parcels),
      total,
      trips: t.trips,
      km: Math.round(t.km * 10) / 10,
      perTrip: t.trips ? Math.round(total / t.trips) : 0,
    };
  };

  const series = Array.from({ length: SERIES_DAYS }, (_, i) => {
    const date = new Date(todayStart.getTime() - (SERIES_DAYS - 1 - i) * 86400_000);
    const key = fmt.format(date);
    const v = byDay.get(key) || { food: 0, tips: 0, parcels: 0, trips: 0, km: 0 };
    return {
      day: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Yangon', day: 'numeric', month: 'short' }).format(date),
      food: Math.round(v.food),
      tips: Math.round(v.tips),
      parcels: Math.round(v.parcels),
    };
  });

  return NextResponse.json({
    success: true,
    today: totalsSince(1),
    week: totalsSince(7),
    month: totalsSince(30),
    series,
    rating: ratingAgg[0] ? { average: Math.round(ratingAgg[0].avg * 10) / 10, count: ratingAgg[0].n } : null,
    bestHours: hours.map((h) => ({ hour: h._id, perTrip: Math.round(h.perTrip), trips: h.trips })),
    wallet: { balance: Number(profile?.walletBalance) || 0, isBlocked: Boolean(profile?.isBlocked) },
  });
}
