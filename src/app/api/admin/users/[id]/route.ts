import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import CustomerProfile from '@/models/CustomerProfile';
import RiderProfile from '@/models/RiderProfile';
import Order from '@/models/Order';

function isValidObjectId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return false;
  try {
    return new mongoose.Types.ObjectId(id).toString() === id;
  } catch {
    return false;
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    await dbConnect();
    const { id } = await Promise.resolve(params);
    const lookup = String(id || '').trim();

    if (!lookup) {
      return NextResponse.json(
        { success: false, message: 'User ID required' },
        { status: 400 }
      );
    }

    const orFilters: Record<string, unknown>[] = [
      {
        displayId: {
          $regex: `^${escapeRegex(lookup)}$`,
          $options: 'i',
        },
      },
    ];

    if (isValidObjectId(lookup)) {
      orFilters.unshift({ _id: lookup });
    }

    const userDoc = (await User.findOne({ $or: orFilters })
      .select('-password')
      .lean()
      .catch(() => null)) as Record<string, unknown> | null;

    if (!userDoc?._id) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const actualId = String(userDoc._id);
    const role = String(userDoc.role || '').toUpperCase();

    const [customerProfile, riderProfile] = await Promise.all([
      role === 'RIDER'
        ? Promise.resolve(null)
        : CustomerProfile.findOne({ customerId: actualId }).lean().catch(() => null),
      role === 'CUSTOMER'
        ? Promise.resolve(null)
        : RiderProfile.findOne({ riderId: actualId }).lean().catch(() => null),
    ]);

    const walletBalance = Number(
      riderProfile?.walletBalance ?? userDoc.walletBalance ?? 0
    );
    const isBlocked = Boolean(riderProfile?.isBlocked ?? userDoc.isBlocked ?? false);

    const firstName = String(userDoc.firstName || '');
    const lastName = String(userDoc.lastName || '');
    const fullNameFromUser = `${firstName} ${lastName}`.trim();

    const user = {
      id: actualId,
      _id: actualId,
      displayId: String(userDoc.displayId || ''),
      firstName,
      lastName,
      name:
        fullNameFromUser ||
        String(customerProfile?.name || riderProfile?.name || ''),
      email: String(userDoc.email || customerProfile?.email || ''),
      phone: String(
        userDoc.phone || customerProfile?.phone || riderProfile?.phone || ''
      ),
      role,
      walletBalance,
      isBlocked,
      ...(customerProfile
        ? {
            profileImage: customerProfile.profileImage || '',
            savedAddresses: customerProfile.savedAddresses || [],
            streakCount: customerProfile.streakCount || 0,
          }
        : {}),
      ...(riderProfile
        ? {
            vehicleType: riderProfile.vehicleType || riderProfile.vehicle || '',
            status: riderProfile.status || '',
            township: riderProfile.township || '',
            profileImage: riderProfile.profileImage || '',
            approvalStatus: riderProfile.approvalStatus || '',
          }
        : {}),
    };

    let orderHistory: unknown[] = [];
    if (role === 'CUSTOMER') {
      orderHistory = await Order.find({ customerId: actualId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
        .catch(() => []);
    } else if (role === 'RIDER') {
      orderHistory = await Order.find({ riderId: actualId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
        .catch(() => []);
    }

    return NextResponse.json({
      success: true,
      user,
      orderHistory: Array.isArray(orderHistory) ? orderHistory : [],
    });
  } catch (error) {
    console.error('Admin user lookup GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load user profile' },
      { status: 500 }
    );
  }
}
