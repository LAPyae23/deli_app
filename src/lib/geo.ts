export type LatLng = { lat: number; lng: number };

/** Straight-line distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function toLatLng(value: unknown): LatLng | null {
  const v = (value || {}) as { lat?: unknown; lng?: unknown };
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Yangon streets are not straight lines: road distance ≈ 1.3 × straight-line. */
export const ROAD_FACTOR = 1.3;
/** ~20 km/h average motorbike speed in Yangon traffic = 3 min per road km. */
export const MINUTES_PER_ROAD_KM = 3;
/** Parking, pickup and handover time. */
export const HANDLING_MINUTES = 4;

/** Estimated riding minutes between two points. */
export function travelMinutes(from: LatLng, to: LatLng): number {
  const roadKm = haversineKm(from, to) * ROAD_FACTOR;
  return Math.max(3, Math.round(HANDLING_MINUTES + roadKm * MINUTES_PER_ROAD_KM));
}
