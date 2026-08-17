import mongoose from 'mongoose';
import MenuItem from '@/models/MenuItem';
import { getDishImage } from '@/lib/dishImages';

export const WEATHER_OPTIONS = ['Sunny', 'Rainy', 'Cloudy', 'Stormy'] as const;
export type WeatherKind = (typeof WEATHER_OPTIONS)[number];

export type SampledMenu = {
  _id: string;
  name: string;
  category: string;
  price: number;
  restaurantId?: string;
  image?: string;
  imageAlt?: string;
  isPopular?: boolean;
};

function asObjectIds(ids: string[]) {
  return ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

export function pickWeather(requested?: string | null): WeatherKind {
  const raw = String(requested || '').trim();
  if (raw && WEATHER_OPTIONS.includes(raw as WeatherKind)) {
    return raw as WeatherKind;
  }
  const month = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Yangon',
      month: 'numeric',
    }).format(new Date())
  );
  return month >= 5 && month <= 10 ? 'Rainy' : 'Sunny';
}

export function weatherMatch(weather: WeatherKind): Record<string, unknown> {
  if (weather === 'Rainy' || weather === 'Stormy') {
    return {
      $or: [
        { category: { $in: ['Burmese', 'Soup'] } },
        { name: /soup|mohinga|kyay\s*oh|ohno|kauk swe/i },
        { description: /soup|broth/i },
      ],
    };
  }
  return {
    $or: [
      { category: { $in: ['Drinks', 'Dessert'] } },
      { name: /ice\s*cream|cola|shwe yin aye|mont lone|tea|drink/i },
    ],
  };
}

export function trendingMatch(): Record<string, unknown> {
  return {
    $or: [{ isPopular: true }, { category: 'Fast Food' }],
  };
}

function mapDoc(doc: Record<string, unknown>): SampledMenu {
  const name = String(doc.name || 'Item');
  return {
    _id: String(doc._id || ''),
    name,
    category: String(doc.category || 'Fast Food'),
    price: Number(doc.discountPrice ?? doc.price) || 0,
    restaurantId: doc.restaurantId ? String(doc.restaurantId) : undefined,
    image: String(doc.image || '') || getDishImage(name),
    imageAlt: String(doc.imageAlt || name),
    isPopular: Boolean(doc.isPopular),
  };
}

export async function sampleMenuItems(
  match: Record<string, unknown>,
  size: number,
  excludeIds: string[] = []
): Promise<SampledMenu[]> {
  const excluded = asObjectIds(excludeIds);
  const query: Record<string, unknown> = {
    isAvailable: { $ne: false },
    ...match,
  };
  if (excluded.length > 0) {
    query._id = { $nin: excluded };
  }

  let rows = (await MenuItem.aggregate([
    { $match: query },
    { $sample: { size: Math.max(1, size) } },
  ])) as Record<string, unknown>[];

  if (rows.length === 0 && excluded.length > 0) {
    const retryMatch = { ...match, isAvailable: { $ne: false } };
    rows = (await MenuItem.aggregate([
      { $match: retryMatch },
      { $sample: { size: Math.max(1, size) } },
    ])) as Record<string, unknown>[];
  }

  const seen = new Set<string>();
  const unique: SampledMenu[] = [];
  for (const row of rows) {
    const mapped = mapDoc(row);
    const key = mapped._id || mapped.name.toLowerCase();
    if (seen.has(key)) continue;
    if (excludeIds.includes(mapped._id)) continue;
    seen.add(key);
    unique.push(mapped);
    if (unique.length >= size) break;
  }
  return unique;
}

export async function sampleDistinctPicks(weather: WeatherKind) {
  const weatherItems = await sampleMenuItems(weatherMatch(weather), 1);
  const weatherItem = weatherItems[0] || null;
  const usedIds = weatherItem?._id ? [weatherItem._id] : [];

  const trendingItems = await sampleMenuItems(trendingMatch(), 1, usedIds);
  const trendingItem = trendingItems[0] || null;
  if (trendingItem?._id) usedIds.push(trendingItem._id);

  const recommendedItems = await sampleMenuItems({}, 1, usedIds);
  const recommendedItem = recommendedItems[0] || null;
  if (recommendedItem?._id) usedIds.push(recommendedItem._id);

  const weatherList = await sampleMenuItems(weatherMatch(weather), 6, usedIds);
  const trendingList = await sampleMenuItems(trendingMatch(), 6, [
    ...usedIds,
    ...weatherList.map((i) => i._id),
  ]);
  const recommendedList = await sampleMenuItems({}, 6, [
    ...usedIds,
    ...weatherList.map((i) => i._id),
    ...trendingList.map((i) => i._id),
  ]);

  return {
    weatherItem,
    trendingItem,
    recommendedItem,
    weatherList: weatherItem
      ? [weatherItem, ...weatherList.filter((i) => i._id !== weatherItem._id)]
      : weatherList,
    trendingList: trendingItem
      ? [trendingItem, ...trendingList.filter((i) => i._id !== trendingItem._id)]
      : trendingList,
    recommendedList: recommendedItem
      ? [
          recommendedItem,
          ...recommendedList.filter((i) => i._id !== recommendedItem._id),
        ]
      : recommendedList,
  };
}

const MENU_CATEGORIES = ['Fast Food', 'Burmese', 'Drinks', 'Dessert'] as const;
export type MenuCategory = (typeof MENU_CATEGORIES)[number];

function normalizeCategory(raw?: string): MenuCategory {
  const value = String(raw || '').trim();
  if (MENU_CATEGORIES.includes(value as MenuCategory)) return value as MenuCategory;
  const lower = value.toLowerCase();
  if (lower.includes('burmese') || lower.includes('myanmar')) return 'Burmese';
  if (lower.includes('drink') || lower.includes('beverage')) return 'Drinks';
  if (lower.includes('dessert') || lower.includes('sweet')) return 'Dessert';
  return 'Fast Food';
}

export async function favoriteFromOrderHistory(customerId: string): Promise<{
  hasOrderHistory: boolean;
  favoriteCategory: MenuCategory | null;
  orderedNames: string[];
}> {
  const empty = {
    hasOrderHistory: false,
    favoriteCategory: null as MenuCategory | null,
    orderedNames: [] as string[],
  };
  if (!customerId || customerId === 'demo-customer' || customerId === 'guest') {
    return empty;
  }

  const Order = (await import('@/models/Order')).default;
  const orders = await Order.find({
    customerId,
    status: { $nin: ['CANCELLED', 'REJECTED'] },
  })
    .select('items.category items.name items.quantity')
    .sort({ createdAt: -1 })
    .limit(40)
    .lean();

  const catCounts = new Map<string, number>();
  const nameCounts = new Map<string, number>();

  for (const order of orders) {
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items as Array<{
      category?: string;
      name?: string;
      quantity?: number;
    }>) {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const category = normalizeCategory(item.category);
      catCounts.set(category, (catCounts.get(category) || 0) + qty);
      const name = String(item.name || '').trim().toLowerCase();
      if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + qty);
    }
  }

  if (catCounts.size === 0) return empty;

  const favoriteCategory = Array.from(catCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0][0] as MenuCategory;

  return {
    hasOrderHistory: true,
    favoriteCategory,
    orderedNames: Array.from(nameCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name]) => name),
  };
}

export function weatherCopy(weather: WeatherKind) {
  if (weather === 'Sunny') {
    return {
      title: 'Perfect Weather Match',
      subtitle: 'Drinks and dessert for a sunny day',
    };
  }
  if (weather === 'Stormy') {
    return {
      title: 'Perfect Weather Match',
      subtitle: 'Hot Burmese soup for the storm',
    };
  }
  return {
    title: 'Perfect Weather Match',
    subtitle: 'Mohinga and hot soup for the rain',
  };
}
