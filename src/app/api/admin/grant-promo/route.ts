import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import CustomerProfile from '@/models/CustomerProfile';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const customerId = String(body.customerId || '').trim();
    const promoCode = String(body.promoCode || '').trim().toUpperCase();
    const discountPercent = Number(body.discountPercent);

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: 'customerId is required' },
        { status: 400 }
      );
    }
    if (!promoCode) {
      return NextResponse.json(
        { success: false, message: 'promoCode is required' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      return NextResponse.json(
        { success: false, message: 'discountPercent must be between 1 and 100' },
        { status: 400 }
      );
    }

    const profile = await CustomerProfile.findOneAndUpdate(
      { customerId },
      {
        $set: {
          customerId,
          hasPromo: true,
          promoCode,
          promoDiscountPercent: Math.round(discountPercent),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Promo granted',
      profile: {
        customerId: profile.customerId,
        hasPromo: Boolean(profile.hasPromo),
        promoCode: profile.promoCode || '',
        promoDiscountPercent: Number(profile.promoDiscountPercent) || 0,
      },
    });
  } catch (error) {
    console.error('Admin grant-promo POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to grant promo' },
      { status: 500 }
    );
  }
}
