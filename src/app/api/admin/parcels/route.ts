import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Parcel from '@/models/Parcel';
import { startOfYangonDay } from '@/lib/yangonTime';

/** GET /api/admin/parcels — parcel delivery KPIs + latest parcels (admin only via middleware). */
export async function GET() {
  try {
    await dbConnect();
    const today = startOfYangonDay(new Date());
    const [byStatus, todayAgg, latest] = await Promise.all([
      Parcel.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Parcel.aggregate<{ orders: number; gmv: number; platform: number; avgKm: number; avgMins: number }>([
        { $match: { createdAt: { $gte: today }, status: { $ne: 'CANCELLED' } } },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            gmv: { $sum: '$price.total' },
            platform: { $sum: '$price.platformFee' },
            avgKm: { $avg: '$price.roadKm' },
            avgMins: {
              $avg: {
                $cond: [
                  { $and: ['$deliveredAt', '$createdAt'] },
                  { $divide: [{ $subtract: ['$deliveredAt', '$createdAt'] }, 60000] },
                  null,
                ],
              },
            },
          },
        },
      ]),
      Parcel.find()
        .sort({ createdAt: -1 })
        .limit(12)
        .select('code status senderName recipientName pickup.address dropoff.address price.total price.roadKm riderName createdAt')
        .lean(),
    ]);
    const status = Object.fromEntries(byStatus.map((r) => [r._id, r.n]));
    const t = todayAgg[0];
    return NextResponse.json({
      success: true,
      status,
      today: {
        parcels: t?.orders || 0,
        gmv: Math.round(t?.gmv || 0),
        platformRevenue: Math.round(t?.platform || 0),
        avgRoadKm: t?.avgKm ? Number(t.avgKm.toFixed(1)) : 0,
        avgDeliveryMins: t?.avgMins ? Math.round(t.avgMins) : null,
      },
      latest,
    });
  } catch (error) {
    console.error('Admin parcels error:', error);
    return NextResponse.json({ success: false, message: 'Failed to load parcels' }, { status: 500 });
  }
}
