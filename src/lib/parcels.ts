import type { Session } from '@/lib/auth';
import { haversineKm, toLatLng, type LatLng } from '@/lib/geo';

/** Same fairness rule as food orders: nearest 3 riders first, everyone after 45 s. */
export const PARCEL_NEAREST_RIDERS = 3;
export const PARCEL_EXCLUSIVE_SECONDS = 45;
export const RIDER_MAX_ACTIVE_PARCELS = 2;

export type ParcelDoc = Record<string, unknown> & {
  _id: unknown;
  senderId: string;
  recipientId?: string;
  riderId?: string;
  status: string;
  deliveryPin?: string;
  pickup?: { lat: number; lng: number };
};

export function isParty(session: Session, p: ParcelDoc) {
  if (session.role === 'ADMIN') return true;
  if (session.role === 'CUSTOMER') {
    const stops = (Array.isArray(p.extraStops) ? p.extraStops : []) as Array<{ recipientId?: string }>;
    return p.senderId === session.userId || p.recipientId === session.userId || stops.some((s) => s.recipientId === session.userId);
  }
  if (session.role === 'RIDER') return p.riderId === session.userId || (!p.riderId && p.status === 'REQUESTED');
  return false;
}

/** Strip what a viewer must not see (riders never see the delivery PIN). */
export function viewFor(session: Session, p: ParcelDoc) {
  const out: Record<string, unknown> = { ...p, _id: String(p._id) };
  if (session.role === 'RIDER') {
    delete out.deliveryPin;
    if (Array.isArray(p.extraStops)) {
      out.extraStops = (p.extraStops as Array<Record<string, unknown>>).map(({ deliveryPin: _pin, ...rest }) => rest);
    }
  }
  // An extra-stop recipient only sees their own PIN.
  if (session.role === 'CUSTOMER' && p.senderId !== session.userId && Array.isArray(p.extraStops)) {
    out.extraStops = (p.extraStops as Array<Record<string, unknown>>).map((s) =>
      s.recipientId === session.userId ? s : (({ deliveryPin: _pin, ...rest }) => rest)(s)
    );
    if (p.recipientId !== session.userId) delete out.deliveryPin;
  }
  if (session.role === 'RIDER' && p.status === 'REQUESTED') {
    // Before accepting, a rider sees areas and fare, not phone numbers.
    delete out.senderPhone;
    delete out.recipientPhone;
  }
  return out;
}

/** Rank the open pool for one rider: nearest-first priority + oldest first. */
export function rankPoolForRider(
  riderId: string,
  me: LatLng | null,
  parcels: ParcelDoc[],
  online: Array<{ id: string; at: LatLng }>,
  now = Date.now()
) {
  return parcels
    .map((p) => {
      const pickup = toLatLng(p.pickup);
      const pickupDistanceKm = me && pickup ? haversineKm(me, pickup) : null;
      const rank =
        pickup && pickupDistanceKm != null
          ? online.filter((o) => o.id !== riderId && haversineKm(o.at, pickup) < pickupDistanceKm).length
          : 0;
      const waited = (now - new Date(String(p.createdAt)).getTime()) / 1000;
      const visible = pickupDistanceKm == null || rank < PARCEL_NEAREST_RIDERS || waited >= PARCEL_EXCLUSIVE_SECONDS;
      return visible
        ? { ...p, pickupDistanceKm: pickupDistanceKm == null ? null : Number(pickupDistanceKm.toFixed(2)) }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export function newParcelCode() {
  const n = Math.floor(Math.random() * 36 ** 6).toString(36).toUpperCase().padStart(6, '0');
  return `PX-${n}`;
}

export function newDeliveryPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Myanmar phone numbers: keep digits, normalise +959 / 959 to 09. */
export function normalizePhone(raw: unknown) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('959')) return `0${digits.slice(2)}`;
  return digits;
}
