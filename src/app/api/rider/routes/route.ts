import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';

type RouteStopType = 'FOOD';
type RouteStopStatus = 'COMPLETED' | 'CURRENT' | 'UPCOMING';

type RouteStop = {
  id: string;
  type: RouteStopType;
  location: string;
  address: string;
  status: RouteStopStatus;
  timeWindow: string;
  customerName: string;
  ref?: string;
  notes?: string;
};

type LeanOrder = {
  _id: { toString(): string };
  orderNumber?: string;
  restaurantName?: string;
  customerName?: string;
  status?: string;
  deliveryAddress?: { address?: string } | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  completedAt?: Date | string | null;
};

function startOfLocalDay(d = new Date()): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return start;
}

function asDate(value?: Date | string | null): Date {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatTimeWindow(date: Date): string {
  const end = new Date(date.getTime() + 25 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fmt(date)} – ${fmt(end)}`;
}

function shortLocation(address?: string, fallback = 'Stop'): string {
  if (!address?.trim()) return fallback;
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 1].replace(/\s*Township$/i, '').trim() || fallback;
  }
  const words = parts[0].split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join(' ') || fallback;
}

function orderRef(order: LeanOrder): string {
  const n = order.orderNumber?.trim();
  if (n) return n.startsWith('#') ? n : `#${n}`;
  return `#${String(order._id).slice(-6).toUpperCase()}`;
}

function mockRoutesPayload() {
  return {
    success: true,
    mocked: true,
    routes: [
      {
        id: 'mock-pickup-1',
        type: 'FOOD' as const,
        location: 'Insein',
        address: 'Insein Market BBQ, Insein Township, Yangon',
        status: 'COMPLETED' as const,
        timeWindow: '11:10 – 11:35',
        customerName: 'Insein Market BBQ',
        ref: '#YG-2401',
        notes: 'Food pickup · Insein Market BBQ',
      },
      {
        id: 'mock-dropoff-1',
        type: 'FOOD' as const,
        location: 'Insein',
        address: 'Insein Township, Yangon',
        status: 'CURRENT' as const,
        timeWindow: '11:35 – 12:00',
        customerName: 'Aung Naing',
        ref: '#YG-2401',
        notes: 'Food drop-off · Insein Market BBQ',
      },
      {
        id: 'mock-pickup-2',
        type: 'FOOD' as const,
        location: 'Bahan',
        address: 'Bahan Shwe Kaung, Bahan Township, Yangon',
        status: 'UPCOMING' as const,
        timeWindow: '12:15 – 12:40',
        customerName: 'Bahan Shwe Kaung',
        ref: '#YG-2408',
        notes: 'Food pickup · Bahan Shwe Kaung',
      },
      {
        id: 'mock-dropoff-2',
        type: 'FOOD' as const,
        location: 'Yankin',
        address: 'Yankin Township, Yangon',
        status: 'UPCOMING' as const,
        timeWindow: '12:40 – 13:05',
        customerName: 'Su Hlaing',
        ref: '#YG-2408',
        notes: 'Food drop-off · Bahan Shwe Kaung',
      },
    ],
  };
}

function buildStopsForOrder(
  order: LeanOrder,
  options: { includePickup: boolean; completed: boolean }
): RouteStop[] {
  const id = String(order._id);
  const restaurant = order.restaurantName || 'Restaurant';
  const customer = order.customerName || 'Customer';
  const customerAddress = order.deliveryAddress?.address || 'Customer address';
  const ref = orderRef(order);
  const baseTime = asDate(order.completedAt || order.updatedAt || order.createdAt);
  const status: RouteStopStatus = options.completed ? 'COMPLETED' : 'UPCOMING';
  const stops: RouteStop[] = [];

  if (options.includePickup) {
    stops.push({
      id: `${id}-pickup`,
      type: 'FOOD',
      location: shortLocation(restaurant, restaurant),
      address: restaurant,
      status,
      timeWindow: formatTimeWindow(baseTime),
      customerName: restaurant,
      ref,
      notes: `Food pickup · ${restaurant}`,
    });
  }

  stops.push({
    id: `${id}-dropoff`,
    type: 'FOOD',
    location: shortLocation(customerAddress, 'Customer'),
    address: customerAddress,
    status,
    timeWindow: formatTimeWindow(
      new Date(baseTime.getTime() + (options.includePickup ? 20 : 0) * 60 * 1000)
    ),
    customerName: customer,
    ref,
    notes: `Food drop-off · ${restaurant}`,
  });

  return stops;
}

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const riderId = searchParams.get('riderId');

    if (!riderId) {
      return NextResponse.json(
        { success: false, message: 'riderId is required' },
        { status: 400 }
      );
    }

    const todayStart = startOfLocalDay();

    const [activeOrdersRaw, deliveredTodayRaw] = await Promise.all([
      Order.find({
        riderId,
        status: 'OUT_FOR_DELIVERY',
      })
        .select(
          'orderNumber restaurantName customerName status deliveryAddress createdAt updatedAt completedAt'
        )
        .sort({ createdAt: 1 })
        .limit(100)
        .lean(),
      Order.find({
        riderId,
        status: 'DELIVERED',
        createdAt: { $gte: todayStart },
      })
        .select(
          'orderNumber restaurantName customerName status deliveryAddress createdAt updatedAt completedAt'
        )
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const activeOrders = activeOrdersRaw as LeanOrder[];
    const deliveredToday = (deliveredTodayRaw as LeanOrder[]).sort(
      (a, b) =>
        asDate(a.completedAt || a.updatedAt || a.createdAt).getTime() -
        asDate(b.completedAt || b.updatedAt || b.createdAt).getTime()
    );

    const mappedStops: RouteStop[] = [];

    for (const order of deliveredToday) {
      // History: both pickup + dropoff completed
      mappedStops.push(
        ...buildStopsForOrder(order, { includePickup: true, completed: true })
      );
    }

    for (const order of activeOrders) {
      // Active: pickup (not yet delivered) + dropoff. Without a separate
      // picked-up flag on Order, include pickup for all OUT_FOR_DELIVERY jobs.
      mappedStops.push(
        ...buildStopsForOrder(order, { includePickup: true, completed: false })
      );
    }

    let assignedCurrent = false;
    for (const stop of mappedStops) {
      if (stop.status === 'COMPLETED') continue;
      if (!assignedCurrent) {
        stop.status = 'CURRENT';
        assignedCurrent = true;
      } else {
        stop.status = 'UPCOMING';
      }
    }

    return NextResponse.json({ success: true, routes: mappedStops });
  } catch (error) {
    console.error('Rider routes GET error:', error);
    return NextResponse.json(mockRoutesPayload());
  }
}
