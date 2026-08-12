import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import MenuItem from '@/models/MenuItem';

const WEATHER_OPTIONS = ['Sunny', 'Rainy', 'Cloudy', 'Stormy'] as const;
const DEFAULT_CUSTOMER_ID = 'demo-customer';

type OrderItemLike = {
  name?: string;
  category?: string;
  price?: number;
  unitPrice?: number;
  quantity?: number;
  restaurantName?: string;
  image?: string;
};

type RecItem = {
  name: string;
  category: string;
  price: number;
  score: number;
  restaurantName?: string;
  image?: string;
  reasonTag?: string;
};

function pickWeather(): (typeof WEATHER_OPTIONS)[number] {
  return WEATHER_OPTIONS[Math.floor(Math.random() * WEATHER_OPTIONS.length)];
}

function normalizeCategory(raw?: string): string {
  const value = String(raw || '').trim();
  if (!value) return 'Fast Food';
  return value;
}

function toRecItem(
  item: OrderItemLike,
  score: number,
  reasonTag?: string
): RecItem {
  return {
    name: String(item.name || 'Item'),
    category: normalizeCategory(item.category),
    price: Number(item.price ?? item.unitPrice) || 0,
    score,
    restaurantName: item.restaurantName ? String(item.restaurantName) : undefined,
    image: item.image ? String(item.image) : undefined,
    reasonTag,
  };
}

function topByScore(map: Map<string, RecItem>, limit: number): RecItem[] {
  return Array.from(map.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function GET(request: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const customerId =
      searchParams.get('customerId')?.trim() || DEFAULT_CUSTOMER_ID;
    const weather = pickWeather();

    // --- Logic 1: Personalized by favorite category ---
    const customerOrders = await Order.find({ customerId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const categoryCounts = new Map<string, number>();
    for (const order of customerOrders) {
      const items = Array.isArray(order.items) ? (order.items as OrderItemLike[]) : [];
      for (const item of items) {
        const cat = normalizeCategory(item.category);
        const qty = Number(item.quantity) || 1;
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + qty);
      }
    }

    let favoriteCategory = 'Fast Food';
    let favoriteCount = 0;
    for (const [cat, count] of categoryCounts) {
      if (count > favoriteCount) {
        favoriteCategory = cat;
        favoriteCount = count;
      }
    }

    // Prefer live MenuItems in that category; fall back to order-item aggregation
    const menuMatches = await MenuItem.find({
      isAvailable: true,
      category: new RegExp(`^${favoriteCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    })
      .sort({ isPopular: -1, stockQuantity: -1 })
      .limit(8)
      .lean();

    let personalized: RecItem[] = menuMatches.map((m) => ({
      name: m.name,
      category: normalizeCategory(m.category),
      price: Number(m.discountPrice ?? m.price) || 0,
      score: m.isPopular ? 10 : 5,
      image: m.image || undefined,
      reasonTag: favoriteCategory,
    }));

    if (personalized.length === 0) {
      const allOrders = await Order.find({}).select('items').limit(500).lean();
      const byName = new Map<string, RecItem>();
      for (const order of allOrders) {
        const items = Array.isArray(order.items) ? (order.items as OrderItemLike[]) : [];
        for (const item of items) {
          if (normalizeCategory(item.category) !== favoriteCategory) continue;
          const key = String(item.name || '').toLowerCase();
          if (!key) continue;
          const qty = Number(item.quantity) || 1;
          const existing = byName.get(key);
          if (existing) {
            existing.score += qty;
          } else {
            byName.set(key, toRecItem(item, qty, favoriteCategory));
          }
        }
      }
      personalized = topByScore(byName, 6);
    } else {
      personalized = personalized.slice(0, 6);
    }

    // --- Logic 2: Weather / context-aware ---
    const weatherOrders = await Order.find({ weather })
      .select('items')
      .limit(400)
      .lean();

    const weatherMap = new Map<string, RecItem>();
    for (const order of weatherOrders) {
      const items = Array.isArray(order.items) ? (order.items as OrderItemLike[]) : [];
      for (const item of items) {
        const key = String(item.name || '').toLowerCase();
        if (!key) continue;
        const qty = Number(item.quantity) || 1;
        const existing = weatherMap.get(key);
        if (existing) existing.score += qty;
        else weatherMap.set(key, toRecItem(item, qty, weather));
      }
    }
    let weatherBased = topByScore(weatherMap, 6);

    // Fallback if not enough rainy/weather data
    if (weatherBased.length < 3) {
      const anyOrders = await Order.find({}).select('items weather').limit(400).lean();
      const fallback = new Map<string, RecItem>();
      for (const order of anyOrders) {
        const items = Array.isArray(order.items) ? (order.items as OrderItemLike[]) : [];
        for (const item of items) {
          const key = String(item.name || '').toLowerCase();
          if (!key) continue;
          const qty = Number(item.quantity) || 1;
          const existing = fallback.get(key);
          if (existing) existing.score += qty;
          else fallback.set(key, toRecItem(item, qty, weather));
        }
      }
      weatherBased = topByScore(fallback, 6);
    }

    // --- Logic 3: Trending / platform popularity ---
    const trendingOrders = await Order.find({})
      .select('items')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const trendMap = new Map<string, RecItem>();
    for (const order of trendingOrders) {
      const items = Array.isArray(order.items) ? (order.items as OrderItemLike[]) : [];
      for (const item of items) {
        const key = String(item.name || '').toLowerCase();
        if (!key) continue;
        const qty = Number(item.quantity) || 1;
        const existing = trendMap.get(key);
        if (existing) existing.score += qty;
        else trendMap.set(key, toRecItem(item, qty, 'trending'));
      }
    }
    const trending = topByScore(trendMap, 3);

    return NextResponse.json({
      success: true,
      customerId,
      weather,
      favoriteCategory,
      hasOrderHistory: customerOrders.length > 0,
      personalized: {
        label: 'Based on your past orders',
        reason:
          customerOrders.length > 0
            ? `Because you frequently buy ${favoriteCategory}`
            : `Popular ${favoriteCategory} picks to get you started`,
        items: personalized,
      },
      weatherBased: {
        label: `Perfect for a ${weather} day`,
        reason: `Most ordered across FoodDash when weather is ${weather}`,
        weather,
        items: weatherBased,
      },
      trending: {
        label: 'Trending right now',
        reason: 'Top 3 most frequently bought items on the platform',
        items: trending,
      },
    });
  } catch (error) {
    console.error('Customer recommendations GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to build recommendations' },
      { status: 500 }
    );
  }
}
