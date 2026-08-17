/**
 * FoodDash — Bulk Historical Orders Seeder (ML-ready)
 *
 * Inserts exactly 10,000 orders with:
 *   • Linear Regression — durationMins ≈ prepTime + distanceKm×4 + variance
 *   • Market Basket    — frequent item pairings for Apriori
 *   • RFM / Churn      — VIP (15+) vs Sleeping Beauty (1 order ~5 mo ago)
 *   • Statuses         — 85% DELIVERED / 10% CANCELLED / 5% REJECTED
 *   • Township skew    — ~50% Insein (RED) · ~25% North Dagon+Bahan · ~5% South Dagon
 *
 * Drop-offs are jittered near the chosen restaurant lat/lng (Yangon bboxes).
 *
 * Prerequisites: run `npm run seed` first so profiles exist.
 *
 * Run: npm run seed:bulk-orders
 * Optional: BULK_ORDER_BATCH_SIZE=1000 npm run seed:bulk-orders
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import { calculateOrderPricing } from '../src/lib/orderPricing';

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'));
loadEnvFile(resolve(process.cwd(), '.env'));

const TOTAL_ORDERS = 10_000;
/** Keep batches small enough to avoid OOM; 500 or 1000 both work — default 500. */
const BATCH_SIZE = Number(process.env.BULK_ORDER_BATCH_SIZE) === 1000 ? 1000 : 500;

type TownshipName =
  | 'Insein'
  | 'South Dagon'
  | 'Hlaing'
  | 'Kamaryut'
  | 'Bahan'
  | 'Yankin'
  | 'Mingaladon'
  | 'North Dagon'
  | 'Mayangone'
  | 'Thingangyun';

const TOWNSHIP_CENTERS: Record<TownshipName, { lat: number; lng: number }> = {
  Insein: { lat: 16.895, lng: 96.095 },
  'South Dagon': { lat: 16.825, lng: 96.22 },
  Hlaing: { lat: 16.845, lng: 96.12 },
  Kamaryut: { lat: 16.83, lng: 96.13 },
  Bahan: { lat: 16.81, lng: 96.15 },
  Yankin: { lat: 16.84, lng: 96.16 },
  Mingaladon: { lat: 16.925, lng: 96.135 },
  'North Dagon': { lat: 16.865, lng: 96.195 },
  Mayangone: { lat: 16.87, lng: 96.155 },
  Thingangyun: { lat: 16.835, lng: 96.185 },
};

/** Remaining 20% after Insein / North Dagon+Bahan / South Dagon quotas */
const REST_TOWNSHIPS: TownshipName[] = [
  'Hlaing',
  'Kamaryut',
  'Yankin',
  'Mingaladon',
  'Mayangone',
  'Thingangyun',
];

const WEATHER = ['Sunny', 'Rainy', 'Cloudy', 'Stormy'] as const;
const PAYMENT_METHODS = ['cash', 'wallet', 'card'] as const;
const CATEGORIES = ['Fast Food', 'Burmese', 'Drinks', 'Dessert'] as const;

const REAL_FOOD_IMAGES = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1484723091791-0fee5969da8b?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
];

const REAL_RESTAURANT_IMAGES = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1466978913421-bac2e5875461?auto=format&fit=crop&w=800&q=80',
];

function uiAvatar(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=200`;
}

/** Apriori-friendly catalog — fixed names so association rules stay clear */
const CATALOG: Array<{
  name: string;
  category: (typeof CATEGORIES)[number];
  price: number;
}> = [
  { name: 'Mohinga', category: 'Burmese', price: 3500 },
  { name: 'Fritters', category: 'Burmese', price: 1500 },
  { name: 'Shan Noodles', category: 'Burmese', price: 4000 },
  { name: 'Milk Tea', category: 'Drinks', price: 1500 },
  { name: 'Burger', category: 'Fast Food', price: 4800 },
  { name: 'Fries', category: 'Fast Food', price: 2000 },
  { name: 'Chicken Burger', category: 'Fast Food', price: 5000 },
  { name: 'Cola', category: 'Drinks', price: 1200 },
  { name: 'Fried Rice', category: 'Fast Food', price: 3200 },
  { name: 'Lahpet Yay', category: 'Drinks', price: 1000 },
  { name: 'Kyay Oh', category: 'Burmese', price: 4500 },
  { name: 'Fried Egg', category: 'Fast Food', price: 800 },
  { name: 'Shwe Yin Aye', category: 'Dessert', price: 2800 },
  { name: 'Mont Lone Yay Paw', category: 'Dessert', price: 2500 },
  { name: 'Lahpet Thoke', category: 'Burmese', price: 3000 },
  { name: 'Fried Chicken', category: 'Fast Food', price: 4200 },
];

/**
 * High-support baskets for Apriori (clear association support).
 * ~55% of orders intentionally include one of these full pairings.
 */
const ASSOCIATION_BUNDLES: string[][] = [
  ['Mohinga', 'Fritters'],
  ['Mohinga', 'Fritters', 'Lahpet Yay'],
  ['Burger', 'Fries'],
  ['Burger', 'Fries', 'Cola'],
  ['Shan Noodles', 'Milk Tea'],
  ['Chicken Burger', 'Cola'],
  ['Fried Rice', 'Lahpet Yay'],
  ['Kyay Oh', 'Fried Egg'],
  ['Fried Chicken', 'Cola'],
  ['Lahpet Thoke', 'Milk Tea'],
  ['Shwe Yin Aye', 'Mont Lone Yay Paw'],
];

const CANCEL_REASONS = [
  'Customer changed mind',
  'Restaurant out of stock',
  'No rider available',
  'Long wait time',
  'Payment failed',
];

const REJECT_REASONS = [
  'Restaurant closed',
  'Item unavailable',
  'Outside delivery zone',
  'Kitchen capacity full',
];

const REVIEW_COMMENTS = [
  'Great food, arrived hot!',
  'Rider was polite and fast.',
  'Tasty but packaging could be better.',
  'Will order again — solid value.',
  'Mohinga was perfect with fritters.',
  'Burger and fries combo hits every time.',
  'A bit late but worth the wait.',
  'Excellent portion size.',
  'Favorite spot in the township.',
];

type LeanCustomer = {
  customerId: string;
  name?: string;
  savedAddresses?: Array<{
    label?: string;
    address?: string;
    detail?: string;
    lat?: number;
    lng?: number;
  }>;
};

type LeanRestaurant = {
  restaurantId: string;
  restaurantName?: string;
  township?: string;
  location?: { lat?: number; lng?: number };
};

type LeanRider = {
  riderId: string;
  name?: string;
  vehicleType?: string;
  status?: string;
  township?: string;
  riderCoords?: { lat?: number; lng?: number };
  location?: { lat?: number; lng?: number };
};

type Persona = 'VIP' | 'SLEEPING' | 'REGULAR';

function restaurantCoordsOf(restaurant: LeanRestaurant, township: TownshipName) {
  const lat = Number(restaurant.location?.lat);
  const lng = Number(restaurant.location?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return TOWNSHIP_CENTERS[township];
}

/** Random drop-off 150–900 m from the restaurant pin, still in the same zone. */
function dropoffNearRestaurant(origin: { lat: number; lng: number }) {
  const meters = 150 + Math.random() * 750;
  const degLat = meters / 111_320;
  const degLng = meters / (111_320 * Math.cos((origin.lat * Math.PI) / 180));
  const angle = Math.random() * Math.PI * 2;
  return {
    lat: Number((origin.lat + Math.cos(angle) * degLat).toFixed(6)),
    lng: Number((origin.lng + Math.sin(angle) * degLng).toFixed(6)),
  };
}

type OrderSlot = {
  customer: LeanCustomer;
  createdAt: Date;
  persona: Persona;
  /** Final lifetime count for this customer (written to customerOrderCount) */
  customerOrderCount: number;
};

function sixMonthsAgo(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() - 6);
  return d;
}

function monthsAgo(months: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() - months);
  return d;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function normalizeTownshipName(value?: string | null): TownshipName | null {
  const t = String(value || '').trim();
  if (!t) return null;
  if (/insein/i.test(t)) return 'Insein';
  if (/south\s*dagon/i.test(t)) return 'South Dagon';
  if (/north\s*dagon/i.test(t)) return 'North Dagon';
  if (/kamaryut|kamayut/i.test(t)) return 'Kamaryut';
  if (/hlaing/i.test(t)) return 'Hlaing';
  if (/bahan/i.test(t)) return 'Bahan';
  if (/yankin/i.test(t)) return 'Yankin';
  if (/mingaladon/i.test(t)) return 'Mingaladon';
  if (/mayangone|mayangon/i.test(t)) return 'Mayangone';
  if (/thingangyun/i.test(t)) return 'Thingangyun';
  return null;
}

/**
 * Exact quotas so the heatmap / auto-surge cannot drift:
 *   50% Insein · 25% North Dagon + Bahan · 5% South Dagon · 20% other zones
 */
function buildTownshipAssignments(total: number): TownshipName[] {
  const insein = Math.round(total * 0.5);
  const southDagon = Math.round(total * 0.05);
  const northBahan = Math.round(total * 0.25);
  const bahan = Math.floor(northBahan / 2);
  const northDagon = northBahan - bahan;
  const rest = Math.max(0, total - insein - southDagon - bahan - northDagon);

  const assignments: TownshipName[] = [
    ...Array<TownshipName>(insein).fill('Insein'),
    ...Array<TownshipName>(southDagon).fill('South Dagon'),
    ...Array<TownshipName>(bahan).fill('Bahan'),
    ...Array<TownshipName>(northDagon).fill('North Dagon'),
  ];

  const restWeights = [1, 1, 1, 1, 0.4, 0.4];
  const weightSum = restWeights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < rest; i++) {
    let r = Math.random() * weightSum;
    let chosen: TownshipName = REST_TOWNSHIPS[0];
    for (let j = 0; j < REST_TOWNSHIPS.length; j++) {
      r -= restWeights[j];
      if (r <= 0) {
        chosen = REST_TOWNSHIPS[j];
        break;
      }
    }
    assignments.push(chosen);
  }

  return faker.helpers.shuffle(assignments).slice(0, total);
}

function groupByTownship<T>(
  items: T[],
  townshipOf: (item: T) => TownshipName | null
): Map<TownshipName, T[]> {
  const map = new Map<TownshipName, T[]>();
  for (const name of Object.keys(TOWNSHIP_CENTERS) as TownshipName[]) {
    map.set(name, []);
  }
  for (const item of items) {
    const name = townshipOf(item);
    if (!name) continue;
    map.get(name)!.push(item);
  }
  return map;
}

function pickFromTownship<T>(
  grouped: Map<TownshipName, T[]>,
  township: TownshipName,
  fallback: T[]
): T {
  const local = grouped.get(township);
  if (local && local.length > 0) return pick(local);
  return pick(fallback);
}


/** Status mix: 85% DELIVERED · 10% CANCELLED · 5% REJECTED */
function rollStatus(): 'DELIVERED' | 'CANCELLED' | 'REJECTED' {
  const r = Math.random();
  if (r < 0.85) return 'DELIVERED';
  if (r < 0.95) return 'CANCELLED';
  return 'REJECTED';
}

/**
 * Linear regression signal:
 *   durationMins = prepTime + (distanceKm * 4) + variance
 * distanceKm ∈ [0.5, 15]
 */
function rollTravelMetrics() {
  const distanceKm = Number(
    faker.number.float({ min: 0.5, max: 15, fractionDigits: 1 }).toFixed(1)
  );
  const prepTime = faker.number.int({ min: 10, max: 30 });
  const variance = faker.number.float({ min: -4, max: 6, fractionDigits: 1 });
  const travelMins = Math.max(1, Math.round(distanceKm * 4 + variance));
  const durationMins = Math.max(prepTime + 1, Math.round(prepTime + distanceKm * 4 + variance));
  return { distanceKm, prepTime, travelMins, durationMins, variance };
}

function catalogByName(name: string) {
  return CATALOG.find((c) => c.name === name) || CATALOG[0];
}

/** ~55% association bundles, otherwise 1–3 random catalog items */
function buildBasketItems(restaurantName: string) {
  const useBundle = Math.random() < 0.55;
  const names = useBundle
    ? [...pick(ASSOCIATION_BUNDLES)]
    : faker.helpers.arrayElements(
        CATALOG.map((c) => c.name),
        faker.number.int({ min: 1, max: 3 })
      );

  // Occasionally add one extra solo item alongside a pair (still keeps strong pair support)
  if (useBundle && Math.random() < 0.25) {
    const extra = pick(CATALOG).name;
    if (!names.includes(extra)) names.push(extra);
  }

  return names.map((name) => {
    const base = catalogByName(name);
    const quantity = faker.number.int({ min: 1, max: 3 });
    return {
      id: `ml-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name: base.name,
      category: base.category,
      price: base.price,
      quantity,
      unitPrice: base.price,
      restaurantName,
      image: faker.helpers.arrayElement(REAL_FOOD_IMAGES),
    };
  });
}

function randomRecentDate(rangeStart: Date, rangeEnd: Date): Date {
  // Bias slightly toward more recent dates (active RFM recency)
  const t0 = rangeStart.getTime();
  const t1 = rangeEnd.getTime();
  const u = Math.pow(Math.random(), 0.65);
  return new Date(t0 + u * (t1 - t0));
}

function sleepingBeautyDate(rangeEnd: Date): Date {
  // ~5 months ago ± 10 days
  const center = monthsAgo(5, rangeEnd);
  const jitterMs = faker.number.int({ min: -10, max: 10 }) * 24 * 60 * 60 * 1000;
  return new Date(center.getTime() + jitterMs);
}

/**
 * Build exactly TOTAL_ORDERS slots with RFM personas:
 *   VIP            → ≥15 orders, active across the window
 *   Sleeping Beauty → exactly 1 order ~5 months ago
 *   Regular        → remaining volume
 */
function buildOrderSlots(customers: LeanCustomer[], rangeStart: Date, rangeEnd: Date): OrderSlot[] {
  const shuffled = faker.helpers.shuffle([...customers]);
  const vipCount = Math.max(1, Math.floor(shuffled.length * 0.2));
  const sleepCount = Math.max(1, Math.floor(shuffled.length * 0.25));

  const vips = shuffled.slice(0, vipCount);
  const sleeping = shuffled.slice(vipCount, vipCount + sleepCount);
  const regulars = shuffled.slice(vipCount + sleepCount);

  const counts = new Map<string, number>();
  const slots: OrderSlot[] = [];

  const bump = (id: string, n = 1) => {
    counts.set(id, (counts.get(id) || 0) + n);
  };

  // Sleeping Beauties — single stale order
  for (const c of sleeping) {
    slots.push({
      customer: c,
      createdAt: sleepingBeautyDate(rangeEnd),
      persona: 'SLEEPING',
      customerOrderCount: 1,
    });
    bump(c.customerId, 1);
  }

  // VIPs — guaranteed 15+ base orders
  const VIP_BASE = 15;
  for (const c of vips) {
    for (let i = 0; i < VIP_BASE; i++) {
      slots.push({
        customer: c,
        createdAt: randomRecentDate(rangeStart, rangeEnd),
        persona: 'VIP',
        customerOrderCount: 0, // filled later
      });
      bump(c.customerId, 1);
    }
  }

  let remaining = TOTAL_ORDERS - slots.length;
  if (remaining < 0) {
    // Extremely small customer set edge case — trim non-sleeping
    const keepSleeping = slots.filter((s) => s.persona === 'SLEEPING');
    const others = slots.filter((s) => s.persona !== 'SLEEPING').slice(0, TOTAL_ORDERS - keepSleeping.length);
    return finalizeCounts([...keepSleeping, ...others], counts);
  }

  // Weighted pool for leftover volume (VIPs get more → stay well above 15)
  const nonSleeping = [...vips, ...regulars];
  const weightedPool: LeanCustomer[] = [
    ...vips.flatMap((c) => Array(5).fill(c) as LeanCustomer[]),
    ...regulars.flatMap((c) => Array(2).fill(c) as LeanCustomer[]),
    ...vips,
  ];

  // Ensure every regular gets at least one order when volume allows
  for (const c of regulars) {
    if (remaining <= 0) break;
    slots.push({
      customer: c,
      createdAt: randomRecentDate(rangeStart, rangeEnd),
      persona: 'REGULAR',
      customerOrderCount: 0,
    });
    bump(c.customerId, 1);
    remaining -= 1;
  }

  const fillPool = weightedPool.length > 0 ? weightedPool : nonSleeping;
  while (remaining > 0 && fillPool.length > 0) {
    const c = pick(fillPool);
    const persona: Persona = vips.some((v) => v.customerId === c.customerId)
      ? 'VIP'
      : 'REGULAR';

    slots.push({
      customer: c,
      createdAt: randomRecentDate(rangeStart, rangeEnd),
      persona,
      customerOrderCount: 0,
    });
    bump(c.customerId, 1);
    remaining -= 1;
  }

  return finalizeCounts(slots.slice(0, TOTAL_ORDERS), counts);
}

function finalizeCounts(slots: OrderSlot[], counts: Map<string, number>): OrderSlot[] {
  return slots.map((s) => ({
    ...s,
    customerOrderCount: counts.get(s.customer.customerId) || 1,
  }));
}

async function seedBulkOrders() {
  console.log('\n📦 ════════════════════════════════════════════════');
  console.log('   FoodDash — Bulk Orders (10k · Insein RED skew)');
  console.log('════════════════════════════════════════════════\n');

  try {
    const { default: dbConnect } = await import('../src/lib/mongodb');
    const { default: Order } = await import('../src/models/Order');
    const { default: CustomerProfile } = await import(
      '../src/models/CustomerProfile'
    );
    const { default: RestaurantProfile } = await import(
      '../src/models/RestaurantProfile'
    );
    const { default: RiderProfile } = await import('../src/models/RiderProfile');
    const { default: MenuItem } = await import('../src/models/MenuItem');

    await dbConnect();
    console.log('✅ Connected to MongoDB via dbConnect()\n');

    const [menuDocs, restDocs, custDocs, riderDocs] = await Promise.all([
      MenuItem.find({}).select('_id').lean(),
      RestaurantProfile.find({}).select('_id').lean(),
      CustomerProfile.find({}).select('_id name').lean(),
      RiderProfile.find({}).select('_id name').lean(),
    ]);

    if (menuDocs.length) {
      await MenuItem.bulkWrite(
        menuDocs.map((m) => ({
          updateOne: {
            filter: { _id: m._id },
            update: { $set: { image: faker.helpers.arrayElement(REAL_FOOD_IMAGES) } },
          },
        }))
      );
    }
    if (restDocs.length) {
      await RestaurantProfile.bulkWrite(
        restDocs.map((r) => ({
          updateOne: {
            filter: { _id: r._id },
            update: {
              $set: {
                logoImage: faker.helpers.arrayElement(REAL_RESTAURANT_IMAGES),
                coverImage: faker.helpers.arrayElement(REAL_RESTAURANT_IMAGES),
              },
            },
          },
        }))
      );
    }
    if (custDocs.length) {
      await CustomerProfile.bulkWrite(
        custDocs.map((c) => ({
          updateOne: {
            filter: { _id: c._id },
            update: { $set: { profileImage: uiAvatar(c.name || 'Customer') } },
          },
        }))
      );
    }
    if (riderDocs.length) {
      await RiderProfile.bulkWrite(
        riderDocs.map((r) => ({
          updateOne: {
            filter: { _id: r._id },
            update: { $set: { profileImage: uiAvatar(r.name || 'Rider') } },
          },
        }))
      );
    }
    console.log(
      `🖼  Images      : Unsplash + UI Avatars (${menuDocs.length} menus, ${restDocs.length} kitchens, ${custDocs.length} customers, ${riderDocs.length} riders)\n`
    );

    const [customers, restaurants, riders] = await Promise.all([
      CustomerProfile.find({})
        .select('customerId name savedAddresses')
        .lean<LeanCustomer[]>(),
      RestaurantProfile.find({})
        .select('restaurantId restaurantName township location')
        .lean<LeanRestaurant[]>(),
      RiderProfile.find({})
        .select('riderId name vehicleType status township riderCoords location')
        .lean<LeanRider[]>(),
    ]);

    if (customers.length === 0) {
      throw new Error('No customers found. Run `npm run seed` first.');
    }
    if (restaurants.length === 0) {
      throw new Error('No restaurants found. Run `npm run seed` first.');
    }
    if (riders.length === 0) {
      throw new Error('No riders found. Run `npm run seed` first.');
    }

    console.log(`👤 Customers   : ${customers.length}`);
    console.log(`🍽  Restaurants : ${restaurants.length}`);
    console.log(`🛵 Riders      : ${riders.length}\n`);

    const restaurantsByTownship = groupByTownship(restaurants, (r) =>
      normalizeTownshipName(r.township)
    );
    const ridersByTownship = groupByTownship(riders, (r) =>
      normalizeTownshipName(r.township)
    );

    console.log('🏙  Restaurant coverage');
    for (const name of Object.keys(TOWNSHIP_CENTERS) as TownshipName[]) {
      const n = restaurantsByTownship.get(name)?.length || 0;
      const r = ridersByTownship.get(name)?.length || 0;
      if (n === 0) {
        console.log(`   ⚠️  ${name.padEnd(16)} 0 kitchens — will fall back to any restaurant`);
      } else {
        console.log(`   ${name.padEnd(16)} ${String(n).padStart(3)} kitchens · ${r} riders`);
      }
    }
    console.log('');

    const rangeStart = sixMonthsAgo();
    const rangeEnd = new Date();
    const slots = buildOrderSlots(customers, rangeStart, rangeEnd);
    const townshipAssignments = buildTownshipAssignments(slots.length);

    const vipCustomers = new Set(
      slots.filter((s) => s.persona === 'VIP').map((s) => s.customer.customerId)
    );
    const sleepCustomers = new Set(
      slots.filter((s) => s.persona === 'SLEEPING').map((s) => s.customer.customerId)
    );

    console.log('📊 RFM personas');
    console.log(`   VIP customers            : ${vipCustomers.size} (≥15 orders each)`);
    console.log(`   Sleeping Beauty customers: ${sleepCustomers.size} (1 order ~5 mo ago)`);
    console.log(`   Planned slots            : ${slots.length.toLocaleString()}\n`);

    console.log(
      `🧾 Inserting ${slots.length.toLocaleString()} orders via Order.insertMany() in batches of ${BATCH_SIZE}…`
    );
    console.log(
      `   Date window: ${rangeStart.toISOString().slice(0, 10)} → ${rangeEnd.toISOString().slice(0, 10)}\n`
    );

    let insertedTotal = 0;
    let deliveredCount = 0;
    let cancelledCount = 0;
    let rejectedCount = 0;
    let reviewedCount = 0;
    let bundleCount = 0;
    const townshipOrderCounts = new Map<TownshipName, number>();

    const totalBatches = Math.ceil(slots.length / BATCH_SIZE);
    const seedStartedAt = Date.now();

    for (let batchStart = 0; batchStart < slots.length; batchStart += BATCH_SIZE) {
      const batchIndex = Math.floor(batchStart / BATCH_SIZE) + 1;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, slots.length);
      const batchDocs: Record<string, unknown>[] = [];
      const batchStartedAt = Date.now();

      console.log(
        `⏳ Batch ${batchIndex}/${totalBatches}: building docs ${batchStart + 1}–${batchEnd}…`
      );

      for (let index = batchStart; index < batchEnd; index++) {
        const slot = slots[index];
        const customer = slot.customer;
        const township = townshipAssignments[index] || 'Insein';
        townshipOrderCounts.set(township, (townshipOrderCounts.get(township) || 0) + 1);
        const restaurant = pickFromTownship(restaurantsByTownship, township, restaurants);
        const rider = pickFromTownship(ridersByTownship, township, riders);

        const status = rollStatus();
        if (status === 'DELIVERED') deliveredCount += 1;
        else if (status === 'CANCELLED') cancelledCount += 1;
        else rejectedCount += 1;

        const isCancelled = status === 'CANCELLED' || status === 'REJECTED';
        const assignedRider = status === 'REJECTED' && Math.random() < 0.4 ? null : rider;

        const items = buildBasketItems(restaurant.restaurantName || 'Restaurant');
        if (items.length >= 2) {
          const names = new Set(items.map((i) => i.name));
          if (
            ASSOCIATION_BUNDLES.some(
              (b) => b.length >= 2 && b.slice(0, 2).every((n) => names.has(n))
            )
          ) {
            bundleCount += 1;
          }
        }

        const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
        const deliveryFee = faker.helpers.arrayElement([1000, 1500, 2000, 2500]);
        const pricing = calculateOrderPricing({ subtotal, deliveryFee });
        const { distanceKm, prepTime, travelMins, durationMins } = rollTravelMetrics();
        const surgeChance = township === 'Insein' ? 0.55 : township === 'South Dagon' ? 0.04 : 0.2;
        const surgePrice =
          Math.random() < surgeChance
            ? faker.helpers.arrayElement(township === 'Insein' ? [1000, 1500, 2000, 2500] : [500, 1000, 1500])
            : 0;

        const createdAt = slot.createdAt;
        const completedAt = isCancelled
          ? faker.date.between({
              from: createdAt,
              to: new Date(Math.min(createdAt.getTime() + 2 * 3600_000, rangeEnd.getTime())),
            })
          : status === 'DELIVERED'
            ? new Date(
                createdAt.getTime() +
                  clamp(durationMins, 15, 120) * 60_000 +
                  faker.number.int({ min: 0, max: 20 }) * 60_000
              )
            : undefined;

        const saved =
          Array.isArray(customer.savedAddresses) && customer.savedAddresses.length > 0
            ? pick(customer.savedAddresses)
            : null;

        const restaurantCoords = restaurantCoordsOf(restaurant, township);
        const dropoff = dropoffNearRestaurant(restaurantCoords);

        const riderCoords = assignedRider
          ? {
              lat:
                assignedRider.riderCoords?.lat ??
                assignedRider.location?.lat ??
                restaurantCoords.lat,
              lng:
                assignedRider.riderCoords?.lng ??
                assignedRider.location?.lng ??
                restaurantCoords.lng,
            }
          : undefined;

        const withReview = status === 'DELIVERED' && Math.random() < 0.3;
        if (withReview) reviewedCount += 1;
        const rating = withReview ? faker.number.int({ min: 3, max: 5 }) : undefined;
        const review = withReview ? pick(REVIEW_COMMENTS) : undefined;

        batchDocs.push({
          orderNumber: `#BULK-${String(index + 1).padStart(5, '0')}`,
          restaurantId: restaurant.restaurantId,
          restaurantName: restaurant.restaurantName || 'Restaurant',
          customerId: customer.customerId,
          customerName: customer.name || 'Customer',
          status,
          prepTime,
          travelMins,
          restaurantCoords,
          riderId: assignedRider?.riderId || '',
          riderName: assignedRider?.name || '',
          riderCoords,
          items,
          totals: {
            subtotal: pricing.subtotal,
            tax: pricing.tax,
            deliveryFee: pricing.deliveryFee,
            platformFee: pricing.platformFee,
            discount: 0,
            surgePrice,
            restaurantCommission: pricing.restaurantCommission,
            restaurantCommissionRate: pricing.restaurantCommissionRate,
            total: pricing.total,
            totalAmount: pricing.totalAmount,
            riderEarning: pricing.riderEarning,
            owedAmount: pricing.owedAmount,
            township,
          },
          deliveryAddress: {
            label: saved?.label || 'Home',
            address: saved?.address || `${township} Township, Yangon`,
            detail: saved?.detail || `${township}, Yangon`,
            lat: dropoff.lat,
            lng: dropoff.lng,
            township,
          },
          paymentMethod: pick([...PAYMENT_METHODS]),
          discount: 0,
          surgePrice,
          weather: pick([...WEATHER]),
          vehicleType: assignedRider?.vehicleType || rider.vehicleType || 'Motorcycle',
          distanceKm,
          durationMins,
          customerOrderCount: slot.customerOrderCount,
          cancelReason:
            status === 'CANCELLED'
              ? pick(CANCEL_REASONS)
              : status === 'REJECTED'
                ? pick(REJECT_REASONS)
                : '',
          baseRiderFee: pricing.riderEarning,
          tipAmount:
            status === 'DELIVERED' ? faker.helpers.arrayElement([0, 500, 1000]) : 0,
          rating,
          review,
          reviewComment: review,
          restaurantRating: rating,
          riderRating: withReview
            ? clamp(rating! + faker.number.int({ min: -1, max: 1 }), 1, 5)
            : undefined,
          completedAt,
          createdAt,
          updatedAt: completedAt || createdAt,
        });
      }

      console.log(
        `   → insertMany(${batchDocs.length} docs) for batch ${batchIndex}/${totalBatches}…`
      );

      const inserted = await Order.insertMany(batchDocs, {
        ordered: false,
      });
      const batchInserted = inserted.length;
      insertedTotal += batchInserted;

      // Drop references so GC can reclaim each batch promptly
      batchDocs.length = 0;

      const batchMs = Date.now() - batchStartedAt;
      const elapsedSec = ((Date.now() - seedStartedAt) / 1000).toFixed(1);
      const pctDone = Math.round((insertedTotal / slots.length) * 100);

      console.log(
        `✅ Batch ${batchIndex}/${totalBatches} complete — inserted ${batchInserted.toLocaleString()} in ${batchMs}ms`
      );
      console.log(
        `   Progress: ${insertedTotal.toLocaleString()} / ${slots.length.toLocaleString()} (${pctDone}%) · elapsed ${elapsedSec}s\n`
      );
    }

    if (insertedTotal !== TOTAL_ORDERS) {
      throw new Error(
        `Expected ${TOTAL_ORDERS} inserts but got ${insertedTotal}. Aborting without success disconnect message.`
      );
    }

    const pct = (n: number) => ((n / Math.max(1, insertedTotal)) * 100).toFixed(1);
    const totalSec = ((Date.now() - seedStartedAt) / 1000).toFixed(1);

    console.log('🎉 ════════════════════════════════════════════════');
    console.log('   Bulk order seed complete (ML rules applied)');
    console.log('────────────────────────────────────────────────');
    console.log(`   🧾 Orders inserted : ${insertedTotal.toLocaleString()} (verified)`);
    console.log(`   ⏱  Total time      : ${totalSec}s`);
    console.log(`   📦 Batch size      : ${BATCH_SIZE} (${totalBatches} batches)`);
    console.log(
      `   ✅ DELIVERED       : ${deliveredCount.toLocaleString()} (${pct(deliveredCount)}%)`
    );
    console.log(
      `   🚫 CANCELLED       : ${cancelledCount.toLocaleString()} (${pct(cancelledCount)}%)`
    );
    console.log(
      `   ❌ REJECTED        : ${rejectedCount.toLocaleString()} (${pct(rejectedCount)}%)`
    );
    console.log(
      `   ⭐ With reviews    : ${reviewedCount.toLocaleString()} (~${pct(reviewedCount)}% of all / ~30% of delivered target)`
    );
    console.log(`   🧺 Bundle baskets  : ${bundleCount.toLocaleString()} (Apriori pairs)`);
    console.log(`   👑 VIP customers   : ${vipCustomers.size}`);
    console.log(`   💤 Sleeping Beauty : ${sleepCustomers.size}`);
    console.log('   📈 durationMins    = prepTime + distanceKm×4 + variance');
    console.log('   📍 Drop-offs       : jittered 150–900m from restaurant pins');
    console.log('────────────────────────────────────────────────');
    console.log('   Township distribution (target 50 / 25 / 5 / 20)');
    const townshipOrder = [
      'Insein',
      'North Dagon',
      'Bahan',
      'South Dagon',
      ...REST_TOWNSHIPS,
    ] as TownshipName[];
    for (const name of townshipOrder) {
      const n = townshipOrderCounts.get(name) || 0;
      const share = ((n / Math.max(1, insertedTotal)) * 100).toFixed(1);
      const tag =
        name === 'Insein'
          ? '🔴 RED'
          : name === 'South Dagon'
            ? '🔵 COLD'
            : name === 'North Dagon' || name === 'Bahan'
              ? '🟠'
              : '  ';
      const bar = '█'.repeat(Math.max(0, Math.round(n / 120)));
      console.log(`   ${tag} ${name.padEnd(14)} ${String(n).padStart(5)}  ${share.padStart(5)}%  ${bar}`);
    }
    console.log('════════════════════════════════════════════════\n');

    console.log('🔌 All 10,000 orders inserted — disconnecting from MongoDB…');
  } catch (error) {
    console.error('\n❌ Bulk order seed failed:', error);
    process.exitCode = 1;
  } finally {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB safely');
      } else {
        console.log('🔌 MongoDB already disconnected');
      }
    } catch (disconnectError) {
      console.error('⚠️  MongoDB disconnect warning:', disconnectError);
    }
    process.exit(process.exitCode ?? 0);
  }
}

void seedBulkOrders();
