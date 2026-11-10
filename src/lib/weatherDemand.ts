/**
 * Demand statistics learned from real order history: which dishes sell more
 * on wet (rainy / stormy) days, what is trending in a township, and how much
 * busier wet hours are. All results are cached because they scan many orders.
 */
import Order from '@/models/Order';
import { cacheGetOrSet } from '@/lib/ttlCache';
import { isWet, yangonHourKey } from '@/lib/weather';

const LIVE_STATUSES = { $nin: ['CANCELLED', 'REJECTED'] };
/** Minimum wet-day orders containing a dish before we trust its lift. */
const MIN_WET_ORDERS = 30;

export type DishWeatherLift = {
  dish: string;
  wetOrders: number;
  dryOrders: number;
  /** share of wet orders containing the dish ÷ share of dry orders containing it */
  lift: number;
};

export type WeatherLiftResult = {
  wetOrderCount: number;
  dryOrderCount: number;
  dishes: DishWeatherLift[];
};

/** Lift per dish on wet vs dry days (orders with a recorded weather only). */
export function getDishWeatherLift(): Promise<WeatherLiftResult> {
  return cacheGetOrSet('weather:dish-lift', 30 * 60_000, async () => {
    const [byWeather, byDish] = await Promise.all([
      Order.aggregate<{ _id: string; n: number }>([
        { $match: { status: LIVE_STATUSES, weather: { $in: ['Sunny', 'Cloudy', 'Rainy', 'Stormy'] } } },
        { $group: { _id: '$weather', n: { $sum: 1 } } },
      ]),
      Order.aggregate<{ _id: { dish: string; weather: string }; n: number }>([
        { $match: { status: LIVE_STATUSES, weather: { $in: ['Sunny', 'Cloudy', 'Rainy', 'Stormy'] } } },
        { $project: { weather: 1, dishes: { $setUnion: ['$items.name', []] } } },
        { $unwind: '$dishes' },
        { $group: { _id: { dish: '$dishes', weather: '$weather' }, n: { $sum: 1 } } },
      ]),
    ]);
    let wetOrderCount = 0;
    let dryOrderCount = 0;
    for (const r of byWeather) {
      if (isWet(r._id)) wetOrderCount += r.n;
      else dryOrderCount += r.n;
    }
    const counts = new Map<string, { wet: number; dry: number }>();
    for (const r of byDish) {
      const dish = String(r._id.dish || '').trim();
      if (!dish) continue;
      const c = counts.get(dish) || { wet: 0, dry: 0 };
      if (isWet(r._id.weather)) c.wet += r.n;
      else c.dry += r.n;
      counts.set(dish, c);
    }
    const dishes: DishWeatherLift[] = [];
    for (const [dish, c] of counts) {
      if (!wetOrderCount || !dryOrderCount || !c.dry) continue;
      dishes.push({
        dish,
        wetOrders: c.wet,
        dryOrders: c.dry,
        lift: Number(((c.wet / wetOrderCount) / (c.dry / dryOrderCount)).toFixed(3)),
      });
    }
    dishes.sort((a, b) => b.lift - a.lift);
    return { wetOrderCount, dryOrderCount, dishes };
  });
}

/**
 * Dishes whose lift is meaningful for the given weather: for wet weather,
 * lift ≥ 1.1; for dry weather, lift ≤ 0.9 (they sell relatively more when dry).
 * Requires enough wet-day orders to avoid chasing noise.
 */
export function significantDishes(result: WeatherLiftResult, wet: boolean): DishWeatherLift[] {
  return result.dishes
    .filter((d) => d.wetOrders + d.dryOrders >= MIN_WET_ORDERS * 2 && d.wetOrders >= (wet ? MIN_WET_ORDERS : 0))
    .filter((d) => (wet ? d.lift >= 1.1 : d.lift > 0 && d.lift <= 0.9))
    .sort((a, b) => (wet ? b.lift - a.lift : a.lift - b.lift));
}

export type TrendingResult = {
  area: string;
  days: number;
  dishes: Array<{ dish: string; orders: number }>;
};

/** Top dishes in a township over the last 7 days (falls back to all of Yangon). */
export function getTrending(township: string | null): Promise<TrendingResult> {
  const key = `weather:trending:${township || 'all'}`;
  return cacheGetOrSet(key, 10 * 60_000, async () => {
    const run = async (area: string | null, days: number) => {
      const since = new Date(Date.now() - days * 86_400_000);
      const match: Record<string, unknown> = { status: LIVE_STATUSES, createdAt: { $gte: since } };
      if (area) {
        match.$or = [{ 'deliveryAddress.township': area }, { 'totals.township': area }];
      }
      const rows = await Order.aggregate<{ _id: string; orders: number }>([
        { $match: match },
        { $project: { dishes: { $setUnion: ['$items.name', []] } } },
        { $unwind: '$dishes' },
        { $group: { _id: '$dishes', orders: { $sum: 1 } } },
        { $sort: { orders: -1 } },
        { $limit: 8 },
      ]);
      return rows.map((r) => ({ dish: String(r._id), orders: r.orders }));
    };
    if (township) {
      const local = await run(township, 7);
      if (local.length >= 3) return { area: township, days: 7, dishes: local };
    }
    const city = await run(null, 7);
    if (city.length >= 3) return { area: 'Yangon', days: 7, dishes: city };
    return { area: 'Yangon', days: 30, dishes: await run(null, 30) };
  });
}

export type RainDemand = {
  wetHours: number;
  dryHours: number;
  ordersPerWetHour: number;
  ordersPerDryHour: number;
  /** e.g. 0.18 = 18% more orders per hour when it rains */
  uplift: number | null;
};

/** Orders per active hour when wet vs dry, over the last 90 days. */
export function getRainDemand(): Promise<RainDemand> {
  return cacheGetOrSet('weather:rain-demand', 30 * 60_000, async () => {
    const since = new Date(Date.now() - 90 * 86_400_000);
    const rows = await Order.find({
      status: LIVE_STATUSES,
      createdAt: { $gte: since },
      weather: { $in: ['Sunny', 'Cloudy', 'Rainy', 'Stormy'] },
    })
      .select('createdAt weather')
      .lean<Array<{ createdAt: Date; weather: string }>>();
    const wetHours = new Map<string, number>();
    const dryHours = new Map<string, number>();
    for (const r of rows) {
      const k = yangonHourKey(new Date(r.createdAt));
      const bucket = isWet(r.weather) ? wetHours : dryHours;
      bucket.set(k, (bucket.get(k) || 0) + 1);
    }
    const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    const perWet = wetHours.size ? sum(wetHours) / wetHours.size : 0;
    const perDry = dryHours.size ? sum(dryHours) / dryHours.size : 0;
    const enough = wetHours.size >= 20 && dryHours.size >= 20 && perDry > 0;
    return {
      wetHours: wetHours.size,
      dryHours: dryHours.size,
      ordersPerWetHour: Number(perWet.toFixed(2)),
      ordersPerDryHour: Number(perDry.toFixed(2)),
      uplift: enough ? Number((perWet / perDry - 1).toFixed(3)) : null,
    };
  });
}
