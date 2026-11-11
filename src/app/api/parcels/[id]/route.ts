import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Parcel from '@/models/Parcel';
import RiderProfile from '@/models/RiderProfile';
import User from '@/models/User';
import { forbidden, getSession, unauthorized } from '@/lib/auth';
import { toLatLng, travelMinutes } from '@/lib/geo';
import { RIDER_MAX_ACTIVE_PARCELS, isParty, viewFor, type ParcelDoc } from '@/lib/parcels';
import { applyCodWalletDeduction, isRiderBlocked } from '@/lib/riderWallet';
import { sendPush } from '@/lib/push';

type Ctx = { params: Promise<{ id: string }> | { id: string } };

function bad(status: number, message: string) {
  return NextResponse.json({ success: false, message }, { status });
}

async function load(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Parcel.findById(id).lean<ParcelDoc>();
}

export async function GET(request: Request, { params }: Ctx) {
  const session = getSession(request);
  if (!session) return unauthorized();
  await dbConnect();
  const { id } = await Promise.resolve(params);
  const parcel = await load(id);
  if (!parcel) return bad(404, 'Parcel not found');
  if (!isParty(session, parcel)) return forbidden('You do not have access to this parcel');
  return NextResponse.json({ success: true, parcel: viewFor(session, parcel) });
}

/**
 * PATCH /api/parcels/[id]  body: { action, ... }
 *   cancel   — sender, before pickup
 *   accept   — online rider, atomic (only one rider can win)
 *   pickup   — assigned rider: ACCEPTED → PICKED_UP
 *   deliver  — assigned rider: PICKED_UP → DELIVERED, needs the recipient's 4-digit PIN
 *   location — assigned rider: live GPS for tracking + ETA
 * Every state change is a conditional update on the current status.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const session = getSession(request);
  if (!session) return unauthorized();
  await dbConnect();
  const { id } = await Promise.resolve(params);
  const parcel = await load(id);
  if (!parcel) return bad(404, 'Parcel not found');
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '');
  const me = session.userId;
  const now = new Date();

  const done = async (filter: Record<string, unknown>, set: Record<string, unknown>, conflict: string) => {
    const updated = await Parcel.findOneAndUpdate({ _id: id, ...filter }, { $set: set }, { new: true }).lean<ParcelDoc>();
    if (!updated) return bad(409, conflict);
    const text: Record<string, string> = {
      ACCEPTED: `${updated.riderName || 'A rider'} is coming to pick it up.`,
      PICKED_UP: 'Picked up — on the way to the recipient.',
      DELIVERED: 'Delivered. Thank you for using FoodDash Express!',
    };
    if (set.status && text[String(set.status)]) {
      await sendPush([String(updated.senderId), String(updated.recipientId || '')], {
        title: `Parcel ${updated.code}`,
        body: text[String(set.status)],
        url: '/customer-dashboard/parcels',
        tag: `parcel-${updated.code}`,
      });
    }
    return NextResponse.json({ success: true, parcel: viewFor(session, updated) });
  };

  if (action === 'cancel') {
    if (session.role !== 'ADMIN' && !(session.role === 'CUSTOMER' && parcel.senderId === me)) {
      return forbidden('Only the sender can cancel');
    }
    return done(
      { status: { $in: ['REQUESTED', 'ACCEPTED'] } },
      { status: 'CANCELLED', cancelledAt: now, cancelReason: String(body?.reason || 'Cancelled by sender').slice(0, 200) },
      'This parcel has already been picked up and can no longer be cancelled'
    );
  }

  if (session.role !== 'RIDER') return forbidden('Rider action');

  if (action === 'accept') {
    if (parcel.riderId && parcel.riderId !== me) return bad(409, 'Another rider has already taken this parcel');
    const profile = await RiderProfile.findOne({ riderId: me }).select('status name phone riderCoords location').lean<{
      status?: string;
      name?: string;
      phone?: string;
      riderCoords?: unknown;
      location?: unknown;
    }>();
    if (String(profile?.status) !== 'Online') return bad(403, 'Go online to accept parcels');
    if (await isRiderBlocked(me)) return bad(403, 'Rider is blocked due to outstanding COD wallet debt');
    const active = await Parcel.countDocuments({ riderId: me, status: { $in: ['ACCEPTED', 'PICKED_UP'] } });
    if (active >= RIDER_MAX_ACTIVE_PARCELS) {
      return bad(409, `Finish your current parcels first (max ${RIDER_MAX_ACTIVE_PARCELS})`);
    }
    const user = await User.findById(me).select('firstName lastName phone').lean<{ firstName?: string; lastName?: string; phone?: string }>();
    const at = toLatLng(profile?.riderCoords) || toLatLng(profile?.location);
    const pickup = toLatLng(parcel.pickup);
    const dropoff = toLatLng(parcel.dropoff);
    const eta = at && pickup && dropoff ? travelMinutes(at, pickup) + travelMinutes(pickup, dropoff) : undefined;
    return done(
      { status: 'REQUESTED', riderId: '' },
      {
        status: 'ACCEPTED',
        riderId: me,
        riderName: profile?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Rider',
        riderPhone: profile?.phone || user?.phone || '',
        acceptedAt: now,
        ...(at ? { riderCoords: at } : {}),
        ...(eta ? { etaMins: eta } : {}),
      },
      'Another rider has already taken this parcel'
    );
  }

  if (parcel.riderId !== me) return forbidden('This parcel is assigned to another rider');

  if (action === 'pickup') {
    return done({ status: 'ACCEPTED', riderId: me }, { status: 'PICKED_UP', pickedUpAt: now }, 'Parcel is not waiting for pickup');
  }

  if (action === 'deliver') {
    const pin = String(body?.pin || '').trim();
    if (!pin || pin !== parcel.deliveryPin) return bad(400, 'Wrong delivery PIN. Ask the recipient for the 4-digit code.');
    const res = await done(
      { status: 'PICKED_UP', riderId: me },
      { status: 'DELIVERED', deliveredAt: now },
      'Parcel is not out for delivery'
    );
    if (res.status === 200) {
      // Rider collected the cash fare; the platform fee is owed from their wallet.
      const fee = Number((parcel.price as { platformFee?: number } | undefined)?.platformFee) || 0;
      if (fee > 0) await applyCodWalletDeduction(me, fee);
    }
    return res;
  }

  if (action === 'location') {
    const at = toLatLng(body);
    if (!at) return bad(400, 'lat and lng are required');
    const target = parcel.status === 'ACCEPTED' ? toLatLng(parcel.pickup) : toLatLng(parcel.dropoff);
    let eta = target ? travelMinutes(at, target) : undefined;
    if (parcel.status === 'ACCEPTED' && eta != null) {
      const p = toLatLng(parcel.pickup);
      const d = toLatLng(parcel.dropoff);
      if (p && d) eta += travelMinutes(p, d);
    }
    return done(
      { status: { $in: ['ACCEPTED', 'PICKED_UP'] }, riderId: me },
      { riderCoords: at, ...(eta != null ? { etaMins: eta } : {}) },
      'Parcel is not active'
    );
  }

  return bad(400, 'Unknown action');
}
