/** Shared order pricing — distance-based delivery + commission splits */

export const TAX_RATE = 0.08;
/** Flat delivery start fee (Ks) */
export const DELIVERY_BASE_FEE_KS = 1000;
/** Extra delivery fee per kilometre (Ks) */
export const DELIVERY_PER_KM_KS = 300;
export const DEFAULT_DISTANCE_KM = 3.5;
export const DEFAULT_RESTAURANT_COMMISSION_RATE = 30;
export const DEFAULT_RIDER_COMMISSION_RATE = 10;

/** Typical fee at DEFAULT_DISTANCE_KM — kept for existing cart callers. */
export const DEFAULT_DELIVERY_FEE_KS =
  DELIVERY_BASE_FEE_KS + DEFAULT_DISTANCE_KM * DELIVERY_PER_KM_KS;

export type OrderPricing = {
  subtotal: number;
  tax: number;
  deliveryFee: number;
  distanceKm: number;
  /** Always 0 — platform fee is no longer charged to the customer. */
  platformFee: number;
  restaurantCommissionRate: number;
  riderCommissionRate: number;
  restaurantCommission: number;
  riderCommission: number;
  platformRevenue: number;
  total: number;
  totalAmount: number;
  riderEarning: number;
  owedAmount: number;
  tipAmount: number;
};

function roundKs(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function clampRate(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

export function taxFromSubtotal(subtotal: number) {
  return roundKs(subtotal * TAX_RATE);
}

/** DeliveryFee = 1000 Ks + (distanceKm × 300 Ks) */
export function deliveryFeeFromDistanceKm(distanceKm: number) {
  const km = Number.isFinite(distanceKm) ? Math.max(0, distanceKm) : DEFAULT_DISTANCE_KM;
  return roundKs(DELIVERY_BASE_FEE_KS + km * DELIVERY_PER_KM_KS);
}

export function riderEarningFromDeliveryFee(
  deliveryFee: number,
  riderCommissionRate = DEFAULT_RIDER_COMMISSION_RATE
) {
  const fee = roundKs(deliveryFee);
  const rate = clampRate(riderCommissionRate, DEFAULT_RIDER_COMMISSION_RATE);
  return Math.max(0, fee - roundKs(fee * (rate / 100)));
}

/**
 * Total = Subtotal + Tax (8% of subtotal) + DeliveryFee
 * DeliveryFee = 1000 + (distanceKm × 300)
 * RiderEarning = DeliveryFee − (DeliveryFee × riderCommissionRate / 100)
 * PlatformRevenue = (Subtotal × restaurantCommissionRate / 100)
 *                 + (DeliveryFee × riderCommissionRate / 100)
 * COD OwedAmount = Total − RiderEarning
 */
export function calculateOrderPricing(input: {
  subtotal: number;
  distanceKm?: number;
  deliveryFee?: number;
  restaurantCommissionRate?: number;
  riderCommissionRate?: number;
  tipAmount?: number;
}): OrderPricing {
  const subtotal = roundKs(input.subtotal);
  const restaurantCommissionRate = clampRate(
    input.restaurantCommissionRate,
    DEFAULT_RESTAURANT_COMMISSION_RATE
  );
  const riderCommissionRate = clampRate(
    input.riderCommissionRate,
    DEFAULT_RIDER_COMMISSION_RATE
  );

  const hasDistance =
    input.distanceKm != null && Number.isFinite(Number(input.distanceKm));
  const distanceKm = hasDistance
    ? Math.max(0, Number(input.distanceKm))
    : DEFAULT_DISTANCE_KM;

  const hasExplicitFee =
    input.deliveryFee != null && Number.isFinite(Number(input.deliveryFee));

  let deliveryFee: number;
  if (hasDistance) {
    deliveryFee = deliveryFeeFromDistanceKm(distanceKm);
  } else if (hasExplicitFee) {
    deliveryFee = roundKs(Number(input.deliveryFee));
  } else {
    deliveryFee = deliveryFeeFromDistanceKm(distanceKm);
  }

  const tax = taxFromSubtotal(subtotal);
  const tipAmount = roundKs(Math.max(0, Number(input.tipAmount) || 0));
  const riderCommission = roundKs(deliveryFee * (riderCommissionRate / 100));
  const riderEarning = Math.max(0, deliveryFee - riderCommission) + tipAmount;
  const restaurantCommission = roundKs(
    subtotal * (restaurantCommissionRate / 100)
  );
  const platformRevenue = restaurantCommission + riderCommission;
  const total = subtotal + tax + deliveryFee + tipAmount;
  const owedAmount = Math.max(0, total - riderEarning);

  return {
    subtotal,
    tax,
    deliveryFee,
    distanceKm: hasDistance || !hasExplicitFee ? distanceKm : DEFAULT_DISTANCE_KM,
    platformFee: 0,
    restaurantCommissionRate,
    riderCommissionRate,
    restaurantCommission,
    riderCommission,
    platformRevenue,
    total,
    totalAmount: total,
    riderEarning,
    owedAmount,
    tipAmount,
  };
}

export function subtotalFromItems(
  items: Array<{ price?: number; unitPrice?: number; quantity?: number }>
) {
  return roundKs(
    items.reduce((sum, item) => {
      const unit = Number(item.unitPrice ?? item.price) || 0;
      const qty = Number(item.quantity) || 1;
      return sum + unit * qty;
    }, 0)
  );
}

function asPercentRate(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return undefined;
  return n;
}

/** Recompute (or fill) pricing from a stored order document. */
export function pricingFromOrder(order: {
  items?: Array<{ price?: number; unitPrice?: number; quantity?: number }>;
  totals?: unknown;
  distanceKm?: unknown;
  baseRiderFee?: unknown;
  tipAmount?: unknown;
}): OrderPricing {
  const totals = (order.totals || {}) as Record<string, unknown>;
  const fromItems = Array.isArray(order.items) ? subtotalFromItems(order.items) : 0;
  const subtotal = roundKs(Number(totals.subtotal) || fromItems);
  const distanceKm = Number(order.distanceKm ?? totals.distanceKm);
  const restaurantCommissionRate = asPercentRate(totals.restaurantCommissionRate);
  const riderCommissionRate = asPercentRate(totals.riderCommissionRate);
  const tipAmount = Number(order.tipAmount ?? totals.tipAmount) || 0;

  return calculateOrderPricing({
    subtotal,
    distanceKm: Number.isFinite(distanceKm) && distanceKm >= 0 ? distanceKm : undefined,
    restaurantCommissionRate,
    riderCommissionRate,
    tipAmount,
  });
}
