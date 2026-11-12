/**
 * Promo codes at checkout. Three kinds of code are accepted:
 *  - PERSONAL: a code an admin granted to one customer (RFM campaign)
 *  - STREAK:   the 7-day login streak voucher
 *  - CAMPAIGN: a platform-wide code from the PromoCode collection
 *
 * `quotePromo` only checks a code (for the cart preview). `claimPromo`
 * checks and uses it atomically when the order is placed, and returns a
 * `release` function to give it back if the order cannot be saved.
 */
import CustomerProfile from '@/models/CustomerProfile';
import PromoCode from '@/models/PromoCode';
import PromoRedemption from '@/models/PromoRedemption';
import Order from '@/models/Order';

export type PromoSource = 'PERSONAL' | 'STREAK' | 'CAMPAIGN';

export type PromoOk = {
  ok: true;
  code: string;
  discount: number;
  label: string;
  source: PromoSource;
};
export type PromoFail = { ok: false; message: string };
export type PromoQuote = PromoOk | PromoFail;

type ProfilePromo = {
  hasPromo?: boolean;
  promoCode?: string;
  promoDiscountPercent?: number;
  hasStreakReward?: boolean;
  streakVoucherCode?: string;
  streakDiscountPercent?: number;
};

type CampaignDoc = {
  _id: unknown;
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
  startsAt?: Date;
  expiresAt?: Date;
  active?: boolean;
};

const fail = (message: string): PromoFail => ({ ok: false, message });

export function normalizeCode(raw: unknown) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .slice(0, 40);
}

function percentOff(subtotal: number, percent: number) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0));
  return Math.round(subtotal * (p / 100));
}

/** Discount (Ks) a campaign gives on this basket. */
export function campaignDiscount(c: Pick<CampaignDoc, 'kind' | 'value' | 'maxDiscount'>, subtotal: number, deliveryFee: number) {
  if (c.kind === 'FREE_DELIVERY') return Math.max(0, Math.round(deliveryFee));
  if (c.kind === 'FLAT') return Math.min(Math.max(0, Math.round(c.value)), Math.round(subtotal));
  const off = percentOff(subtotal, c.value);
  return c.maxDiscount && c.maxDiscount > 0 ? Math.min(off, c.maxDiscount) : off;
}

export function campaignLabel(c: Pick<CampaignDoc, 'kind' | 'value' | 'maxDiscount'>) {
  if (c.kind === 'FREE_DELIVERY') return 'Free delivery';
  if (c.kind === 'FLAT') return `${Math.round(c.value).toLocaleString()} Ks off`;
  return c.maxDiscount ? `${c.value}% off (up to ${c.maxDiscount.toLocaleString()} Ks)` : `${c.value}% off`;
}

async function activeOrderCount(customerId: string) {
  return Order.countDocuments({ customerId, status: { $nin: ['CANCELLED', 'REJECTED'] } });
}

/** Checks a campaign for this customer without using it. */
async function checkCampaign(
  campaign: CampaignDoc | null,
  customerId: string,
  subtotal: number,
  deliveryFee: number
): Promise<PromoQuote> {
  if (!campaign || campaign.active === false) return fail('Invalid promo code');
  const now = Date.now();
  if (campaign.startsAt && new Date(campaign.startsAt).getTime() > now) return fail('This code is not active yet');
  if (campaign.expiresAt && new Date(campaign.expiresAt).getTime() < now) return fail('This code has expired');
  if (campaign.totalLimit && (campaign.usedCount || 0) >= campaign.totalLimit) return fail('This code has been fully used');
  if (campaign.minSubtotal && subtotal < campaign.minSubtotal) {
    return fail(`Spend at least ${campaign.minSubtotal.toLocaleString()} Ks to use this code`);
  }
  const used = await PromoRedemption.countDocuments({ code: campaign.code, customerId });
  if (used >= Math.max(1, campaign.perUserLimit || 1)) return fail('You have already used this code');
  if (campaign.firstOrderOnly && (await activeOrderCount(customerId)) > 0) {
    return fail('This code is for your first order only');
  }
  const discount = campaignDiscount(campaign, subtotal, deliveryFee);
  if (discount <= 0) return fail('This code gives no discount on this order');
  return { ok: true, code: campaign.code, discount, label: campaignLabel(campaign), source: 'CAMPAIGN' };
}

export async function quotePromo(
  customerId: string,
  rawCode: unknown,
  subtotal: number,
  deliveryFee: number
): Promise<PromoQuote> {
  const code = normalizeCode(rawCode);
  if (!code) return fail('Enter a promo code');
  const profile = await CustomerProfile.findOne({ customerId })
    .select('hasPromo promoCode promoDiscountPercent hasStreakReward streakVoucherCode streakDiscountPercent')
    .lean<ProfilePromo>();
  if (profile?.hasPromo && normalizeCode(profile.promoCode) === code && Number(profile.promoDiscountPercent) > 0) {
    const pct = Number(profile.promoDiscountPercent);
    return { ok: true, code, discount: percentOff(subtotal, pct), label: `${pct}% off`, source: 'PERSONAL' };
  }
  if (profile?.hasStreakReward && normalizeCode(profile.streakVoucherCode) === code && Number(profile.streakDiscountPercent) > 0) {
    const pct = Number(profile.streakDiscountPercent);
    return { ok: true, code, discount: percentOff(subtotal, pct), label: `${pct}% off (streak reward)`, source: 'STREAK' };
  }
  const campaign = await PromoCode.findOne({ code }).lean<CampaignDoc>();
  return checkCampaign(campaign, customerId, subtotal, deliveryFee);
}

export type PromoClaim = PromoOk & {
  /** Gives the code back (order could not be saved). */
  release: () => Promise<void>;
  /** Links a campaign use to the saved order. */
  attach: (orderId: string) => Promise<void>;
};

const noop = async () => {};

/** Case-insensitive exact match for a stored code. */
function exactCode(code: string) {
  return new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
}

export async function claimPromo(
  customerId: string,
  rawCode: unknown,
  subtotal: number,
  deliveryFee: number
): Promise<PromoClaim | PromoFail> {
  const quote = await quotePromo(customerId, rawCode, subtotal, deliveryFee);
  if (!quote.ok) return quote;

  if (quote.source === 'PERSONAL') {
    const before = await CustomerProfile.findOneAndUpdate(
      { customerId, hasPromo: true, promoCode: exactCode(quote.code) },
      { $set: { hasPromo: false, promoCode: '', promoDiscountPercent: 0 } }
    ).lean<ProfilePromo>();
    if (!before || normalizeCode(before.promoCode) !== quote.code) return fail('This code was just used');
    return {
      ...quote,
      attach: noop,
      release: async () => {
        await CustomerProfile.updateOne(
          { customerId },
          { $set: { hasPromo: true, promoCode: before.promoCode, promoDiscountPercent: before.promoDiscountPercent } }
        );
      },
    };
  }

  if (quote.source === 'STREAK') {
    const before = await CustomerProfile.findOneAndUpdate(
      { customerId, hasStreakReward: true, streakVoucherCode: exactCode(quote.code) },
      { $set: { hasStreakReward: false, streakVoucherCode: '', streakDiscountPercent: 0 } }
    ).lean<ProfilePromo>();
    if (!before || normalizeCode(before.streakVoucherCode) !== quote.code) return fail('This code was just used');
    return {
      ...quote,
      attach: noop,
      release: async () => {
        await CustomerProfile.updateOne(
          { customerId },
          {
            $set: {
              hasStreakReward: true,
              streakVoucherCode: before.streakVoucherCode,
              streakDiscountPercent: before.streakDiscountPercent,
            },
          }
        );
      },
    };
  }

  // Campaign: take one use from the global limit, then this customer's use slot.
  const taken = await PromoCode.findOneAndUpdate(
    {
      code: quote.code,
      active: true,
      $or: [{ totalLimit: { $in: [0, null] } }, { $expr: { $lt: ['$usedCount', '$totalLimit'] } }],
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );
  if (!taken) return fail('This code has been fully used');
  const giveBackGlobal = () => PromoCode.updateOne({ code: quote.code }, { $inc: { usedCount: -1 } });

  const used = await PromoRedemption.countDocuments({ code: quote.code, customerId });
  const key = `${quote.code}:${customerId}:${used}`;
  try {
    await PromoRedemption.create({ key, code: quote.code, customerId, discount: quote.discount });
  } catch {
    await giveBackGlobal();
    return fail('You have already used this code');
  }
  return {
    ...quote,
    attach: async (orderId: string) => {
      await PromoRedemption.updateOne({ key }, { $set: { orderId } });
    },
    release: async () => {
      await PromoRedemption.deleteOne({ key });
      await giveBackGlobal();
    },
  };
}

/** Demo campaigns created on first use so the feature works out of the box. */
export const DEFAULT_CAMPAIGNS = [
  {
    code: 'WELCOME10',
    description: '10% off your first FoodDash order',
    kind: 'PERCENT',
    value: 10,
    maxDiscount: 3000,
    firstOrderOnly: true,
    perUserLimit: 1,
  },
  {
    code: 'FREEDEL',
    description: 'Free delivery on orders over 15,000 Ks',
    kind: 'FREE_DELIVERY',
    value: 0,
    minSubtotal: 15000,
    perUserLimit: 3,
  },
  {
    code: 'RAINY500',
    description: '500 Ks off — rainy day treat',
    kind: 'FLAT',
    value: 500,
    minSubtotal: 5000,
    perUserLimit: 2,
  },
] as const;

export async function ensureDefaultCampaigns() {
  const count = await PromoCode.estimatedDocumentCount();
  if (count > 0) return;
  await PromoCode.insertMany(DEFAULT_CAMPAIGNS.map((c) => ({ ...c })), { ordered: false }).catch(() => {});
}
