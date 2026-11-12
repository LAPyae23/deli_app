import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Parcel from '@/models/Parcel';
import User from '@/models/User';
import RiderProfile from '@/models/RiderProfile';
import { forbidden, getSession, unauthorized } from '@/lib/auth';
import { toLatLng, type LatLng } from '@/lib/geo';
import { PARCEL_MAX_EXTRA_STOPS, PARCEL_MAX_ROAD_KM, isParcelSize, quoteParcelRoute } from '@/lib/parcelPricing';
import {
  newDeliveryPin,
  newParcelCode,
  normalizePhone,
  rankPoolForRider,
  viewFor,
  type ParcelDoc,
} from '@/lib/parcels';
import { isRiderBlocked } from '@/lib/riderWallet';
import { notifyNearestRiders } from '@/lib/notify';

const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);

/**
 * GET /api/parcels
 * - customer: { sent, incoming } (incoming = recipient phone matches their account)
 * - rider: `?pool=1&lat&lng` → open requests (nearest-first), else their own parcels
 * - admin: latest 50
 */
export async function GET(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  await dbConnect();
  const { searchParams } = new URL(request.url);

  if (session.role === 'CUSTOMER') {
    const [sent, incoming] = await Promise.all([
      Parcel.find({ senderId: session.userId }).sort({ createdAt: -1 }).limit(30).lean<ParcelDoc[]>(),
      Parcel.find({ recipientId: session.userId, senderId: { $ne: session.userId } })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean<ParcelDoc[]>(),
    ]);
    return NextResponse.json({
      success: true,
      sent: sent.map((p) => viewFor(session, p)),
      incoming: incoming.map((p) => viewFor(session, p)),
    });
  }

  if (session.role === 'RIDER') {
    if (searchParams.get('pool') === '1') {
      const reported = toLatLng({ lat: searchParams.get('lat'), lng: searchParams.get('lng') });
      if (reported) {
        await RiderProfile.updateOne({ riderId: session.userId }, { $set: { riderCoords: reported, location: reported } });
      }
      const profile = await RiderProfile.findOne({ riderId: session.userId }).select('status riderCoords location').lean<{
        status?: string;
        riderCoords?: unknown;
        location?: unknown;
      }>();
      if (String(profile?.status) !== 'Online' || (await isRiderBlocked(session.userId))) {
        return NextResponse.json({ success: true, parcels: [], online: false });
      }
      const [open, online] = await Promise.all([
        Parcel.find({ status: 'REQUESTED', riderId: '' }).sort({ createdAt: 1 }).limit(30).lean<ParcelDoc[]>(),
        RiderProfile.find({ status: 'Online', isBlocked: { $ne: true } })
          .select('riderId riderCoords location')
          .lean<Array<{ riderId: string; riderCoords?: unknown; location?: unknown }>>(),
      ]);
      const positions = online
        .map((r) => ({ id: String(r.riderId), at: toLatLng(r.riderCoords) || toLatLng(r.location) }))
        .filter((r): r is { id: string; at: LatLng } => Boolean(r.at));
      const me = reported || toLatLng(profile?.riderCoords) || toLatLng(profile?.location);
      const ranked = rankPoolForRider(session.userId, me, open, positions);
      return NextResponse.json({ success: true, online: true, parcels: ranked.map((p) => viewFor(session, p as ParcelDoc)) });
    }
    const mine = await Parcel.find({ riderId: session.userId }).sort({ updatedAt: -1 }).limit(30).lean<ParcelDoc[]>();
    return NextResponse.json({ success: true, parcels: mine.map((p) => viewFor(session, p)) });
  }

  if (session.role === 'ADMIN') {
    const all = await Parcel.find().sort({ createdAt: -1 }).limit(50).lean<ParcelDoc[]>();
    return NextResponse.json({ success: true, parcels: all.map((p) => viewFor(session, p)) });
  }
  return forbidden();
}

/** POST /api/parcels — a customer books a parcel delivery. Fare is computed here. */
export async function POST(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  if (session.role !== 'CUSTOMER') return forbidden('Only customer accounts can send parcels');
  await dbConnect();

  const body = await request.json().catch(() => ({}));
  const pickupAt = toLatLng(body?.pickup);
  const dropoffAt = toLatLng(body?.dropoff);
  const pickupAddress = clean(body?.pickup?.address, 300);
  const dropoffAddress = clean(body?.dropoff?.address, 300);
  const recipientName = clean(body?.recipientName, 80);
  const recipientPhone = normalizePhone(body?.recipientPhone);
  const size = isParcelSize(body?.size) ? body.size : 'SMALL';
  const payer = body?.payer === 'RECIPIENT' ? 'RECIPIENT' : 'SENDER';

  if (!pickupAt || !dropoffAt || !pickupAddress || !dropoffAddress) {
    return NextResponse.json({ success: false, message: 'Pickup and drop-off addresses are required' }, { status: 400 });
  }
  if (!recipientName || recipientPhone.length < 7 || recipientPhone.length > 13) {
    return NextResponse.json({ success: false, message: "Enter the recipient's name and a valid phone number" }, { status: 400 });
  }

  // Optional extra drop-offs (multi-stop), each with its own recipient and PIN.
  const rawExtras = Array.isArray(body?.extraStops) ? body.extraStops.slice(0, PARCEL_MAX_EXTRA_STOPS) : [];
  const extraStops: Array<Record<string, unknown>> = [];
  for (const raw of rawExtras) {
    const at = toLatLng(raw);
    const address = clean(raw?.address, 300);
    const name = clean(raw?.recipientName, 80);
    const phone = normalizePhone(raw?.recipientPhone);
    if (!at || !address || !name || phone.length < 7 || phone.length > 13) {
      return NextResponse.json(
        { success: false, message: 'Each extra stop needs an address on the map, a name and a phone number' },
        { status: 400 }
      );
    }
    extraStops.push({ address, detail: clean(raw?.detail), ...at, recipientName: name, recipientPhone: phone, deliveryPin: newDeliveryPin() });
  }
  const quote = quoteParcelRoute(
    pickupAt,
    [dropoffAt, ...extraStops.map((s) => ({ lat: Number(s.lat), lng: Number(s.lng) }))],
    size
  );
  if (quote.roadKm > PARCEL_MAX_ROAD_KM) {
    return NextResponse.json({ success: false, message: `Too far (max ${PARCEL_MAX_ROAD_KM} km by road)` }, { status: 400 });
  }
  if (quote.legsKm.some((km) => km < 0.2)) {
    return NextResponse.json({ success: false, message: 'Pickup and drop-off are the same place' }, { status: 400 });
  }

  const active = await Parcel.countDocuments({ senderId: session.userId, status: { $in: ['REQUESTED', 'ACCEPTED', 'PICKED_UP'] } });
  if (active >= 5) {
    return NextResponse.json({ success: false, message: 'You already have 5 parcels in progress' }, { status: 429 });
  }

  const sender = await User.findById(session.userId).select('firstName lastName phone').lean<{
    firstName?: string;
    lastName?: string;
    phone?: string;
  }>();
  // If the recipient is also a FoodDash customer, the parcel shows in their app too.
  const local = recipientPhone.replace(/^0/, '');
  const recipient = await User.findOne({
    role: 'CUSTOMER',
    phone: { $in: [recipientPhone, local, `95${local}`, `+95${local}`, `+95 ${local}`] },
  })
    .select('_id')
    .lean<{ _id: unknown }>();
  // Link extra-stop recipients who have FoodDash accounts.
  for (const stop of extraStops) {
    const ph = String(stop.recipientPhone);
    const l = ph.replace(/^0/, '');
    const u = await User.findOne({ role: 'CUSTOMER', phone: { $in: [ph, l, `95${l}`, `+95${l}`, `+95 ${l}`] } })
      .select('_id')
      .lean<{ _id: unknown }>();
    if (u) stop.recipientId = String(u._id);
  }

  let parcel = null;
  for (let attempt = 0; attempt < 3 && !parcel; attempt++) {
    try {
      parcel = await Parcel.create({
        code: newParcelCode(),
        senderId: session.userId,
        senderName: `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim(),
        senderPhone: normalizePhone(sender?.phone),
        pickup: { address: pickupAddress, detail: clean(body?.pickup?.detail), ...pickupAt },
        dropoff: { address: dropoffAddress, detail: clean(body?.dropoff?.detail), ...dropoffAt },
        recipientName,
        recipientPhone,
        recipientId: recipient ? String(recipient._id) : undefined,
        size,
        description: clean(body?.description, 200),
        notes: clean(body?.notes, 300),
        payer,
        price: {
          roadKm: quote.roadKm,
          baseFee: quote.baseFee,
          distanceFee: quote.distanceFee,
          sizeFee: quote.sizeFee + quote.stopFee,
          total: quote.total,
          riderEarning: quote.riderEarning,
          platformFee: quote.platformFee,
        },
        etaMins: quote.etaMins,
        deliveryPin: newDeliveryPin(),
        extraStops,
      });
    } catch (error) {
      // Retry only on a duplicate parcel code.
      if ((error as { code?: number })?.code !== 11000) throw error;
    }
  }
  if (!parcel) {
    return NextResponse.json({ success: false, message: 'Could not create parcel, try again' }, { status: 500 });
  }
  await notifyNearestRiders(pickupAt, {
    title: 'New parcel near you',
    body: `${quote.roadKm} km trip${extraStops.length ? ` · ${extraStops.length + 1} stops` : ''} · earn ${quote.riderEarning.toLocaleString()} Ks`,
    url: '/rider-fleet-dashboard',
    tag: `parcel-${parcel.code}`,
  });
  return NextResponse.json({ success: true, parcel: viewFor(session, parcel.toObject() as ParcelDoc) });
}
