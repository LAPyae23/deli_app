// app/api/customer/profile/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import CustomerProfile from '@/models/CustomerProfile';
import User from '@/models/User';

function normalizeSavedAddresses(raw: unknown) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const entry = (item || {}) as Record<string, unknown>;
      return {
        label: String(entry.label || ''),
        address: String(entry.address || ''),
        detail: String(entry.detail || ''),
        lat: entry.lat != null ? Number(entry.lat) : undefined,
        lng: entry.lng != null ? Number(entry.lng) : undefined,
      };
    })
    .filter((a) => a.address.trim().length > 0);
}

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: 'customerId is required' },
        { status: 400 }
      );
    }

    const [profile, user] = await Promise.all([
      CustomerProfile.findOne({ customerId }).lean(),
      User.findById(customerId).select('displayId firstName lastName email phone').lean(),
    ]);

    const displayId = user?.displayId || undefined;

    return NextResponse.json({
      success: true,
      profile: profile
        ? {
            ...profile,
            savedAddresses: Array.isArray(profile.savedAddresses)
              ? profile.savedAddresses
              : [],
            displayId,
          }
          : user
          ? {
              name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
              email: user.email || '',
              phone: user.phone || '',
              profileImage: '',
              savedAddresses: [],
              streakCount: 0,
              lastLoginDate: null,
              hasStreakReward: false,
              streakDiscountPercent: 0,
              streakVoucherCode: '',
              hasPromo: false,
              promoCode: '',
              promoDiscountPercent: 0,
              displayId,
            }
          : null,
    });
  } catch (error) {
    console.error('Customer profile GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch customer profile' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const customerId = body.customerId;
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: 'customerId is required' },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = { customerId };

    if (body.name !== undefined) update.name = body.name || '';
    if (body.phone !== undefined) update.phone = body.phone || '';
    if (body.email !== undefined) update.email = body.email || '';
    if (body.profileImage !== undefined) update.profileImage = body.profileImage || '';
    if (body.savedAddresses !== undefined) {
      update.savedAddresses = normalizeSavedAddresses(body.savedAddresses);
    }

    const profile = await CustomerProfile.findOneAndUpdate(
      { customerId },
      {
        $set: update,
        $unset: { defaultAddress: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      success: true,
      profile,
      message: 'Customer profile saved successfully',
    });
  } catch (error) {
    console.error('Customer profile POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save customer profile' },
      { status: 500 }
    );
  }
}
