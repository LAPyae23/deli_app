import { beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import RiderProfile from '@/models/RiderProfile';
import { POST as createParcel, GET as listParcels } from '@/app/api/parcels/route';
import { PATCH as patchParcel } from '@/app/api/parcels/[id]/route';
import { POST as upload } from '@/app/api/upload/route';
import { middleware } from '@/middleware';
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { params, req } from '../helpers';

const id = () => new mongoose.Types.ObjectId().toString();
const sender = { id: id(), role: 'CUSTOMER' as const };
const recipient = { id: id(), role: 'CUSTOMER' as const };
const riders = [id(), id(), id()].map((r) => ({ id: r, role: 'RIDER' as const }));
const pickup = { address: 'Sule Pagoda', lat: 16.7745, lng: 96.1588 };
const dropoff = { address: 'Hledan', lat: 16.824, lng: 96.129 };

beforeAll(async () => {
  await dbConnect();
  await User.insertMany([
    { _id: sender.id, firstName: 'S', lastName: 'S', email: 'sender@t.test', phone: '09111111111', password: 'x', role: 'CUSTOMER' },
    { _id: recipient.id, firstName: 'R', lastName: 'R', email: 'recipient@t.test', phone: '+959222222222', password: 'x', role: 'CUSTOMER' },
    ...riders.map((r, i) => ({ _id: r.id, firstName: 'Rider', lastName: String(i), email: `rider${i}@t.test`, phone: `0933333333${i}`, password: 'x', role: 'RIDER' })),
  ]);
  for (const [i, r] of riders.entries()) {
    const at = { lat: pickup.lat + (i + 1) * 0.003, lng: pickup.lng };
    await RiderProfile.create({ riderId: r.id, status: 'Online', walletBalance: 0, riderCoords: at, location: at });
  }
});

describe('parcels', () => {
  it('full flow: book → one rider wins → PIN delivery → wallet fee', async () => {
    const created = await createParcel(
      req('/api/parcels', { method: 'POST', user: sender, body: { pickup, dropoff, size: 'MEDIUM', recipientName: 'Friend', recipientPhone: '09222222222' } })
    );
    expect(created.status).toBe(200);
    const parcel = (await created.json()).parcel;
    expect(parcel.deliveryPin).toMatch(/^\d{4}$/);

    const incoming = await (await listParcels(req('/api/parcels', { user: recipient }))).json();
    expect(incoming.incoming.some((p: { _id: string }) => p._id === parcel._id)).toBe(true);

    const pool = await (await listParcels(req('/api/parcels?pool=1', { user: riders[0] }))).json();
    const seen = pool.parcels.find((p: { _id: string }) => p._id === parcel._id);
    expect(seen).toBeTruthy();
    expect(seen.deliveryPin).toBeUndefined();
    expect(seen.recipientPhone).toBeUndefined();

    const act = (user: { id: string; role: any }, body: unknown) =>
      patchParcel(req(`/api/parcels/${parcel._id}`, { method: 'PATCH', user, body }), params(parcel._id));
    const results = await Promise.all(riders.map((r) => act(r, { action: 'accept' })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const winner = riders[results.findIndex((r) => r.status === 200)];

    expect((await act(winner, { action: 'deliver', pin: parcel.deliveryPin })).status).toBe(409);
    expect((await act(winner, { action: 'pickup' })).status).toBe(200);
    expect((await act(sender, { action: 'cancel' })).status).toBe(409);
    const wrong = parcel.deliveryPin === '1111' ? '2222' : '1111';
    expect((await act(winner, { action: 'deliver', pin: wrong })).status).toBe(400);
    expect((await act(winner, { action: 'deliver', pin: parcel.deliveryPin })).status).toBe(200);

    const wallet = await RiderProfile.findOne({ riderId: winner.id }).lean<{ walletBalance: number }>();
    expect(wallet!.walletBalance).toBe(-parcel.price.platformFee);
  });

  it('refuses too-far trips and bad phone numbers', async () => {
    const far = await createParcel(req('/api/parcels', { method: 'POST', user: sender, body: { pickup, dropoff: { address: 'Far', lat: 17.6, lng: 96.5 }, recipientName: 'X', recipientPhone: '09123456789' } }));
    expect(far.status).toBe(400);
    const phone = await createParcel(req('/api/parcels', { method: 'POST', user: sender, body: { pickup, dropoff, recipientName: 'X', recipientPhone: '12' } }));
    expect(phone.status).toBe(400);
  });
});

describe('middleware', () => {
  const call = async (path: string, token?: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (token) headers.set('cookie', `${SESSION_COOKIE}=${token}`);
    const res = await middleware(new NextRequest(`http://localhost${path}`, { ...init, headers }));
    return res.status;
  };

  it('blocks APIs without a session and by role', async () => {
    const customerToken = await createSessionToken({ userId: sender.id, role: 'CUSTOMER' });
    expect(await call('/api/admin/stats')).toBe(401);
    expect(await call('/api/admin/stats', customerToken)).toBe(403);
    expect(await call(`/api/orders?customerId=${recipient.id}`, customerToken)).toBe(403);
    expect(await call('/api/restaurants')).toBe(200);
    expect(await call('/api/admin/stats', customerToken.slice(0, -3) + 'abc')).toBe(401);
  });

  it('ignores spoofed auth headers', async () => {
    expect(await call('/api/admin/stats', undefined, { headers: { 'x-auth-user-id': 'x', 'x-auth-role': 'ADMIN' } })).toBe(401);
  });

  it('redirects dashboards for the wrong role', async () => {
    const riderToken = await createSessionToken({ userId: riders[0].id, role: 'RIDER' });
    expect(await call('/customer-dashboard', riderToken)).toBe(307);
  });
});

describe('uploads and rate limits', () => {
  const send = (bytes: Uint8Array, user?: { id: string; role: any }) => {
    const form = new FormData();
    form.append('file', new Blob([bytes]), 'x.png');
    const headers = new Headers();
    if (user) {
      headers.set('x-auth-user-id', user.id);
      headers.set('x-auth-role', user.role);
    }
    return upload(new Request('http://localhost/api/upload', { method: 'POST', headers, body: form }));
  };

  it('accepts real images only', async () => {
    const png = Uint8Array.from(Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex'));
    expect((await send(png, sender)).status).toBe(200);
    expect((await send(new TextEncoder().encode('<svg><script>alert(1)</script></svg>'), sender)).status).toBe(415);
    expect((await send(png)).status).toBe(401);
  });

  it('rate limiter allows N hits per window', async () => {
    const key = `test:${id()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await rateLimit(key, 3, 60_000)).allowed);
    expect(results).toEqual([true, true, true, false]);
  });
});
