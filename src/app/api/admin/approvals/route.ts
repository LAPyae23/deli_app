import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RestaurantProfile from '@/models/RestaurantProfile';
import RiderProfile from '@/models/RiderProfile';
import User from '@/models/User';

const PROFILE_SELECT =
  'restaurantId restaurantName approvalStatus township address storeStatus createdAt';
const RIDER_SELECT =
  'riderId name approvalStatus vehicleType vehicle township createdAt';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const inbox = searchParams.get('inbox') === '1';

    if (inbox) {
      const [pendingRestaurants, pendingRiders] = await Promise.all([
        RestaurantProfile.find({ approvalStatus: 'PENDING' })
          .select('restaurantId restaurantName township createdAt')
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
        RiderProfile.find({ approvalStatus: 'PENDING' })
          .select('riderId name township createdAt')
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
      ]);

      const approvals = [
        ...pendingRestaurants.map((r) => ({
          id: String(r.restaurantId),
          _id: String(r.restaurantId),
          type: 'VENDOR' as const,
          name: r.restaurantName || 'Restaurant',
          township: r.township || '',
          status: 'PENDING',
        })),
        ...pendingRiders.map((r) => ({
          id: String(r.riderId),
          _id: String(r.riderId),
          type: 'RIDER' as const,
          name: r.name || 'Rider',
          township: r.township || '',
          status: 'PENDING',
        })),
      ];

      return NextResponse.json({
        success: true,
        approvals,
        pendingCount: approvals.length,
      });
    }

    const [restaurants, riders, users] = await Promise.all([
      RestaurantProfile.find({})
        .select(PROFILE_SELECT)
        .sort({ createdAt: -1 })
        .lean(),
      RiderProfile.find({}).select(RIDER_SELECT).sort({ createdAt: -1 }).lean(),
      User.find({ role: { $in: ['RESTAURANT', 'RIDER'] } })
        .select('email role')
        .lean(),
    ]);

    const emailById = new Map(
      users.map((u) => [String(u._id), String(u.email || '')])
    );

    const vendorApprovals = restaurants.map((r) => ({
      _id: String(r.restaurantId),
      id: String(r.restaurantId),
      type: 'VENDOR' as const,
      name: r.restaurantName || 'Restaurant',
      submittedBy: r.restaurantName || 'Vendor',
      email: emailById.get(String(r.restaurantId)) || '',
      documents: 4,
      status: (r.approvalStatus || 'APPROVED') as string,
      commissionRate: 18,
      flagged: false,
      township: r.township || '',
      address: r.address || '',
      storeStatus: r.storeStatus || 'OPEN',
      createdAt: r.createdAt,
      submittedAt: undefined,
      profileImage: '',
    }));

    const riderApprovals = riders.map((r) => ({
      _id: String(r.riderId),
      id: String(r.riderId),
      type: 'RIDER' as const,
      name: r.name || 'Rider',
      submittedBy: r.name || 'Rider',
      email: emailById.get(String(r.riderId)) || '',
      documents: 3,
      status: (r.approvalStatus || 'APPROVED') as string,
      vehicleType: r.vehicleType || r.vehicle || 'Motorcycle',
      flagged: false,
      township: r.township || '',
      createdAt: r.createdAt,
      submittedAt: undefined,
      profileImage: '',
    }));

    const approvals = [...vendorApprovals, ...riderApprovals].sort((a, b) => {
      const rank = (s: string) => (s === 'PENDING' ? 0 : s === 'REJECTED' ? 1 : 2);
      const diff = rank(a.status) - rank(b.status);
      if (diff !== 0) return diff;
      return (
        new Date(b.createdAt as Date).getTime() -
        new Date(a.createdAt as Date).getTime()
      );
    });

    const pendingCount = approvals.filter((a) => a.status === 'PENDING').length;

    return NextResponse.json({
      success: true,
      approvals,
      pendingCount,
    });
  } catch (error) {
    console.error('Admin approvals GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}
