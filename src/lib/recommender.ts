/**
 * Hybrid food recommender built from order history.
 *
 * Each candidate dish gets five scores in [0, 1], combined with fixed weights:
 *   - collaborative: item-to-item cosine similarity ("people who order X also order Y")
 *   - category:      share of the customer's past dishes in this dish's category
 *   - repeat:        how often the customer ordered this dish vs. their top dish
 *   - popularity:    recent order volume across all customers
 *   - price:         closeness to the customer's usual item price
 * New customers (no history) fall back to popularity only.
 */
import { yangonParts } from '@/lib/yangonTime';

export type InteractionOrder = {
  customerId: string;
  createdAt: Date;
  restaurantId?: string;
  restaurantName?: string;
  total?: number;
  items: Array<{ name?: string; category?: string; unitPrice?: number; price?: number; quantity?: number }>;
};

export const WEIGHTS = {
  collaborative: 0.35,
  category: 0.2,
  repeat: 0.2,
  popularity: 0.15,
  price: 0.1,
} as const;

export type ComponentKey = keyof typeof WEIGHTS;

type DishMeta = { key: string; name: string; category: string; medianPrice: number };

export type CustomerProfile = {
  orderCount: number;
  dishCounts: Map<string, number>;
  categoryShare: Map<string, number>;
  avgItemPrice: number;
  avgOrderValue: number;
  hourCounts: number[];
  restaurantCounts: Map<string, { name: string; count: number }>;
};

export type RecommenderModel = {
  dishes: Map<string, DishMeta>;
  profiles: Map<string, CustomerProfile>;
  /** dish → set of customers who ordered it */
  dishCustomers: Map<string, Set<string>>;
  /** "a|b" (a < b) → Σ over customers of log(1+count_a)·log(1+count_b) */
  dots: Map<string, number>;
  /** dish → L2 norm of its customer vector */
  norms: Map<string, number>;
  popularity: Map<string, number>;
  maxPopularity: number;
  popularityWindowDays: number | null;
};

export type ScoredDish = {
  key: string;
  name: string;
  category: string;
  score: number;
  components: Record<ComponentKey, number>;
  contributions: Record<ComponentKey, number>;
  /** dish that most drives the collaborative score */
  becauseOf?: string;
};

export function dishKey(name: unknown) {
  return String(name || '').trim().toLowerCase();
}

function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function buildModel(orders: InteractionOrder[]): RecommenderModel {
  const dishNames = new Map<string, Map<string, number>>();
  const dishCategories = new Map<string, Map<string, number>>();
  const dishPrices = new Map<string, number[]>();
  const profiles = new Map<string, CustomerProfile>();
  const dishCustomers = new Map<string, Set<string>>();

  let latest = 0;
  for (const o of orders) latest = Math.max(latest, new Date(o.createdAt).getTime());

  // Popularity over the last 30 days of data (relative to the newest order, so
  // historical datasets still work); falls back to all-time if too sparse.
  const windowStart = latest - 30 * 86_400_000;
  const recentPop = new Map<string, number>();
  const allPop = new Map<string, number>();

  const itemPriceSums = new Map<string, { sum: number; n: number; orderTotal: number }>();

  for (const o of orders) {
    const cid = o.customerId;
    let profile = profiles.get(cid);
    if (!profile) {
      profile = {
        orderCount: 0,
        dishCounts: new Map(),
        categoryShare: new Map(),
        avgItemPrice: 0,
        avgOrderValue: 0,
        hourCounts: new Array(24).fill(0),
        restaurantCounts: new Map(),
      };
      profiles.set(cid, profile);
    }
    profile.orderCount += 1;
    profile.hourCounts[yangonParts(new Date(o.createdAt)).hour] += 1;
    if (o.restaurantId || o.restaurantName) {
      const rk = String(o.restaurantId || o.restaurantName);
      const prev = profile.restaurantCounts.get(rk);
      profile.restaurantCounts.set(rk, {
        name: String(o.restaurantName || prev?.name || ''),
        count: (prev?.count || 0) + 1,
      });
    }

    const ps = itemPriceSums.get(cid) || { sum: 0, n: 0, orderTotal: 0 };
    ps.orderTotal += Number(o.total) || 0;

    const seenInOrder = new Set<string>();
    for (const item of o.items || []) {
      const key = dishKey(item.name);
      if (!key) continue;
      const price = Number(item.unitPrice ?? item.price) || 0;
      if (price > 0) {
        if (!dishPrices.has(key)) dishPrices.set(key, []);
        dishPrices.get(key)!.push(price);
        ps.sum += price;
        ps.n += 1;
      }
      const nameMap = dishNames.get(key) || new Map<string, number>();
      nameMap.set(String(item.name).trim(), (nameMap.get(String(item.name).trim()) || 0) + 1);
      dishNames.set(key, nameMap);
      const cat = String(item.category || 'Other');
      const catMap = dishCategories.get(key) || new Map<string, number>();
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
      dishCategories.set(key, catMap);

      if (seenInOrder.has(key)) continue;
      seenInOrder.add(key);
      profile.dishCounts.set(key, (profile.dishCounts.get(key) || 0) + 1);
      if (!dishCustomers.has(key)) dishCustomers.set(key, new Set());
      dishCustomers.get(key)!.add(cid);
      allPop.set(key, (allPop.get(key) || 0) + 1);
      if (new Date(o.createdAt).getTime() >= windowStart) {
        recentPop.set(key, (recentPop.get(key) || 0) + 1);
      }
    }
    itemPriceSums.set(cid, ps);
  }

  const dishes = new Map<string, DishMeta>();
  const topOf = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  for (const [key, names] of dishNames) {
    dishes.set(key, {
      key,
      name: topOf(names),
      category: topOf(dishCategories.get(key) || new Map()) || 'Other',
      medianPrice: Math.round(median(dishPrices.get(key) || [])),
    });
  }

  for (const [cid, profile] of profiles) {
    const ps = itemPriceSums.get(cid)!;
    profile.avgItemPrice = ps.n ? ps.sum / ps.n : 0;
    profile.avgOrderValue = profile.orderCount ? ps.orderTotal / profile.orderCount : 0;
    let totalDishes = 0;
    const cats = new Map<string, number>();
    for (const [key, count] of profile.dishCounts) {
      const cat = dishes.get(key)?.category || 'Other';
      cats.set(cat, (cats.get(cat) || 0) + count);
      totalDishes += count;
    }
    for (const [cat, n] of cats) profile.categoryShare.set(cat, totalDishes ? n / totalDishes : 0);
  }

  // Item-item cosine similarity over customer vectors weighted by
  // log(1 + times ordered), so a staple counts more than a one-off.
  const dots = new Map<string, number>();
  const normSq = new Map<string, number>();
  for (const profile of profiles.values()) {
    const entries = [...profile.dishCounts.entries()].map(([k, c]) => [k, Math.log1p(c)] as const);
    for (let i = 0; i < entries.length; i++) {
      const [ki, wi] = entries[i];
      normSq.set(ki, (normSq.get(ki) || 0) + wi * wi);
      for (let j = i + 1; j < entries.length; j++) {
        const [kj, wj] = entries[j];
        const k = pairKey(ki, kj);
        dots.set(k, (dots.get(k) || 0) + wi * wj);
      }
    }
  }
  const norms = new Map([...normSq.entries()].map(([k, v]) => [k, Math.sqrt(v)]));

  const recentTotal = [...recentPop.values()].reduce((a, b) => a + b, 0);
  const useRecent = recentTotal >= 30;
  const popularity = useRecent ? recentPop : allPop;
  const maxPopularity = Math.max(1, ...popularity.values());

  return {
    dishes,
    profiles,
    dishCustomers,
    dots,
    norms,
    popularity,
    maxPopularity,
    popularityWindowDays: useRecent ? 30 : null,
  };
}

export function similarity(model: RecommenderModel, a: string, b: string) {
  if (a === b) return 0;
  const dot = model.dots.get(pairKey(a, b)) || 0;
  if (!dot) return 0;
  const na = model.norms.get(a) || 0;
  const nb = model.norms.get(b) || 0;
  return na && nb ? dot / (na * nb) : 0;
}

/** Rank every known dish for one customer. */
export function scoreDishes(model: RecommenderModel, customerId: string): ScoredDish[] {
  const profile = model.profiles.get(customerId);
  const keys = [...model.dishes.keys()];
  const logMax = Math.log1p(model.maxPopularity);

  const raw = keys.map((key) => {
    const meta = model.dishes.get(key)!;
    const popularity = Math.log1p(model.popularity.get(key) || 0) / logMax;
    if (!profile || profile.orderCount === 0) {
      return { key, meta, cf: 0, becauseOf: undefined as string | undefined, popularity, category: 0, repeat: 0, price: 0 };
    }
    let num = 0;
    let den = 0;
    let best = 0;
    let becauseOf: string | undefined;
    for (const [owned, count] of profile.dishCounts) {
      const w = Math.log1p(count);
      den += w;
      const s = similarity(model, key, owned) * w;
      num += s;
      if (s > best) {
        best = s;
        becauseOf = owned;
      }
    }
    const cf = den ? num / den : 0;
    const category = profile.categoryShare.get(meta.category) || 0;
    const maxCount = Math.max(1, ...profile.dishCounts.values());
    const repeat = (profile.dishCounts.get(key) || 0) / maxCount;
    const avg = profile.avgItemPrice;
    const price = avg > 0 && meta.medianPrice > 0 ? Math.max(0, 1 - Math.abs(meta.medianPrice - avg) / avg) : 0;
    return { key, meta, cf, becauseOf, popularity, category, repeat, price };
  });

  const maxCf = Math.max(0, ...raw.map((r) => r.cf));
  const cold = !profile || profile.orderCount === 0;

  return raw
    .map((r) => {
      const components: Record<ComponentKey, number> = {
        collaborative: maxCf > 0 ? r.cf / maxCf : 0,
        category: r.category,
        repeat: r.repeat,
        popularity: r.popularity,
        price: r.price,
      };
      const contributions = {} as Record<ComponentKey, number>;
      let score = 0;
      for (const k of Object.keys(WEIGHTS) as ComponentKey[]) {
        const w = cold ? (k === 'popularity' ? 1 : 0) : WEIGHTS[k];
        contributions[k] = w * components[k];
        score += contributions[k];
      }
      return {
        key: r.key,
        name: r.meta.name,
        category: r.meta.category,
        score,
        components,
        contributions,
        becauseOf: r.becauseOf ? model.dishes.get(r.becauseOf)?.name : undefined,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** Rank dishes by popularity alone (baseline). */
export function popularityRanking(model: RecommenderModel): string[] {
  return [...model.dishes.keys()].sort(
    (a, b) => (model.popularity.get(b) || 0) - (model.popularity.get(a) || 0)
  );
}

/** Plain-language reasons for the top contributing signals. */
export function explain(
  model: RecommenderModel,
  customerId: string,
  dish: ScoredDish
): string[] {
  const profile = model.profiles.get(customerId);
  const ranked = (Object.keys(dish.contributions) as ComponentKey[])
    .filter((k) => dish.contributions[k] > 0.01)
    .sort((a, b) => dish.contributions[b] - dish.contributions[a])
    .slice(0, 2);
  return ranked.map((k) => {
    switch (k) {
      case 'collaborative':
        return dish.becauseOf
          ? `People who order ${dish.becauseOf} also order this`
          : 'Customers with similar taste order this';
      case 'category':
        return `${Math.round(dish.components.category * 100)}% of your dishes are ${dish.category}`;
      case 'repeat':
        return `You've ordered this ${profile?.dishCounts.get(dish.key) || 0} times`;
      case 'popularity':
        return `${model.popularity.get(dish.key) || 0} orders ${
          model.popularityWindowDays ? `in the last ${model.popularityWindowDays} days` : 'so far'
        }`;
      case 'price':
        return `Close to your usual ${Math.round((profile?.avgItemPrice || 0) / 100) * 100} Ks per dish`;
    }
  });
}

/** Seeded PRNG so the random baseline is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type EvaluationResult = {
  method: 'leave-last-order-out';
  customersEvaluated: number;
  trainOrders: number;
  dishCount: number;
  ks: number[];
  results: Array<{ name: string; hitRate: Record<number, number> }>;
};

/**
 * Hide each customer's most recent order, train on everything else, and check
 * whether any dish from the hidden order appears in the top-K list.
 */
export function evaluate(
  orders: InteractionOrder[],
  { ks = [5, 10], maxCustomers = 1500 } = {}
): EvaluationResult {
  const byCustomer = new Map<string, InteractionOrder[]>();
  for (const o of orders) {
    if (!byCustomer.has(o.customerId)) byCustomer.set(o.customerId, []);
    byCustomer.get(o.customerId)!.push(o);
  }

  const heldOut = new Map<string, Set<string>>();
  const train: InteractionOrder[] = [];
  for (const [cid, list] of byCustomer) {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (list.length >= 2 && heldOut.size < maxCustomers) {
      const last = list[list.length - 1];
      const dishes = new Set((last.items || []).map((i) => dishKey(i.name)).filter(Boolean));
      if (dishes.size) {
        heldOut.set(cid, dishes);
        train.push(...list.slice(0, -1));
        continue;
      }
    }
    train.push(...list);
  }

  const model = buildModel(train);
  const allDishes = [...model.dishes.keys()];
  const popRank = popularityRanking(model);
  const rand = mulberry32(42);
  const maxK = Math.max(...ks);

  const hits = {
    hybrid: Object.fromEntries(ks.map((k) => [k, 0])) as Record<number, number>,
    popularity: Object.fromEntries(ks.map((k) => [k, 0])) as Record<number, number>,
    random: Object.fromEntries(ks.map((k) => [k, 0])) as Record<number, number>,
  };

  for (const [cid, truth] of heldOut) {
    const hybridTop = scoreDishes(model, cid).slice(0, maxK).map((d) => d.key);
    const shuffled = [...allDishes];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (const k of ks) {
      if (hybridTop.slice(0, k).some((d) => truth.has(d))) hits.hybrid[k] += 1;
      if (popRank.slice(0, k).some((d) => truth.has(d))) hits.popularity[k] += 1;
      if (shuffled.slice(0, k).some((d) => truth.has(d))) hits.random[k] += 1;
    }
  }

  const n = heldOut.size || 1;
  const rate = (h: Record<number, number>) =>
    Object.fromEntries(ks.map((k) => [k, Number((h[k] / n).toFixed(4))])) as Record<number, number>;

  return {
    method: 'leave-last-order-out',
    customersEvaluated: heldOut.size,
    trainOrders: train.length,
    dishCount: allDishes.length,
    ks,
    results: [
      { name: 'Hybrid (FoodDash)', hitRate: rate(hits.hybrid) },
      { name: 'Most popular', hitRate: rate(hits.popularity) },
      { name: 'Random', hitRate: rate(hits.random) },
    ],
  };
}
