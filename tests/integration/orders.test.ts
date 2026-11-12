import { beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import MenuItem from '@/models/MenuItem';
import RestaurantProfile from '@/models/RestaurantProfile';
import RiderProfile from '@/models/RiderProfile';
import CustomerProfile from '@/models/CustomerProfile';
import Order from '@/models/Order';
import { GET as listOrders, POST as placeOrder } from '@/app/api/orders/route';
import { GET as getOrder, PATCH as patchOrder } from '@/app/api/orders/[id]/route';
import { params, req } from '../helpers';

const id = () => new mongoose.Types.ObjectId().toString();
const customer = { id: id(), role: 'CUSTOMER' as const };
const otherCustomer = { id: id(), role: 'CUSTOMER' as const };
const restaurant = { id: id(), role: 'RESTAURANT' as const };
const otherRestaurant = { id: id(), role: 'RESTAURANT' as const };
const riders = [id(), id(), id()].map((r) => ({ id: r, role: 'RIDER' as const }));
const pickup = { lat: 16.8, lng: 96.15 };
let menuId = '';

beforeAll(async () => {
  await dbConnect();
  const users = [customer, otherCustomer, restaurant, otherRestaurant, ...riders];
  await User.insertMany(
    users.map((u, i) => ({ _id: u.id, firstName: 'T', lastName: String(i), email: `u${i}@t.test`, phone: `0900000${i}`, password: 'x', role: u.role }))
  );
  await RestaurantProfile.create({ restaurantId: restaurant.id, restaurantName: 'Test Kitchen', storeStatus: 'OPEN', location: pickup });
  await RestaurantProfile.create({ restaurantId: otherRestaurant.id, restaurantName: 'Other Kitchen', storeStatus: 'OPEN', location: pickup });
  const item = await MenuItem.create({ restaurantId: restaurant.id, name: 'Shan Noodles', category: 'Burmese', price: 4000, stockQuantity: 10, addons: [{ name: 'Egg', extraPrice: 500 }] });
  menuId = String(item._id);
  await CustomerProfile.create({ customerId: customer.id, hasPromo: true, promoCode: 'TEST10', promoDiscountPercent: 10 });
  for (const [i, r] of riders.entries()) {
    const at = { lat: pickup.lat + (i + 1) * 0.005, lng: pickup.lng };
    await RiderProfile.create({ riderId: r.id, status: 'Online', riderCoords: at, location: at });
  }
});

async function newOrder(body: Record<string, unknown> = {}) {
  const res = await placeOrder(
    req('/api/orders', {
      method: 'POST',
      user: customer,
      body: { items: [{ id: menuId, quantity: 2, unitPrice: 1 }], deliveryAddress: { address: 'Test', lat: 16.82, lng: 96.15 }, ...body },
    })
  );
  return { status: res.status, json: await res.json() };
}

describe('placing orders', () => {
  it('ignores client prices, discounts and customer id', async () => {
    const { status, json } = await newOrder({ discount: 999999, customerId: otherCustomer.id, totals: { deliveryFee: 0 } });
    expect(status).toBe(200);
    const o = await Order.findById(json.orderId).lean<Record<string, any>>();
    expect(o!.items[0].unitPrice).toBe(4000);
    expect(o!.totals.subtotal).toBe(8000);
    expect(o!.totals.deliveryFee).toBe(2050);
    expect(o!.totals.discount).toBe(0);
    expect(o!.customerId).toBe(customer.id);
    expect(o!.restaurantId).toBe(restaurant.id);
  });

  it('prices add-ons from the menu and refuses fake ones', async () => {
    const ok = await newOrder({ items: [{ id: `${menuId}__Egg`, quantity: 1, unitPrice: 1 }] });
    const o = await Order.findById(ok.json.orderId).lean<Record<string, any>>();
    expect(o!.items[0].unitPrice).toBe(4500);
    const bad = await newOrder({ items: [{ id: `${menuId}__Gold`, quantity: 1 }] });
    expect(bad.status).toBe(400);
  });

  it('applies a granted promo once only', async () => {
    const first = await newOrder({ promoCodeUsed: 'TEST10' });
    const second = await newOrder({ promoCodeUsed: 'TEST10' });
    const a = await Order.findById(first.json.orderId).lean<Record<string, any>>();
    expect(a!.totals.discount).toBe(800);
    // A used code is refused instead of silently charging full price.
    expect(second.status).toBe(400);
  });

  it('refuses more than the stock', async () => {
    const res = await newOrder({ items: [{ id: menuId, quantity: 50 }] });
    expect(res.status).toBe(400);
  });

  it('only customers can place orders', async () => {
    const res = await placeOrder(req('/api/orders', { method: 'POST', user: restaurant, body: { items: [{ id: menuId, quantity: 1 }], deliveryAddress: { address: 'x' } } }));
    expect(res.status).toBe(403);
  });
});

describe('order access and status rules', () => {
  it('customers only list their own orders', async () => {
    const res = await listOrders(req('/api/orders?limit=50', { user: otherCustomer }));
    const json = await res.json();
    expect(json.orders.every((o: { customerId: string }) => o.customerId === otherCustomer.id)).toBe(true);
  });

  it('other customers and restaurants cannot open an order', async () => {
    await MenuItem.updateOne({ _id: menuId }, { $set: { stockQuantity: 10 } });
    const { json } = await newOrder();
    expect((await getOrder(req(`/api/orders/${json.orderId}`, { user: otherCustomer }), params(json.orderId))).status).toBe(403);
    expect((await getOrder(req(`/api/orders/${json.orderId}`, { user: otherRestaurant }), params(json.orderId))).status).toBe(403);
    expect((await getOrder(req(`/api/orders/${json.orderId}`, { user: customer }), params(json.orderId))).status).toBe(200);
  });

  it('enforces the state machine and lets exactly one rider claim', async () => {
    await MenuItem.updateOne({ _id: menuId }, { $set: { stockQuantity: 10 } });
    const { json } = await newOrder();
    const oid = json.orderId;
    const patch = (user: { id: string; role: any }, body: unknown) =>
      patchOrder(req(`/api/orders/${oid}`, { method: 'PATCH', user, body }), params(oid));

    expect((await patch(customer, { status: 'DELIVERED' })).status).toBe(409);
    expect((await patch(restaurant, { status: 'READY' })).status).toBe(409);
    expect((await patch(otherRestaurant, { status: 'PREPARING' })).status).toBe(403);
    expect((await patch(restaurant, { status: 'PREPARING', prepTime: 20 })).status).toBe(200);
    expect((await patch(restaurant, { status: 'READY' })).status).toBe(200);

    const results = await Promise.all(
      riders.map((r) => patch(r, { status: 'OUT_FOR_DELIVERY', riderId: r.id }))
    );
    const codes = results.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(riders.length - 1);

    const winner = riders[results.findIndex((r) => r.status === 200)];
    expect((await patch(winner, { status: 'DELIVERED', tipAmount: 999999 })).status).toBe(200);
    const done = await Order.findById(oid).lean<Record<string, any>>();
    expect(done!.status).toBe('DELIVERED');
    expect(done!.tipAmount).not.toBe(999999);
    expect((await patch(customer, { status: 'CANCELLED' })).status).toBe(409);
    expect((await patch(customer, { restaurantRating: 5 })).status).toBe(200);
  });
});
