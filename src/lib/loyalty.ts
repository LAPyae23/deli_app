/** Loyalty points: earn on delivered orders, spend as a discount at checkout. */

/** 1 point for every 1,000 Ks of food (subtotal) on a delivered order. */
export const KS_PER_POINT_EARNED = 1000;
/** Each point is worth 20 Ks off. */
export const KS_PER_POINT_VALUE = 20;
/** Smallest number of points that can be spent at once. */
export const MIN_POINTS_REDEEM = 50;
/** Points can cover at most this share of the food subtotal. */
export const MAX_POINTS_SHARE = 0.3;

export function pointsEarnedFor(subtotal: number) {
  return Math.max(0, Math.floor((Number(subtotal) || 0) / KS_PER_POINT_EARNED));
}

/** How many points to spend (and their value) for a balance and an order subtotal. */
export function pointsRedemption(balance: number, subtotalAfterPromo: number) {
  const have = Math.max(0, Math.floor(Number(balance) || 0));
  const cap = Math.floor((Math.max(0, subtotalAfterPromo) * MAX_POINTS_SHARE) / KS_PER_POINT_VALUE);
  const points = Math.min(have, cap);
  if (points < MIN_POINTS_REDEEM) return { points: 0, value: 0 };
  return { points, value: points * KS_PER_POINT_VALUE };
}
