import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import CustomerProfile from '@/models/CustomerProfile';

/**
 * POST /api/customer/consume-promo
 * Body: { customerId: string }
 *
 * Marks the 7-day streak voucher as used so it cannot be reused.
 */
export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const customerId = String(body.customerId || '').trim();

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: 'customerId is required' },
        { status: 400 }
      );
    }

    const profile = await CustomerProfile.findOneAndUpdate(
      { customerId },
      {
        $set: {
          hasStreakReward: false,
          streakVoucherCode: '',
          streakDiscountPercent: 0,
          hasPromo: false,
          promoCode: '',
          promoDiscountPercent: 0,
        },
      },
      { new: true }
    );

    if (!profile) {
      return NextResponse.json(
        { success: false, message: 'Customer profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: {
        hasStreakReward: Boolean(profile.hasStreakReward),
        streakDiscountPercent: Number(profile.streakDiscountPercent) || 0,
        streakVoucherCode: profile.streakVoucherCode || '',
      },
      message: 'Promo consumed',
    });
  } catch (error) {
    console.error('Consume promo POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to consume promo' },
      { status: 500 }
    );
  }
}
