import { NextResponse } from 'next/server';
import { getSession, unauthorized } from '@/lib/auth';
import { toLatLng } from '@/lib/geo';
import { PARCEL_MAX_EXTRA_STOPS, PARCEL_MAX_ROAD_KM, isParcelSize, quoteParcelRoute } from '@/lib/parcelPricing';

/** POST /api/parcels/quote — fare for a pickup, drop-off and size (no booking). */
export async function POST(request: Request) {
  if (!getSession(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const pickup = toLatLng(body?.pickup);
  const dropoff = toLatLng(body?.dropoff);
  const size = isParcelSize(body?.size) ? body.size : 'SMALL';
  if (!pickup || !dropoff) {
    return NextResponse.json({ success: false, message: 'Choose both pickup and drop-off on the map' }, { status: 400 });
  }
  const extras = (Array.isArray(body?.extraStops) ? body.extraStops : [])
    .slice(0, PARCEL_MAX_EXTRA_STOPS)
    .map((s: unknown) => toLatLng(s))
    .filter(Boolean) as Array<{ lat: number; lng: number }>;
  const quote = quoteParcelRoute(pickup, [dropoff, ...extras], size);
  if (quote.roadKm > PARCEL_MAX_ROAD_KM) {
    return NextResponse.json(
      { success: false, message: `Too far: about ${quote.roadKm} km by road (max ${PARCEL_MAX_ROAD_KM} km)`, quote },
      { status: 400 }
    );
  }
  return NextResponse.json({ success: true, quote });
}
