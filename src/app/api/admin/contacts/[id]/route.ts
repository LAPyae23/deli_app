import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import CustomerProfile from '@/models/CustomerProfile';
import RiderProfile from '@/models/RiderProfile';
import RestaurantProfile from '@/models/RestaurantProfile';

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

function exactMatch(value: string) {
  return { $regex: `^${escapeRegex(value)}$`, $options: 'i' };
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
        { success: false, message: 'Contact ID required' },
        { status: 400 }
      );
    }

    const orFilters: Record<string, unknown>[] = [
      { displayId: exactMatch(lookup) },
      { email: exactMatch(lookup) },
    ];
    if (isValidObjectId(lookup)) {
      orFilters.unshift({ _id: lookup });
    }

    let user = (await User.findOne({ $or: orFilters })
      .select('-password')
      .lean()
      .catch(() => null)) as Record<string, unknown> | null;

    let customer: Record<string, any> | null = null;
    let rider: Record<string, any> | null = null;
    let restaurant: Record<string, any> | null = null;

    if (!user?._id) {
      [customer, rider, restaurant] = await Promise.all([
        CustomerProfile.findOne({ customerId: lookup }).lean().catch(() => null),
        RiderProfile.findOne({ riderId: lookup }).lean().catch(() => null),
        RestaurantProfile.findOne({ restaurantId: lookup }).lean().catch(() => null),
      ]);

      const linkedId = String(
        customer?.customerId || rider?.riderId || restaurant?.restaurantId || ''
      );

      if (linkedId) {
        const linkedOr: Record<string, unknown>[] = [
          { displayId: exactMatch(linkedId) },
          { email: exactMatch(linkedId) },
        ];
        if (isValidObjectId(linkedId)) {
          linkedOr.unshift({ _id: linkedId });
        }
        user = (await User.findOne({ $or: linkedOr })
          .select('-password')
          .lean()
          .catch(() => null)) as Record<string, unknown> | null;
      }
    }

    const role = String(
      user?.role ||
        (customer ? 'CUSTOMER' : rider ? 'RIDER' : restaurant ? 'RESTAURANT' : '')
    ).toUpperCase();
    const userId = user?._id ? String(user._id) : lookup;

    if (role === 'CUSTOMER' && !customer) {
      customer = await CustomerProfile.findOne({ customerId: userId })
        .lean()
        .catch(() => null);
    } else if (role === 'RIDER' && !rider) {
      rider = await RiderProfile.findOne({ riderId: userId }).lean().catch(() => null);
    } else if (role === 'RESTAURANT' && !restaurant) {
      restaurant = await RestaurantProfile.findOne({ restaurantId: userId })
        .lean()
        .catch(() => null);
    }

    if (!user && !customer && !rider && !restaurant) {
      return NextResponse.json(
        { success: false, message: 'Contact not found' },
        { status: 404 }
      );
    }

    const savedAddresses = Array.isArray(customer?.savedAddresses)
      ? customer.savedAddresses
      : [];
    const firstAddress = String(savedAddresses[0]?.address || '').trim();

    const name =
      `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
      String(customer?.name || rider?.name || restaurant?.restaurantName || '') ||
      'Unknown user';

    return NextResponse.json({
      success: true,
      contact: {
        id: userId,
        displayId: String(user?.displayId || lookup),
        name,
        email: String(user?.email || customer?.email || ''),
        phone: String(user?.phone || customer?.phone || rider?.phone || ''),
        role: role || 'USER',
        township: String(rider?.township || restaurant?.township || ''),
        address: firstAddress || String(restaurant?.address || ''),
        vehicleType: String(rider?.vehicleType || rider?.vehicle || ''),
        status: String(rider?.status || ''),
        storeStatus: String(restaurant?.storeStatus || ''),
      },
    });
  } catch (error) {
    console.error('Admin contact GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load contact profile' },
      { status: 500 }
    );
  }
}
