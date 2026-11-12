import { beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import MenuItem from '@/models/MenuItem';
import RestaurantProfile from '@/models/RestaurantProfile';
import RiderProfile from '@/models/RiderProfile';
import CustomerProfile from '@/models/CustomerProfile';
import Order from '@/models/Order';
import { POST as placeOrder } from '@/app/api/orders/route';
import { PATCH as patchOrder } from '@/app/api/orders/[id]/route';
import { POST as quote } from '@/app/api/customer/checkout-quote/route';
import { POST as createGroup } from '@/app/api/group-orders/route';
import { GET as getGroup, PATCH as patchGroup } from '@/app/api/group-orders/[code]/route';
import { POST as placeGroup } from '@/app/api/group-orders/[code]/place/route';
import { POST as voice } from '@/app/api/voice-order/route';
import { POST as createParcel } from '@/app/api/parcels/route';
import { PATCH as patchParcel } from '@/app/api/parcels/[id]/route';
import { params, req } from '../helpers';

const id = () => new mongoose.Types.ObjectId().toString();
const alice = { id: id(), role: 'CUSTOMER' as const };
const bob = { id: id(), role: 'CUSTOMER' as const };
const shop = { id: id(), role: 'RESTAURANT' as const };
const rider = { id: id(), role: 'RIDER' as const };
const pickup = { lat: 16.8, lng: 96.15 };
const address = { address: 'Test Street', lat: 16.82, lng: 96.15 };
let noodleId = '';
let coffeeId = '';

beforeAll(async () => {
  await dbConnect();
  await User.insertMany([
    { _id: alice.id, firstName: 'Alice', lastName: 'A', email: 'alice@f.test', phone: '09444444441', password: 'x', role: 'CUSTOMER' },
    { _id: bob.id, firstName: 'Bob', lastName: 'B', email: 'bob@f.test', phone: '09444444442', password: 'x', role: 'CUSTOMER' },
    { _id: shop.id, firstName: 'Shop', lastName: 'S', email: 'shop@f.test', phone: '09444444443', password: 'x', role: 'RESTAURANT' },
    { _id: rider.id, firstName: 'Rider', lastName: 'R', email: 'rider@f.test', phone: '09444444444', password: 'x', role: 'RIDER' },
  ]);
  await RestaurantProfile.create({
    restaurantId: shop.id,
    restaurantName: 'Feature Kitchen',
    storeStatus: 'OPEN',
    openingTime: '00:00',
    closingTime: '23:59',
    location: pickup,
  });
  noodleId = String((await MenuItem.create({ restaurantId: shop.id, name: 'Shan Noodles', category: 'Burmese', price: 5000, stockQuantity: 100 }))._id);
  coffeeId = String((await MenuItem.create({ restaurantId: shop.id, name: 'Coffee', category: 'Drinks', price: 2000, stockQuantity: 100 }))._id);
  await RiderProfile.create({ riderId: rider.id, status: 'Online', riderCoords: pickup, location: pickup });
});

const order = async (user: typeof alice, body: Record<string, unknown> = {}) => {
  const res = await placeOrder(
    req('/api/orders', { method: 'POST', user, body: { items: [{ id: noodleId, quantity: 2 }], deliveryAddress: address, ...body } })
  );
  return { status: res.status, json: await res.json() };
};

const deliver = async (orderId: string) => {
  const call = (user: { id: string; role: any }, body: unknown) =>
    patchOrder(req(`/api/orders/${orderId}`, { method: 'PATCH', user, body }), params(orderId));
  expect((await call(shop, { status: 'PREPARING' })).status).toBe(200);
  expect((await call(rider, { riderId: rider.id, status: 'OUT_FOR_DELIVERY' })).status).toBe(200);
  expect((await call(rider, { status: 'DELIVERED' })).status).toBe(200);
};

describe('promo campaigns at checkout', () => {
  it('WELCOME10 works on the first order only', async () => {
    const preview = await (await quote(req('/api/customer/checkout-quote', { method: 'POST', user: alice, body: { subtotal: 10000, deliveryFee: 2000, promoCode: 'welcome10' } }))).json();
    expect(preview.promo).toMatchObject({ ok: true, discount: 1000, source: 'CAMPAIGN' });

    const first = await order(alice, { promoCodeUsed: 'WELCOME10' });
    expect(first.status).toBe(200);
    expect(first.json.totals.discount).toBe(1000);

    const again = await order(alice, { promoCodeUsed: 'WELCOME10' });
    expect(again.status).toBe(400);
  });

  it('FREEDEL removes the delivery fee above the minimum', async () => {
    const small = await order(bob, { promoCodeUsed: 'FREEDEL', items: [{ id: coffeeId, quantity: 1 }] });
    expect(small.status).toBe(400);
    const big = await order(bob, { promoCodeUsed: 'FREEDEL', items: [{ id: noodleId, quantity: 4 }] });
    expect(big.status).toBe(200);
    expect(big.json.totals.discount).toBe(big.json.totals.deliveryFee);
  });
});

describe('loyalty points', () => {
  it('earns points on delivery, spends them, refunds on cancel', async () => {
    const placed = await order(alice, { items: [{ id: noodleId, quantity: 10 }] }); // 50,000 Ks food
    await deliver(placed.json.orderId);
    const after = await CustomerProfile.findOne({ customerId: alice.id }).lean<{ loyaltyPoints: number }>();
    expect(after!.loyaltyPoints).toBeGreaterThanOrEqual(50);

    const before = after!.loyaltyPoints;
    const spend = await order(alice, { usePoints: true, items: [{ id: noodleId, quantity: 4 }] });
    expect(spend.status).toBe(200);
    expect(spend.json.totals.pointsRedeemed).toBeGreaterThan(0);
    const mid = await CustomerProfile.findOne({ customerId: alice.id }).lean<{ loyaltyPoints: number }>();
    expect(mid!.loyaltyPoints).toBe(before - spend.json.totals.pointsRedeemed);

    const cancel = await patchOrder(
      req(`/api/orders/${spend.json.orderId}`, { method: 'PATCH', user: alice, body: { status: 'CANCELLED' } }),
      params(spend.json.orderId)
    );
    expect(cancel.status).toBe(200);
    const end = await CustomerProfile.findOne({ customerId: alice.id }).lean<{ loyaltyPoints: number }>();
    expect(end!.loyaltyPoints).toBe(before);
  });
});

describe('scheduled orders', () => {
  it('saves a valid time and rejects one that is too soon', async () => {
    const soon = await order(bob, { scheduledFor: new Date(Date.now() + 5 * 60_000).toISOString() });
    expect(soon.status).toBe(400);
    const later = new Date(Date.now() + 2 * 3600_000).toISOString();
    const ok = await order(bob, { scheduledFor: later });
    expect(ok.status).toBe(200);
    const saved = await Order.findById(ok.json.orderId).lean<{ scheduledFor: Date }>();
    expect(new Date(saved!.scheduledFor).toISOString()).toBe(later);
  });
});

describe('group orders', () => {
  it('host and friend fill one cart, host places it, bill is split', async () => {
    const created = await (await createGroup(req('/api/group-orders', { method: 'POST', user: alice, body: { restaurantId: shop.id } }))).json();
    const code = created.code as string;
    const g = (user: typeof alice, body: unknown) =>
      patchGroup(req(`/api/group-orders/${code}`, { method: 'PATCH', user, body }), { params: Promise.resolve({ code }) });

    expect((await g(bob, { action: 'set', menuItemId: coffeeId, quantity: 1 })).status).toBe(409); // must join first
    expect((await g(bob, { action: 'join' })).status).toBe(200);
    expect((await g(alice, { action: 'set', menuItemId: noodleId, quantity: 1 })).status).toBe(200);
    expect((await g(bob, { action: 'set', menuItemId: coffeeId, quantity: 2 })).status).toBe(200);
    expect((await g(bob, { action: 'lock' })).status).toBe(403); // only host

    const view = await (await getGroup(req(`/api/group-orders/${code}`, { user: bob }), { params: Promise.resolve({ code }) })).json();
    expect(view.group.members).toHaveLength(2);

    const placed = await placeGroup(
      req(`/api/group-orders/${code}/place`, { method: 'POST', user: alice, body: { deliveryAddress: address } }),
      { params: Promise.resolve({ code }) }
    );
    const json = await placed.json();
    expect(placed.status).toBe(200);
    const saved = await Order.findById(json.orderId).lean<Record<string, any>>();
    expect(saved!.groupCode).toBe(code);
    expect(saved!.totals.subtotal).toBe(9000);
    expect(json.shares.reduce((s: number, x: { amount: number }) => s + x.amount, 0)).toBe(saved!.totals.total);
    expect((await g(bob, { action: 'set', menuItemId: coffeeId, quantity: 3 })).status).toBe(409); // closed
  });
});

describe('voice order API', () => {
  it('finds dishes and quantities from a sentence', async () => {
    const res = await voice(req('/api/voice-order', { method: 'POST', user: alice, body: { text: '2 shan noodles and a coffee', restaurantId: shop.id } }));
    const json = await res.json();
    expect(json.restaurant.id).toBe(shop.id);
    expect(json.items.map((i: { name: string; quantity: number }) => [i.name, i.quantity])).toEqual([
      ['Shan Noodles', 2],
      ['Coffee', 1],
    ]);
  });
});

describe('multi-stop parcels', () => {
  it('needs each stop PIN and finishes after the last stop', async () => {
    const created = await createParcel(
      req('/api/parcels', {
        method: 'POST',
        user: alice,
        body: {
          pickup: { address: 'A', lat: 16.78, lng: 96.15 },
          dropoff: { address: 'B', lat: 16.8, lng: 96.15 },
          recipientName: 'Bee',
          recipientPhone: '09555555551',
          extraStops: [{ address: 'C', lat: 16.82, lng: 96.15, recipientName: 'Cee', recipientPhone: '09555555552' }],
        },
      })
    );
    expect(created.status).toBe(200);
    const parcel = (await created.json()).parcel;
    expect(parcel.extraStops).toHaveLength(1);
    const stopPin = parcel.extraStops[0].deliveryPin;
    const act = (body: unknown) => patchParcel(req(`/api/parcels/${parcel._id}`, { method: 'PATCH', user: rider, body }), params(parcel._id));

    const accepted = await (await act({ action: 'accept' })).json();
    expect(accepted.parcel.extraStops[0].deliveryPin).toBeUndefined(); // riders never see PINs
    await act({ action: 'pickup' });
    expect((await act({ action: 'deliver', stop: 1, pin: parcel.deliveryPin })).status).toBe(400); // wrong stop PIN
    const first = await (await act({ action: 'deliver', stop: 0, pin: parcel.deliveryPin })).json();
    expect(first.parcel.status).toBe('PICKED_UP');
    const last = await (await act({ action: 'deliver', stop: 1, pin: stopPin })).json();
    expect(last.parcel.status).toBe('DELIVERED');
  });
});
