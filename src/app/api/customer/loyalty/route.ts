import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import CustomerProfile from '@/models/CustomerProfile';
import Order from '@/models/Order';
import PromoCode from '@/models/PromoCode';
import PromoRedemption from '@/models/PromoRedemption';
import { getSession, unauthorized } from '@/lib/auth';
import { campaignLabel, ensureDefaultCampaigns } from '@/lib/promotions';
import { KS_PER_POINT_EARNED, KS_PER_POINT_VALUE, MIN_POINTS_REDEEM } from '@/lib/loyalty';

type CampaignRow = {
  code: string;
  description?: string;
  kind: 'PERCENT' | 'FLAT' | 'FREE_DELIVERY';
  value: number;
  maxDiscount?: number;
  minSubtotal?: number;
  firstOrderOnly?: boolean;
  perUserLimit?: number;
  totalLimit?: number;
  usedCount?: number;
  expiresAt?: Date | null;
};

/** GET /api/customer/loyalty: points balance, recent point activity and open promo codes. */
export async function GET(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  await dbConnect();
  await ensureDefaultCampaigns();
  const customerId = session.userId;
  const now = new Date();

  const [profile, history, campaigns, used] = await Promise.all([
    CustomerProfile.findOne({ customerId }).select('loyaltyPoints lifetimePoints').lean<{
      loyaltyPoints?: number;
      lifetimePoints?: number;
    }>(),
    Order.find({ customerId, $or: [{ pointsEarned: { $gt: 0 } }, { pointsRedeemed: { $gt: 0 } }] })
      .select('orderNumber restaurantName pointsEarned pointsRedeemed pointsRefunded createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    PromoCode.find({
      active: true,
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean<CampaignRow[]>(),
    PromoRedemption.aggregate<{ _id: string; n: number }>([
      { $match: { customerId } },
      { $group: { _id: '$code', n: { $sum: 1 } } },
    ]),
  ]);
  const usedBy = new Map(used.map((u) => [u._id, u.n]));

  return NextResponse.json({
    success: true,
    balance: Number(profile?.loyaltyPoints) || 0,
    lifetime: Number(profile?.lifetimePoints) || 0,
    rules: {
      ksPerPointEarned: KS_PER_POINT_EARNED,
      ksPerPointValue: KS_PER_POINT_VALUE,
      minimum: MIN_POINTS_REDEEM,
    },
    history,
    promos: campaigns
      .filter((c) => !c.totalLimit || (c.usedCount || 0) < c.totalLimit)
      .map((c) => ({
        code: c.code,
        description: c.description || '',
        label: campaignLabel(c),
        minSubtotal: c.minSubtotal || 0,
        firstOrderOnly: Boolean(c.firstOrderOnly),
        expiresAt: c.expiresAt || null,
        usesLeft: Math.max(0, Math.max(1, c.perUserLimit || 1) - (usedBy.get(c.code) || 0)),
      }))
      .filter((c) => c.usesLeft > 0),
  });
}
