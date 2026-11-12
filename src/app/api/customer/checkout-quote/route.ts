import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import CustomerProfile from '@/models/CustomerProfile';
import { getSession, unauthorized } from '@/lib/auth';
import { ensureDefaultCampaigns, quotePromo } from '@/lib/promotions';
import { KS_PER_POINT_VALUE, MIN_POINTS_REDEEM, pointsRedemption } from '@/lib/loyalty';

/**
 * POST /api/customer/checkout-quote
 * Body: { subtotal, deliveryFee, promoCode?, usePoints? }
 * Preview of the promo discount and the points the customer can spend.
 * The order route repeats these checks; nothing is used up here.
 */
export async function POST(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  await dbConnect();
  await ensureDefaultCampaigns();

  const body = await request.json().catch(() => ({}));
  const subtotal = Math.max(0, Math.round(Number(body.subtotal) || 0));
  const deliveryFee = Math.max(0, Math.round(Number(body.deliveryFee) || 0));
  const customerId = session.userId;

  const promo = body.promoCode ? await quotePromo(customerId, body.promoCode, subtotal, deliveryFee) : null;
  const promoDiscount = promo && promo.ok ? promo.discount : 0;

  const profile = await CustomerProfile.findOne({ customerId })
    .select('loyaltyPoints')
    .lean<{ loyaltyPoints?: number }>();
  const balance = Math.max(0, Number(profile?.loyaltyPoints) || 0);
  const plan = pointsRedemption(balance, subtotal - Math.min(promoDiscount, subtotal));

  return NextResponse.json({
    success: true,
    promo,
    points: {
      balance,
      redeemable: plan.points,
      value: plan.value,
      ksPerPoint: KS_PER_POINT_VALUE,
      minimum: MIN_POINTS_REDEEM,
    },
  });
}
