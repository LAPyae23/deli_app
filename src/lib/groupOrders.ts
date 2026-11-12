/** Helpers for group orders: codes, member names and the bill split. */
import { randomInt } from 'crypto';
import CustomerProfile from '@/models/CustomerProfile';
import User from '@/models/User';

export const GROUP_TTL_MS = 3 * 3600_000;
export const MAX_MEMBERS = 12;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newGroupCode() {
  return Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

export async function displayName(customerId: string) {
  const profile = await CustomerProfile.findOne({ customerId }).select('name').lean<{ name?: string }>();
  if (profile?.name) return profile.name.split(/\s+/)[0];
  const user = await User.findById(customerId).select('firstName').lean<{ firstName?: string }>().catch(() => null);
  return user?.firstName || 'Guest';
}

type Member = { customerId: string; name: string; items: Array<{ unitPrice: number; quantity: number }> };

/**
 * Who owes what: each member pays their own food, plus an equal share of
 * delivery, tax and tip, minus an equal share of any discount.
 */
export function splitBill(
  members: Member[],
  totals: { subtotal: number; tax: number; deliveryFee: number; tipAmount: number; discount: number; total: number }
) {
  const paying = members.filter((m) => m.items.length > 0);
  const n = Math.max(1, paying.length);
  const sharedExtra = totals.tax + totals.deliveryFee + totals.tipAmount - totals.discount;
  const shares = paying.map((m) => {
    const food = m.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    return { customerId: m.customerId, name: m.name, food, amount: Math.max(0, Math.round(food + sharedExtra / n)) };
  });
  // Make the shares add up exactly to the total (rounding goes to the first member).
  const diff = totals.total - shares.reduce((s, x) => s + x.amount, 0);
  if (shares[0]) shares[0].amount += diff;
  return shares;
}
