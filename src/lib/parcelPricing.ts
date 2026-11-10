import { ROAD_FACTOR, haversineKm, travelMinutes, type LatLng } from '@/lib/geo';

export const PARCEL_SIZES = {
  SMALL: { label: 'Small', hint: 'Documents, phone, keys (up to 3 kg)', fee: 0 },
  MEDIUM: { label: 'Medium', hint: 'Shoebox, food container (up to 8 kg)', fee: 700 },
  LARGE: { label: 'Large', hint: 'Bag or box that fits on a motorbike (up to 20 kg)', fee: 1500 },
} as const;
export type ParcelSize = keyof typeof PARCEL_SIZES;

export const PARCEL_BASE_FEE = 1500;
export const PARCEL_PER_KM = 300;
export const PARCEL_MAX_ROAD_KM = 25;
/** Rider keeps 85% of the fare; 15% is the platform fee. */
export const PARCEL_RIDER_SHARE = 0.85;

const round100 = (n: number) => Math.round(n / 100) * 100;

export type ParcelQuote = {
  roadKm: number;
  baseFee: number;
  distanceFee: number;
  sizeFee: number;
  total: number;
  riderEarning: number;
  platformFee: number;
  etaMins: number;
};

/**
 * Fare = 1,500 Ks + 300 Ks per road km + size surcharge, rounded to 100 Ks.
 * Road km ≈ straight-line km × 1.3 (Yangon streets).
 */
export function quoteParcel(pickup: LatLng, dropoff: LatLng, size: ParcelSize): ParcelQuote {
  const roadKm = Math.round(haversineKm(pickup, dropoff) * ROAD_FACTOR * 10) / 10;
  const distanceFee = round100(roadKm * PARCEL_PER_KM);
  const sizeFee = PARCEL_SIZES[size].fee;
  const total = PARCEL_BASE_FEE + distanceFee + sizeFee;
  const riderEarning = round100(total * PARCEL_RIDER_SHARE);
  return {
    roadKm,
    baseFee: PARCEL_BASE_FEE,
    distanceFee,
    sizeFee,
    total,
    riderEarning,
    platformFee: total - riderEarning,
    etaMins: travelMinutes(pickup, dropoff),
  };
}

export function isParcelSize(v: unknown): v is ParcelSize {
  return typeof v === 'string' && v in PARCEL_SIZES;
}
