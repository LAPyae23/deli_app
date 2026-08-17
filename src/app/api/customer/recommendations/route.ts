import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RestaurantProfile from '@/models/RestaurantProfile';
import { AI_PICKS_FALLBACK_ITEMS, getDishImage } from '@/lib/dishImages';
import {
  favoriteFromOrderHistory,
  pickWeather,
  sampleDistinctPicks,
  sampleMenuItems,
  weatherCopy,
  type SampledMenu,
} from '@/lib/aiPicksSample';

type RecItem = {
  id?: string;
  name: string;
  category: string;
  price: number;
  score: number;
  restaurantName?: string;
  restaurantId?: string;
  image?: string;
  imageAlt?: string;
  reasonTag?: string;
};

function toRec(
  doc: SampledMenu,
  restaurants: Map<string, string>,
  extra?: Partial<RecItem>
): RecItem {
  return {
    id: doc._id,
    name: doc.name,
    category: doc.category,
    price: doc.price,
    score: doc.isPopular ? 10 : 6,
    restaurantId: doc.restaurantId,
    restaurantName: doc.restaurantId
      ? restaurants.get(doc.restaurantId)
      : extra?.restaurantName,
    image: doc.image || getDishImage(doc.name),
    imageAlt: doc.imageAlt || doc.name,
    ...extra,
  };
}

function fallbackItems(tag: string, restaurants: Map<string, string>): RecItem[] {
  const anyName = restaurants.values().next().value as string | undefined;
  return AI_PICKS_FALLBACK_ITEMS.filter((row) => {
    if (tag === 'rain') return row.reasonTag === 'rain' || row.category === 'Burmese';
    if (tag === 'Sunny') return row.reasonTag === 'Sunny' || row.category === 'Drinks' || row.category === 'Dessert';
    if (tag === 'trending') return row.reasonTag === 'hlaing' || row.category === 'Fast Food';
    if (tag === 'Burmese') return row.category === 'Burmese';
    if (tag === 'Drinks') return row.category === 'Drinks' || row.category === 'Dessert';
    if (tag === 'Dessert') return row.category === 'Dessert';
    if (tag === 'Fast Food') return row.category === 'Fast Food';
    return true;
  }).map((row) => ({
    name: row.name,
    category: row.category,
    price: row.price,
    score: 8,
    restaurantName: anyName || 'Hlaing Township Shan Noodle',
    image: row.image,
    imageAlt: row.name,
    reasonTag: tag,
  }));
}

function distinctByIdOrName(items: RecItem[]): RecItem[] {
  const seen = new Set<string>();
  const out: RecItem[] = [];
  for (const item of items) {
    const key = String(item.id || item.name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function GET(request: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId')?.trim() || 'demo-customer';
    const weather = pickWeather(searchParams.get('weather'));
    const weatherMeta = weatherCopy(weather);

    const [restaurantDocs, history] = await Promise.all([
      RestaurantProfile.find({}).select('restaurantId restaurantName').lean(),
      favoriteFromOrderHistory(customerId),
    ]);

    const restaurants = new Map<string, string>();
    for (const r of restaurantDocs) {
      const id = String(r.restaurantId || '');
      if (id) restaurants.set(id, String(r.restaurantName || ''));
    }

    const sampled = await sampleDistinctPicks(weather);

    const weatherBased = distinctByIdOrName(
      sampled.weatherList.map((d) => toRec(d, restaurants, { reasonTag: weather }))
    );
    const trending = distinctByIdOrName(
      sampled.trendingList.map((d) => toRec(d, restaurants, { reasonTag: 'hlaing' }))
    );

    const usedIds = [
      ...weatherBased.map((i) => String(i.id || '')),
      ...trending.map((i) => String(i.id || '')),
    ].filter(Boolean);

    let personalizedDocs: SampledMenu[] = [];
    if (history.favoriteCategory) {
      const ordered = new Set(history.orderedNames);
      const sampledFav = await sampleMenuItems(
        { category: history.favoriteCategory },
        8,
        usedIds
      );
      personalizedDocs = sampledFav.filter(
        (d) => !ordered.has(d.name.trim().toLowerCase())
      );
      if (personalizedDocs.length < 3) {
        const extra = await sampleMenuItems({ category: history.favoriteCategory }, 8);
        const seen = new Set(personalizedDocs.map((d) => d._id || d.name.toLowerCase()));
        for (const doc of extra) {
          const key = doc._id || doc.name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          personalizedDocs.push(doc);
          if (personalizedDocs.length >= 6) break;
        }
      }
    }

    const personalized = distinctByIdOrName(
      (personalizedDocs.length > 0 ? personalizedDocs : sampled.recommendedList).map((d) =>
        toRec(d, restaurants, { reasonTag: 'recommended' })
      )
    );

    const weatherItems =
      weatherBased.length > 0
        ? weatherBased
        : fallbackItems(weather === 'Sunny' ? 'Sunny' : 'rain', restaurants);
    const trendingItems =
      trending.length > 0 ? trending : fallbackItems('trending', restaurants);
    const recommendedItems =
      personalized.length > 0
        ? personalized
        : fallbackItems(history.favoriteCategory || 'spicy', restaurants);

    const weatherFeatured = sampled.weatherItem
      ? toRec(sampled.weatherItem, restaurants, { reasonTag: weather })
      : weatherItems[0] || null;
    const trendingFeatured = sampled.trendingItem
      ? toRec(sampled.trendingItem, restaurants, { reasonTag: 'hlaing' })
      : trendingItems.find((i) => i.id !== weatherFeatured?.id) || trendingItems[0] || null;
    const recommendedFeatured =
      recommendedItems.find(
        (i) => i.id !== weatherFeatured?.id && i.id !== trendingFeatured?.id
      ) || recommendedItems[0] || null;

    const favoriteCategory =
      history.favoriteCategory || (weather === 'Sunny' ? 'Drinks' : 'Burmese');
    const personalizedReason = history.hasOrderHistory
      ? `Based on your past orders · you order a lot of ${favoriteCategory}`
      : 'A fresh pick from the menu';

    return NextResponse.json({
      success: true,
      customerId,
      weather,
      favoriteCategory,
      hasOrderHistory: history.hasOrderHistory,
      featured: {
        weather: {
          title: weatherMeta.title,
          reason: weatherMeta.subtitle,
          weather,
          item: weatherFeatured,
        },
        trending: {
          title: 'Trending in Hlaing',
          reason: 'Popular Fast Food right now',
          item: trendingFeatured,
        },
        recommended: {
          title: 'Recommended for You',
          reason: personalizedReason,
          item: recommendedFeatured,
        },
      },
      personalized: {
        label: 'Based on your past orders',
        reason: personalizedReason,
        items: recommendedItems.slice(0, 6),
      },
      weatherBased: {
        label: `Perfect for a ${weather} day`,
        reason: weatherMeta.subtitle,
        weather,
        items: weatherItems.slice(0, 6),
      },
      trending: {
        label: 'Trending in Hlaing',
        reason: 'Popular Fast Food right now',
        items: trendingItems.slice(0, 6),
      },
    });
  } catch (error) {
    console.error('Customer recommendations GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load recommendations' },
      { status: 500 }
    );
  }
}
