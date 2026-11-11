/** Who to notify for marketplace events (uses lib/push to deliver). */
import RiderProfile from '@/models/RiderProfile';
import { haversineKm, toLatLng, type LatLng } from '@/lib/geo';
import { sendPush, type PushPayload } from '@/lib/push';

/** The n online, unblocked riders closest to a point. */
export async function nearestOnlineRiders(at: LatLng | null, n = 3): Promise<string[]> {
  const riders = await RiderProfile.find({ status: 'Online', isBlocked: { $ne: true } })
    .select('riderId riderCoords location')
    .lean<Array<{ riderId: string; riderCoords?: unknown; location?: unknown }>>();
  const placed = riders
    .map((r) => ({ id: String(r.riderId), pos: toLatLng(r.riderCoords) || toLatLng(r.location) }))
    .filter((r): r is { id: string; pos: LatLng } => Boolean(r.pos));
  if (!at) return placed.slice(0, n).map((r) => r.id);
  return placed
    .sort((a, b) => haversineKm(a.pos, at) - haversineKm(b.pos, at))
    .slice(0, n)
    .map((r) => r.id);
}

export async function notifyNearestRiders(at: LatLng | null, payload: PushPayload) {
  return sendPush(await nearestOnlineRiders(at), payload);
}
