import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import MenuItem from '@/models/MenuItem';

type OrderItemLike = {
  id?: string;
  name?: string;
  category?: string;
  price?: number;
  unitPrice?: number;
  quantity?: number;
  restaurantName?: string;
  image?: string;
};

export type BasketRecommendation = {
  id: string;
  itemId: string;
  name: string;
  category: string;
  price: number;
  unitPrice: number;
  image?: string;
  restaurantName?: string;
  /** Share of analyzed orders containing both seed and this item */
  support: number;
  /** P(this | seed) from co-occurrence */
  confidence: number;
  /** confidence / P(this) */
  lift: number;
  coOccurrence: number;
  pairedWith: string;
  /** Explainable AI rationale for the suggestion */
  explanation: string;
};

function formatHourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${suffix}`;
}

function buildExplanation(opts: {
  recommendedName: string;
  seedName: string;
  confidence: number;
  hour?: number | null;
}): string {
  const pct = Math.round(opts.confidence * 100);
  const timePart =
    opts.hour != null && Number.isFinite(opts.hour)
      ? ` at ${formatHourLabel(Math.round(opts.hour))}`
      : '';
  return `Based on your recent purchase of ${opts.seedName}${timePart} (Apriori Rule: ${pct}% Confidence)`;
}

function normalizeName(raw?: string): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function displayName(raw?: string): string {
  const s = String(raw || '').trim().replace(/\s+/g, ' ');
  return s || 'Item';
}

function normalizeCategory(raw?: string): string {
  const value = String(raw || '').trim();
  return value || 'Fast Food';
}

function parseList(param: string | null): string[] {
  if (!param) return [];
  return param
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Market Basket / Apriori-style co-occurrence recommendations.
 *
 * GET /api/recommendations
 *   ?item=Mohinga
 *   &items=Mohinga,Burger
 *   &itemId=<menuObjectId>
 *   &category=Burmese
 *   &limit=6
 */
export async function GET(request: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      12,
      Math.max(1, Number(searchParams.get('limit')) || 6)
    );

    const seedNames = new Set<string>();
    const seedDisplay = new Map<string, string>();

    for (const name of [
      ...parseList(searchParams.get('item')),
      ...parseList(searchParams.get('items')),
      ...parseList(searchParams.get('name')),
    ]) {
      const key = normalizeName(name);
      if (!key) continue;
      seedNames.add(key);
      seedDisplay.set(key, displayName(name));
    }

    const itemId = searchParams.get('itemId')?.trim();
    if (itemId) {
      const menuDoc = await MenuItem.findById(itemId).select('name category').lean();
      if (menuDoc?.name) {
        const key = normalizeName(menuDoc.name);
        seedNames.add(key);
        seedDisplay.set(key, displayName(menuDoc.name));
      }
    }

    const categoryFilter = searchParams.get('category')?.trim();

    // Sample recent delivered/completed-ish orders for association mining
    const orders = await Order.find({
      status: { $in: ['DELIVERED', 'PREPARING', 'OUT_FOR_DELIVERY', 'READY', 'PENDING'] },
    })
      .select('items createdAt')
      .sort({ createdAt: -1 })
      .limit(8000)
      .lean();

    const itemCounts = new Map<string, number>();
    const pairCounts = new Map<string, number>();
    /** Typical purchase hour (0–23) per item from orders that contain it */
    const hourSum = new Map<string, number>();
    const hourN = new Map<string, number>();
    /** Best catalog snapshot per normalized name */
    const catalog = new Map<
      string,
      {
        name: string;
        category: string;
        price: number;
        image?: string;
        restaurantName?: string;
        id?: string;
      }
    >();

    let orderBaskets = 0;

    for (const order of orders) {
      const rawItems = Array.isArray(order.items)
        ? (order.items as OrderItemLike[])
        : [];

      const created = order.createdAt ? new Date(order.createdAt as Date) : null;
      const hour =
        created && !Number.isNaN(created.getTime()) ? created.getHours() : null;

      const unique = new Map<string, OrderItemLike>();
      for (const item of rawItems) {
        const key = normalizeName(item.name);
        if (!key) continue;
        if (!unique.has(key)) unique.set(key, item);

        const existing = catalog.get(key);
        const price = Number(item.price ?? item.unitPrice) || 0;
        if (
          !existing ||
          (price > 0 && (!existing.price || price < existing.price)) ||
          (!existing.image && item.image)
        ) {
          catalog.set(key, {
            name: displayName(item.name),
            category: normalizeCategory(item.category),
            price: price || existing?.price || 0,
            image: item.image || existing?.image,
            restaurantName: item.restaurantName || existing?.restaurantName,
            id: item.id || existing?.id,
          });
        }
      }

      const keys = Array.from(unique.keys());
      if (keys.length === 0) continue;
      orderBaskets += 1;

      for (const key of keys) {
        itemCounts.set(key, (itemCounts.get(key) || 0) + 1);
        if (hour != null) {
          hourSum.set(key, (hourSum.get(key) || 0) + hour);
          hourN.set(key, (hourN.get(key) || 0) + 1);
        }
      }

      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const a = keys[i];
          const b = keys[j];
          const pairKey = a < b ? `${a}||${b}` : `${b}||${a}`;
          pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
        }
      }
    }

    const typicalHour = (key: string): number | null => {
      const n = hourN.get(key) || 0;
      if (n <= 0) return null;
      return (hourSum.get(key) || 0) / n;
    };

    // If no seeds provided but category is, use top items in that category as seeds
    if (seedNames.size === 0 && categoryFilter) {
      const inCat = Array.from(catalog.entries())
        .filter(([, v]) => v.category === categoryFilter)
        .sort(
          (a, b) => (itemCounts.get(b[0]) || 0) - (itemCounts.get(a[0]) || 0)
        )
        .slice(0, 3);
      for (const [key, meta] of inCat) {
        seedNames.add(key);
        seedDisplay.set(key, meta.name);
      }
    }

    if (seedNames.size === 0) {
      return NextResponse.json({
        success: true,
        recommendations: [] as BasketRecommendation[],
        meta: {
          orderBaskets,
          message: 'Provide item, items, itemId, or category',
        },
      });
    }

    type Cand = BasketRecommendation & { score: number };
    const candidates = new Map<string, Cand>();

    for (const seed of seedNames) {
      const seedCount = itemCounts.get(seed) || 0;
      if (seedCount === 0) continue;

      for (const [pairKey, coOccurrence] of pairCounts.entries()) {
        const [a, b] = pairKey.split('||');
        let other: string | null = null;
        if (a === seed) other = b;
        else if (b === seed) other = a;
        if (!other || seedNames.has(other)) continue;

        const otherCount = itemCounts.get(other) || 0;
        if (otherCount === 0 || orderBaskets === 0) continue;

        const support = coOccurrence / orderBaskets;
        const confidence = coOccurrence / seedCount;
        const lift = confidence / (otherCount / orderBaskets);
        // Rank by confidence with a mild lift boost (classic association usefulness)
        const score = confidence * 0.7 + Math.min(lift, 5) * 0.15 + support * 0.15;

        const meta = catalog.get(other);
        if (!meta) continue;

        const seedLabel = seedDisplay.get(seed) || seed;
        const itemId = meta.id || `rec-${other.replace(/\s+/g, '-')}`;
        const explanation = buildExplanation({
          recommendedName: meta.name,
          seedName: seedLabel,
          confidence,
          hour: typicalHour(seed),
        });

        const prev = candidates.get(other);
        if (!prev || score > prev.score) {
          candidates.set(other, {
            id: itemId,
            itemId,
            name: meta.name,
            category: meta.category,
            price: meta.price,
            unitPrice: meta.price,
            image: meta.image,
            restaurantName: meta.restaurantName,
            support: Number(support.toFixed(4)),
            confidence: Number(confidence.toFixed(4)),
            lift: Number(lift.toFixed(3)),
            coOccurrence,
            pairedWith: seedLabel,
            explanation,
            score,
          });
        }
      }
    }

    // Enrich prices/images from MenuItem when available
    const recNames = Array.from(candidates.values()).map((c) => c.name);
    if (recNames.length > 0) {
      const menuMatches = await MenuItem.find({
        name: { $in: recNames },
      })
        .select('name price discountPrice image restaurantId')
        .limit(40)
        .lean();

      const byName = new Map(
        menuMatches.map((m) => [normalizeName(m.name), m] as const)
      );

      for (const [key, cand] of candidates.entries()) {
        const m = byName.get(key);
        if (!m) continue;
        const price = Number(m.discountPrice ?? m.price) || cand.price;
        const itemId = String(m._id);
        candidates.set(key, {
          ...cand,
          id: itemId,
          itemId,
          price,
          unitPrice: price,
          image: m.image || cand.image,
        });
      }
    }

    const recommendations = Array.from(candidates.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score: _score, ...rest }) => rest);

    return NextResponse.json({
      success: true,
      recommendations,
      meta: {
        orderBaskets,
        seeds: Array.from(seedDisplay.values()),
        pairRulesScanned: pairCounts.size,
      },
    });
  } catch (error) {
    console.error('Recommendations GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to build market-basket recommendations' },
      { status: 500 }
    );
  }
}
