import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RestaurantProfile from '@/models/RestaurantProfile';
import { getDishImage } from '@/lib/dishImages';
import {
  favoriteFromOrderHistory,
  pickWeather,
  sampleDistinctPicks,
  sampleMenuItems,
  weatherCopy,
  type SampledMenu,
} from '@/lib/aiPicksSample';

function toItem(doc: SampledMenu | null, restaurants: Map<string, string>) {
  if (!doc) return null;
  return {
    id: doc._id,
    name: doc.name,
    category: doc.category,
    price: doc.price,
    restaurantId: doc.restaurantId,
    restaurantName: doc.restaurantId
      ? restaurants.get(doc.restaurantId)
      : undefined,
    image: doc.image || getDishImage(doc.name),
    imageAlt: doc.imageAlt || doc.name,
  };
}

export async function GET(request: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const weather = pickWeather(searchParams.get('weather'));
    const customerId = searchParams.get('customerId')?.trim() || '';

    const restaurantDocs = await RestaurantProfile.find({})
      .select('restaurantId restaurantName')
      .lean();
    const restaurants = new Map<string, string>();
    for (const r of restaurantDocs) {
      const id = String(r.restaurantId || '');
      if (id) restaurants.set(id, String(r.restaurantName || ''));
    }

    const sampled = await sampleDistinctPicks(weather);
    const weatherMeta = weatherCopy(weather);
    const history = await favoriteFromOrderHistory(customerId);

    let recommendedItem: SampledMenu | null = sampled.recommendedItem;
    let recommendedSubtitle = 'A fresh pick from the menu';
    if (history.favoriteCategory) {
      const used = [
        sampled.weatherItem?._id,
        sampled.trendingItem?._id,
      ].filter((id): id is string => Boolean(id));
      const favItems = await sampleMenuItems(
        { category: history.favoriteCategory },
        1,
        used
      );
      if (favItems[0]) recommendedItem = favItems[0];
      recommendedSubtitle = `Based on your past orders · you order a lot of ${history.favoriteCategory}`;
    }

    const picks = [
      {
        type: 'weather' as const,
        title: weatherMeta.title,
        subtitle: weatherMeta.subtitle,
        item: toItem(sampled.weatherItem, restaurants),
      },
      {
        type: 'trending' as const,
        title: 'Trending in Hlaing',
        subtitle: 'Popular Fast Food right now',
        item: toItem(sampled.trendingItem, restaurants),
      },
      {
        type: 'recommended' as const,
        title: 'Recommended for You',
        subtitle: recommendedSubtitle,
        item: toItem(recommendedItem, restaurants),
      },
    ];

    return NextResponse.json({
      success: true,
      customerId,
      weather,
      picks,
    });
  } catch (error) {
    console.error('AI picks GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load AI picks' },
      { status: 500 }
    );
  }
}
