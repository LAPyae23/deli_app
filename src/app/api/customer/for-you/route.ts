import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import MenuItem from '@/models/MenuItem';
import RestaurantProfile from '@/models/RestaurantProfile';
import { getSession, resolveOwnId, forbidden } from '@/lib/auth';
import { loadModel } from '@/lib/recommenderData';
import { WEIGHTS, explain, scoreDishes } from '@/lib/recommender';

const MAX_RESULTS = 8;

type MenuDoc = {
  _id: unknown;
  name: string;
  price: number;
  image?: string;
  imageAlt?: string;
  restaurantId: string;
  rating?: number | null;
};

type RestaurantDoc = {
  restaurantId: string;
  restaurantName?: string;
  description?: string;
  address?: string;
  logoImage?: string;
  coverImage?: string;
  storeStatus?: string;
  approvalStatus?: string;
  openingTime?: string;
  closingTime?: string;
  rating?: number | null;
  reviewCount?: number;
  location?: { lat?: number; lng?: number };
};

/**
 * GET /api/customer/for-you
 * Personal recommendations with a per-signal score breakdown, plus the
 * customer's taste profile computed from their own orders.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = resolveOwnId(getSession(request), searchParams.get('customerId'), 'CUSTOMER');
    if (!customerId) return forbidden('Customer account required');

    await dbConnect();
    const model = await loadModel();
    const profile = model.profiles.get(customerId);

    // --- Taste profile -------------------------------------------------------
    let tasteProfile = null;
    if (profile && profile.orderCount > 0) {
      const categories = [...profile.categoryShare.entries()]
        .map(([category, share]) => ({ category, share: Number(share.toFixed(4)) }))
        .sort((a, b) => b.share - a.share);
      const favoriteHour = profile.hourCounts.indexOf(Math.max(...profile.hourCounts));
      const topRestaurant = [...profile.restaurantCounts.values()].sort((a, b) => b.count - a.count)[0] || null;
      const topDishes = [...profile.dishCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key, count]) => ({ name: model.dishes.get(key)?.name || key, count }));
      tasteProfile = {
        orderCount: profile.orderCount,
        categories,
        avgItemPrice: Math.round(profile.avgItemPrice),
        avgOrderValue: Math.round(profile.avgOrderValue),
        favoriteHour,
        hourCounts: profile.hourCounts,
        topRestaurant,
        topDishes,
      };
    }

    // --- Recommendations -----------------------------------------------------
    const ranked = scoreDishes(model, customerId).slice(0, 30);
    const names = [...new Set(ranked.map((d) => d.name))];
    const menuDocs = await MenuItem.find({
      name: { $in: names },
      isAvailable: true,
      stockQuantity: { $gt: 0 },
    })
      .select('name price image imageAlt restaurantId rating')
      .lean<MenuDoc[]>();

    const restaurantIds = [...new Set(menuDocs.map((m) => String(m.restaurantId)))];
    const restaurants = await RestaurantProfile.find({ restaurantId: { $in: restaurantIds } })
      .select('restaurantId restaurantName description address logoImage coverImage storeStatus approvalStatus openingTime closingTime rating reviewCount location')
      .lean<RestaurantDoc[]>();
    const restaurantById = new Map(restaurants.map((r) => [String(r.restaurantId), r]));
    const favoriteRestaurants = new Map(
      [...(profile?.restaurantCounts.entries() || [])].map(([id, v]) => [id, v.count])
    );

    // For each dish pick one concrete menu item: a restaurant the customer
    // already likes first, then open restaurants, then the best rated.
    const byName = new Map<string, MenuDoc[]>();
    for (const m of menuDocs) {
      const key = m.name.trim().toLowerCase();
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(m);
    }
    const rankItem = (m: MenuDoc) => {
      const r = restaurantById.get(String(m.restaurantId));
      const fav = favoriteRestaurants.get(String(m.restaurantId)) || 0;
      const open = String(r?.storeStatus || 'OPEN').toUpperCase() === 'OPEN' ? 1 : 0;
      return fav * 100 + open * 10 + (Number(r?.rating) || 0);
    };

    const usedRestaurants = new Map<string, number>();
    const recommendations = [];
    for (const dish of ranked) {
      const options = (byName.get(dish.key) || []).filter(
        (m) => restaurantById.get(String(m.restaurantId))?.approvalStatus !== 'REJECTED'
      );
      if (!options.length) continue;
      // Light diversity: avoid showing more than two picks from one restaurant.
      options.sort((a, b) => rankItem(b) - rankItem(a));
      const item =
        options.find((m) => (usedRestaurants.get(String(m.restaurantId)) || 0) < 2) || options[0];
      const rid = String(item.restaurantId);
      usedRestaurants.set(rid, (usedRestaurants.get(rid) || 0) + 1);
      recommendations.push({
        dish: dish.name,
        category: dish.category,
        score: Number(dish.score.toFixed(4)),
        components: Object.fromEntries(
          Object.entries(dish.components).map(([k, v]) => [k, Number(v.toFixed(4))])
        ),
        contributions: Object.fromEntries(
          Object.entries(dish.contributions).map(([k, v]) => [k, Number(v.toFixed(4))])
        ),
        reasons: explain(model, customerId, dish),
        item: {
          _id: String(item._id),
          name: item.name,
          price: item.price,
          image: item.image || '',
          imageAlt: item.imageAlt || item.name,
          restaurantId: rid,
          restaurantName: restaurantById.get(rid)?.restaurantName || '',
        },
        restaurant: restaurantById.get(rid) || null,
      });
      if (recommendations.length >= MAX_RESULTS) break;
    }

    return NextResponse.json({
      success: true,
      coldStart: !tasteProfile,
      tasteProfile,
      recommendations,
      weights: WEIGHTS,
      model: {
        orders: [...model.profiles.values()].reduce((s, p) => s + p.orderCount, 0),
        customers: model.profiles.size,
        dishes: model.dishes.size,
        popularityWindowDays: model.popularityWindowDays,
      },
    });
  } catch (error) {
    console.error('For You GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load recommendations' },
      { status: 500 }
    );
  }
}
