import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import RestaurantProfile from '@/models/RestaurantProfile';

type OrderItemLike = {
  name?: string;
  category?: string;
  quantity?: number;
  price?: number;
  unitPrice?: number;
};

type LeanOrder = {
  customerId?: string;
  customerName?: string;
  restaurantId?: string;
  restaurantName?: string;
  status?: string;
  createdAt?: Date;
  deliveryAddress?: { address?: string; township?: string } | string | null;
  totals?: { total?: number } | null;
  items?: OrderItemLike[] | null;
};

const TOWNSHIPS = [
  'South Dagon',
  'Bahan',
  'Kyauktada',
  'Pabedan',
  'Latha',
  'Lanmadaw',
  'Sanchaung',
  'Mayangone',
  'South Okkalapa',
  'North Okkalapa',
] as const;

function orderTotal(order: LeanOrder): number {
  const n = Number(order.totals?.total);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalizeCategory(raw?: string): string {
  const value = String(raw || '').trim();
  return value || 'Fast Food';
}

function detectTownship(text: string): string | null {
  for (const t of TOWNSHIPS) {
    if (new RegExp(t.replace(/\s+/g, '\\s*'), 'i').test(text)) return t;
  }
  return null;
}

function mockPercentile(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const options = [5, 8, 10, 12, 15];
  return options[hash % options.length];
}

export async function GET(request: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId')?.trim() || '';

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: 'customerId is required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const orders = (await Order.find({ customerId })
      .select('customerId customerName restaurantId restaurantName status createdAt deliveryAddress totals items')
      .sort({ createdAt: -1 })
      .lean()) as LeanOrder[];

    const monthOrders = orders.filter((o) => {
      const status = String(o.status || '').toUpperCase();
      if (status === 'CANCELLED' || status === 'REJECTED') return false;
      const created = o.createdAt ? new Date(o.createdAt) : null;
      // Prefer current calendar month; if empty (seed spread over 45d), fall back to last 45 days
      return created ? created >= monthStart : false;
    });

    const windowStart = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    const scopedOrders =
      monthOrders.length > 0
        ? monthOrders
        : orders.filter((o) => {
            const status = String(o.status || '').toUpperCase();
            if (status === 'CANCELLED' || status === 'REJECTED') return false;
            const created = o.createdAt ? new Date(o.createdAt) : null;
            return created ? created >= windowStart : true;
          });

    const totalOrders = scopedOrders.length;
    const totalSpent = Math.round(
      scopedOrders.reduce((sum, o) => sum + orderTotal(o), 0) * 100
    ) / 100;

    const itemCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const restaurantCounts = new Map<string, number>();

    for (const order of scopedOrders) {
      const rid = String(order.restaurantId || order.restaurantName || '');
      if (rid) restaurantCounts.set(rid, (restaurantCounts.get(rid) || 0) + 1);

      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const name = String(item?.name || '').trim();
        const qty = Number(item?.quantity);
        const add = Number.isFinite(qty) && qty > 0 ? qty : 1;
        if (name) itemCounts.set(name, (itemCounts.get(name) || 0) + add);
        const cat = normalizeCategory(item?.category);
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + add);
      }
    }

    const topItemEntry = [...itemCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topCategoryEntry = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    const topItem = topItemEntry
      ? { name: topItemEntry[0], quantity: topItemEntry[1] }
      : { name: 'Burgers', quantity: 0 };
    const topCategory = topCategoryEntry
      ? { name: topCategoryEntry[0], quantity: topCategoryEntry[1] }
      : { name: 'Fast Food', quantity: 0 };

    // Township for percentile story
    let township: string | null = null;
    for (const order of scopedOrders) {
      if (typeof order.deliveryAddress === 'string') {
        township = detectTownship(order.deliveryAddress);
      } else if (order.deliveryAddress?.township) {
        township = detectTownship(String(order.deliveryAddress.township));
      } else if (order.deliveryAddress?.address) {
        township = detectTownship(String(order.deliveryAddress.address));
      }
      if (township) break;
    }

    if (!township) {
      const topRestaurantId = [...restaurantCounts.entries()].sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0];
      if (topRestaurantId) {
        const profile = await RestaurantProfile.findOne({
          $or: [{ restaurantId: topRestaurantId }, { name: topRestaurantId }],
        })
          .select('township')
          .lean();
        if (profile?.township) township = detectTownship(String(profile.township));
      }
    }

    township = township || 'Sanchaung';
    const percentile = mockPercentile(`${customerId}:${topCategory.name}:${township}`);
    const percentileText = `You are in the top ${percentile}% of ${topCategory.name} lovers in ${township}!`;

    const customerName =
      String(scopedOrders[0]?.customerName || orders[0]?.customerName || 'Foodie').trim() ||
      'Foodie';

    const headline =
      topItem.quantity > 0
        ? `You ate ${topItem.quantity} ${topItem.name} this month!`
        : 'Your Foodie Wrapped is warming up — place an order to unlock the story!';

    return NextResponse.json({
      success: true,
      wrapped: {
        customerName,
        monthLabel,
        totalOrders,
        totalSpent,
        topItem,
        topCategory,
        township,
        percentile,
        percentileText,
        headline,
        period:
          monthOrders.length > 0
            ? 'calendar_month'
            : 'last_45_days',
      },
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Customer wrapped GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to build Foodie Wrapped' },
      { status: 500 }
    );
  }
}
