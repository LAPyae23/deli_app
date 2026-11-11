import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RestaurantProfile from '@/models/RestaurantProfile';
import Order from '@/models/Order';
import { getSession } from '@/lib/auth';
import { getYangonWeather, isWet } from '@/lib/weather';
import { getDishWeatherLift, getTrending, significantDishes } from '@/lib/weatherDemand';
import { loadModel } from '@/lib/recommenderData';
import { scoreDishes } from '@/lib/recommender';
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
    if (tag === 'Sunny') return row.reasonTag === 'Sunny' || (row.category as string) === 'Drinks' || (row.category as string) === 'Dessert';
    if (tag === 'trending') return row.reasonTag === 'hlaing' || row.category === 'Fast Food';
    if (tag === 'Burmese') return row.category === 'Burmese';
    if (tag === 'Drinks') return (row.category as string) === 'Drinks' || (row.category as string) === 'Dessert';
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
    const key = String(item.name || item.id).trim().toLowerCase();
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
    const customerId =
      searchParams.get('customerId')?.trim() || getSession(request)?.userId || 'demo-customer';
    // A weather in the URL = the customer exploring another weather; otherwise real Yangon weather.
    const live = await getYangonWeather();
    const requestedWeather = searchParams.get('weather');
    const weather = requestedWeather ? pickWeather(requestedWeather) : live.now.kind;
    const weatherMeta = weatherCopy(weather);
    const wet = isWet(weather);

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

    // Weather picks: dishes that really sell more in this weather (from orders
    // with recorded real weather). Falls back to the soup/drinks rule when the
    // data has no clear signal yet.
    const liftData = await getDishWeatherLift();
    const signal = significantDishes(liftData, wet).slice(0, 6);
    let weatherReason = weatherMeta.subtitle;
    let weatherDocs: SampledMenu[] = [];
    if (signal.length >= 3) {
      for (const d of signal) {
        const [doc] = await sampleMenuItems({ name: d.dish }, 1);
        if (doc) weatherDocs.push(doc);
      }
      const top = signal[0];
      const pct = Math.round(((wet ? top.lift : 1 / top.lift) - 1) * 100);
      weatherReason = `${top.dish} is ordered ${pct}% more on ${wet ? 'rainy' : 'dry'} days`;
    }
    if (weatherDocs.length < 3) weatherDocs = sampled.weatherList;
    const weatherBased = distinctByIdOrName(
      weatherDocs.map((d) => toRec(d, restaurants, { reasonTag: weather }))
    );

    // Trending: most-ordered dishes this week in the customer's township.
    const lastOrder = customerId && customerId !== 'demo-customer'
      ? await Order.findOne({ customerId })
          .sort({ createdAt: -1 })
          .select('deliveryAddress.township totals.township')
          .lean<{ deliveryAddress?: { township?: string }; totals?: { township?: string } }>()
      : null;
    const township = String(lastOrder?.deliveryAddress?.township || lastOrder?.totals?.township || '').trim() || null;
    const trend = await getTrending(township);
    const trendDocs: SampledMenu[] = [];
    for (const t of trend.dishes.slice(0, 6)) {
      const [doc] = await sampleMenuItems({ name: t.dish }, 1);
      if (doc) trendDocs.push(doc);
    }
    const trendingTitle = `Trending in ${trend.area}`;
    const trendingReason = trend.dishes[0]
      ? `${trend.dishes[0].orders} orders of ${trend.dishes[0].dish} in the last ${trend.days} days`
      : 'Popular right now';
    const trending = distinctByIdOrName(
      (trendDocs.length ? trendDocs : sampled.trendingList).map((d) =>
        toRec(d, restaurants, { reasonTag: 'trending' })
      )
    );

    const usedIds = [
      ...weatherBased.map((i) => String(i.id || '')),
      ...trending.map((i) => String(i.id || '')),
    ].filter(Boolean);

    let personalizedDocs: SampledMenu[] = [];
    // Personal lane = the same hybrid recommender as "For You" (distinct dishes).
    const model = await loadModel();
    if (model.profiles.get(customerId)?.orderCount) {
      const taken = new Set(
        [weatherBased[0], trending[0]].filter(Boolean).map((i) => i.name.toLowerCase())
      );
      for (const d of scoreDishes(model, customerId)) {
        if (personalizedDocs.length >= 6) break;
        if (taken.has(d.name.toLowerCase())) continue;
        const [doc] = await sampleMenuItems({ name: d.name }, 1);
        if (doc) personalizedDocs.push(doc);
      }
    }
    if (personalizedDocs.length < 3 && history.favoriteCategory) {
      personalizedDocs = [];
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

    const weatherFeatured = weatherItems[0] || null;
    const trendingFeatured =
      trendingItems.find((i) => i.id !== weatherFeatured?.id) || trendingItems[0] || null;
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
      liveWeather: {
        source: live.source,
        kind: live.now.kind,
        temperatureC: live.now.temperatureC,
        explored: Boolean(requestedWeather),
      },
      favoriteCategory,
      hasOrderHistory: history.hasOrderHistory,
      featured: {
        weather: {
          title: weatherMeta.title,
          reason: weatherReason,
          weather,
          item: weatherFeatured,
        },
        trending: {
          title: trendingTitle,
          reason: trendingReason,
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
        reason: weatherReason,
        weather,
        items: weatherItems.slice(0, 6),
      },
      trending: {
        label: trendingTitle,
        reason: trendingReason,
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
