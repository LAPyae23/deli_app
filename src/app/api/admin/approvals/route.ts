import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RestaurantProfile from '@/models/RestaurantProfile';
import RiderProfile from '@/models/RiderProfile';
import User from '@/models/User';

export async function GET() {
  try {
    await dbConnect();

    const [restaurants, riders, users] = await Promise.all([
      RestaurantProfile.find({})
        .sort({ createdAt: -1 })
        .lean(),
      RiderProfile.find({}).sort({ createdAt: -1 }).lean(),
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
      createdAt: r.createdAt,
      submittedAt: undefined,
      profileImage: r.logoImage || '',
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
      profileImage: r.profileImage || '',
    }));

    // Prefer pending first, then newest
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
