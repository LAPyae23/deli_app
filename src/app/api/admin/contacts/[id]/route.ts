import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import CustomerProfile from '@/models/CustomerProfile';
import RiderProfile from '@/models/RiderProfile';
import RestaurantProfile from '@/models/RestaurantProfile';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    await dbConnect();
    const { id } = await Promise.resolve(params);
    const contactId = String(id || '').trim();

    if (!contactId) {
      return NextResponse.json(
        { success: false, message: 'Contact ID required' },
        { status: 400 }
      );
    }

    const user = await User.findById(contactId).lean().catch(() => null);

    let role = String(user?.role || '').toUpperCase();
    let name = user
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
      : '';
    let phone = String(user?.phone || '');
    let email = String(user?.email || '');
    let displayId = String(user?.displayId || '');
    let extra: Record<string, unknown> = {};

    if (!role || role === 'CUSTOMER') {
      const customer = await CustomerProfile.findOne({ customerId: contactId }).lean();
      if (customer) {
        role = 'CUSTOMER';
        name = name || String(customer.name || '');
        phone = phone || String(customer.phone || '');
        email = email || String(customer.email || '');
        extra = {
          profileImage: customer.profileImage || '',
          address: customer.savedAddresses?.[0]?.address || '',
        };
      }
    }

    if (!role || role === 'RIDER') {
      const rider = await RiderProfile.findOne({ riderId: contactId }).lean();
      if (rider) {
        role = 'RIDER';
        name = name || String(rider.name || '');
        phone = phone || String(rider.phone || '');
        extra = {
          ...extra,
          vehicleType: rider.vehicleType || rider.vehicle || '',
          status: rider.status || '',
          township: rider.township || '',
          profileImage: rider.profileImage || '',
        };
      }
    }

    if (!role || role === 'RESTAURANT') {
      const restaurant = await RestaurantProfile.findOne({
        restaurantId: contactId,
      }).lean();
      if (restaurant) {
        role = 'RESTAURANT';
        name = name || String(restaurant.restaurantName || '');
        extra = {
          ...extra,
          township: restaurant.township || '',
          address: restaurant.address || '',
          storeStatus: restaurant.storeStatus || '',
          logoImage: restaurant.logoImage || '',
        };
      }
    }

    if (!role && !name) {
      return NextResponse.json(
        { success: false, message: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      contact: {
        id: contactId,
        displayId: displayId || contactId.slice(-8).toUpperCase(),
        name: name || 'Unknown user',
        phone: phone || '—',
        email: email || '—',
        role: role || 'USER',
        ...extra,
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
