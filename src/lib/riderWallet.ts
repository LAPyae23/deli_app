import mongoose from 'mongoose';
import User from '@/models/User';
import RiderProfile from '@/models/RiderProfile';

/** Riders at or below this COD float are auto-blocked from new dispatches */
export const WALLET_BLOCK_THRESHOLD = -50_000;

export function isCodPayment(method?: unknown): boolean {
  const normalized = String(method || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  return (
    normalized === 'cash' ||
    normalized === 'cod' ||
    normalized === 'cashondelivery' ||
    normalized.includes('cod')
  );
}

export function resolveOrderTotal(order: {
  totals?: unknown;
  totalAmount?: unknown;
}): number {
  const totals = (order.totals || {}) as Record<string, unknown>;
  for (const key of ['total', 'totalAmount', 'grandTotal']) {
    const n = Number(totals[key]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const fallback = Number(order.totalAmount);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
}

export async function isRiderBlocked(riderId: string): Promise<boolean> {
  if (!riderId) return true;
  const [profile, user] = await Promise.all([
    RiderProfile.findOne({ riderId }).select('isBlocked').lean(),
    mongoose.Types.ObjectId.isValid(riderId)
      ? User.findById(riderId).select('isBlocked role').lean()
      : Promise.resolve(null),
  ]);
  if (profile?.isBlocked === true) return true;
  if (user && String(user.role) === 'RIDER' && user.isBlocked === true) return true;
  return false;
}

/**
 * Deduct a COD collection from the rider wallet and auto-block at -50,000 MMK.
 * Updates both RiderProfile and the RIDER User document.
 */
export async function applyCodWalletDeduction(riderId: string, amount: number) {
  if (!riderId || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const deduction = { $inc: { walletBalance: -amount } };

  const [profile, user] = await Promise.all([
    RiderProfile.findOneAndUpdate({ riderId }, deduction, { new: true }),
    mongoose.Types.ObjectId.isValid(riderId)
      ? User.findOneAndUpdate({ _id: riderId, role: 'RIDER' }, deduction, { new: true })
      : Promise.resolve(null),
  ]);

  const walletBalance = Number(profile?.walletBalance ?? user?.walletBalance ?? 0);
  const isBlocked = walletBalance <= WALLET_BLOCK_THRESHOLD;

  if (isBlocked) {
    await Promise.all([
      RiderProfile.updateOne({ riderId }, { $set: { isBlocked: true } }),
      mongoose.Types.ObjectId.isValid(riderId)
        ? User.updateOne({ _id: riderId, role: 'RIDER' }, { $set: { isBlocked: true } })
        : Promise.resolve(),
    ]);
  }

  return { walletBalance, isBlocked, deducted: amount };
}

/**
 * Credit a rider remittance (KBZPay / WavePay deposit to the company).
 * Unblocks automatically when walletBalance rises above -50,000 MMK.
 */
export async function applyRemittance(riderId: string, amount: number) {
  if (!riderId || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const credit = { $inc: { walletBalance: amount } };

  const [profile, user] = await Promise.all([
    RiderProfile.findOneAndUpdate({ riderId }, credit, { new: true }),
    mongoose.Types.ObjectId.isValid(riderId)
      ? User.findOneAndUpdate({ _id: riderId, role: 'RIDER' }, credit, { new: true })
      : Promise.resolve(null),
  ]);

  if (!profile && !user) return null;

  const walletBalance = Number(profile?.walletBalance ?? user?.walletBalance ?? 0);
  const isBlocked = !(walletBalance > WALLET_BLOCK_THRESHOLD);

  await Promise.all([
    RiderProfile.updateOne({ riderId }, { $set: { isBlocked } }),
    mongoose.Types.ObjectId.isValid(riderId)
      ? User.updateOne({ _id: riderId, role: 'RIDER' }, { $set: { isBlocked } })
      : Promise.resolve(),
  ]);

  return { walletBalance, isBlocked, credited: amount };
}
