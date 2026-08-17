/**
 * FoodDash — AI Picks demo data
 *
 * Does NOT wipe the database. Safe to run on top of `npm run seed`.
 *
 *  • Patches menu item photos (dish-specific Unsplash)
 *  • Inserts today's Hlaing orders so "Trending in Hlaing" hits 50+
 *  • Adds spicy order history for customer.hlaing.1 so Recommend works
 *
 * Run: npm run seed:ai-picks
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { calculateOrderPricing } from '../src/lib/orderPricing';
import { getDishImage } from '../src/lib/dishImages';

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

const AI_ORDER_PREFIX = '#AI-';

type LeanMenu = {
  _id: { toString(): string };
  name?: string;
  category?: string;
  price?: number;
  restaurantId?: string;
};

type LeanRestaurant = {
  restaurantId: string;
  restaurantName: string;
  township?: string;
  location?: { lat?: number; lng?: number };
};

type LeanCustomer = {
  customerId: string;
  name?: string;
  email?: string;
  savedAddresses?: Array<{ address?: string; label?: string; lat?: number; lng?: number }>;
};

function yangonNowParts(now = new Date()) {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return { ymd, start: new Date(`${ymd}T00:00:00+06:30`) };
}

function buildOrder(opts: {
  index: number;
  restaurant: LeanRestaurant;
  customer: LeanCustomer;
  items: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    quantity: number;
    unitPrice: number;
    restaurantName: string;
    image?: string;
  }>;
  createdAt: Date;
  weather: 'Sunny' | 'Rainy';
}) {
  const subtotal = opts.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const pricing = calculateOrderPricing({ subtotal, deliveryFee: 2000 });
  const address = opts.customer.savedAddresses?.[0];

  return {
    orderNumber: `${AI_ORDER_PREFIX}${String(opts.index).padStart(4, '0')}`,
    restaurantId: opts.restaurant.restaurantId,
    restaurantName: opts.restaurant.restaurantName,
    customerId: opts.customer.customerId,
    customerName: opts.customer.name || 'Customer',
    status: 'DELIVERED',
    prepTime: 18,
    travelMins: 12,
    restaurantCoords: opts.restaurant.location || { lat: 16.845, lng: 96.12 },
    riderId: '',
    riderName: 'AI Picks Demo Rider',
    items: opts.items,
    totals: {
      subtotal: pricing.subtotal,
      tax: pricing.tax,
      deliveryFee: pricing.deliveryFee,
      platformFee: pricing.platformFee,
      discount: 0,
      surgePrice: 0,
      restaurantCommission: pricing.restaurantCommission,
      restaurantCommissionRate: pricing.restaurantCommissionRate,
      total: pricing.total,
      totalAmount: pricing.totalAmount,
      riderEarning: pricing.riderEarning,
      owedAmount: pricing.owedAmount,
      township: 'Hlaing',
    },
    deliveryAddress: {
      label: address?.label || 'Home',
      address: address?.address || 'Hlaing Township, Yangon',
      lat: address?.lat || 16.845,
      lng: address?.lng || 96.12,
      township: 'Hlaing',
    },
    paymentMethod: 'cash',
    discount: 0,
    surgePrice: 0,
    weather: opts.weather,
    vehicleType: 'Motorcycle',
    distanceKm: 2.4,
    durationMins: 30,
    customerOrderCount: 8,
    cancelReason: '',
    baseRiderFee: pricing.riderEarning,
    tipAmount: 500,
    completedAt: opts.createdAt,
    createdAt: opts.createdAt,
    updatedAt: opts.createdAt,
  };
}

async function seedAiPicks() {
  console.log('\n✨ ════════════════════════════════════════════════');
  console.log('   FoodDash — AI Picks demo data');
  console.log('════════════════════════════════════════════════\n');

  const { default: dbConnect } = await import('../src/lib/mongodb');
  const { default: MenuItem } = await import('../src/models/MenuItem');
  const { default: RestaurantProfile } = await import(
    '../src/models/RestaurantProfile'
  );
  const { default: CustomerProfile } = await import('../src/models/CustomerProfile');
  const { default: Order } = await import('../src/models/Order');
  const { default: User } = await import('../src/models/User');

  await dbConnect();

  const menus = (await MenuItem.find({}).select(
    '_id name category price restaurantId image'
  ).lean()) as LeanMenu[];

  let patched = 0;
  for (const m of menus) {
    const image = getDishImage(m.name);
    await MenuItem.updateOne({ _id: m._id }, { $set: { image, imageAlt: m.name } });
    patched += 1;
  }
  console.log(`🖼  Menu photos patched : ${patched}`);

  const hlaingRests = (await RestaurantProfile.find({
    township: /hlaing/i,
  })
    .select('restaurantId restaurantName township location')
    .lean()) as LeanRestaurant[];

  if (hlaingRests.length === 0) {
    throw new Error('No Hlaing restaurants found. Run `npm run seed` first.');
  }

  const demoUser =
    (await User.findOne({ email: 'customer.hlaing.1@test.com' }).lean()) ||
    (await User.findOne({ email: /customer\.hlaing/i }).lean());

  let demoCustomer = demoUser
    ? ((await CustomerProfile.findOne({ customerId: String(demoUser._id) }).lean()) as
        | LeanCustomer
        | null)
    : null;

  if (!demoCustomer) {
    demoCustomer = (await CustomerProfile.findOne({
      email: /hlaing/i,
    }).lean()) as LeanCustomer | null;
  }
  if (!demoCustomer) {
    demoCustomer = (await CustomerProfile.findOne({}).lean()) as LeanCustomer | null;
  }
  if (!demoCustomer) {
    throw new Error('No customers found. Run `npm run seed` first.');
  }

  const extraCustomers = (await CustomerProfile.find({})
    .select('customerId name email savedAddresses')
    .limit(40)
    .lean()) as LeanCustomer[];

  const byRestaurant = new Map<string, LeanMenu[]>();
  for (const m of menus) {
    const rid = String(m.restaurantId || '');
    if (!rid) continue;
    if (!byRestaurant.has(rid)) byRestaurant.set(rid, []);
    byRestaurant.get(rid)!.push(m);
  }

  function findDish(rest: LeanRestaurant, matcher: RegExp): LeanMenu | null {
    const list = byRestaurant.get(rest.restaurantId) || [];
    return list.find((m) => matcher.test(String(m.name || ''))) || list[0] || null;
  }

  await Order.deleteMany({ orderNumber: { $regex: `^${AI_ORDER_PREFIX}` } });

  const { start } = yangonNowParts();
  const now = new Date();
  const orders: ReturnType<typeof buildOrder>[] = [];
  let idx = 1;

  const trendingTargets: Array<{ match: RegExp; count: number }> = [
    { match: /shan\s*noodle/i, count: 55 },
    { match: /mohinga/i, count: 16 },
    { match: /milk\s*tea/i, count: 10 },
  ];

  for (const target of trendingTargets) {
    let restForDish = hlaingRests[0];
    let dishForTarget: LeanMenu | null = null;
    for (const rest of hlaingRests) {
      const found = (byRestaurant.get(rest.restaurantId) || []).find((m) =>
        target.match.test(String(m.name || ''))
      );
      if (found) {
        restForDish = rest;
        dishForTarget = found;
        break;
      }
    }
    if (!dishForTarget) {
      dishForTarget = (byRestaurant.get(restForDish.restaurantId) || [])[0] || null;
    }
    if (!dishForTarget) continue;

    for (let i = 0; i < target.count; i++) {
      const customer = extraCustomers[i % extraCustomers.length] || demoCustomer;
      const createdAt = new Date(
        start.getTime() + ((i + 1) / (target.count + 1)) * (now.getTime() - start.getTime())
      );
      orders.push(
        buildOrder({
          index: idx++,
          restaurant: restForDish,
          customer,
          createdAt,
          weather: 'Rainy',
          items: [
            {
              id: dishForTarget._id.toString(),
              name: String(dishForTarget.name),
              category: String(dishForTarget.category || 'Burmese'),
              price: Number(dishForTarget.price) || 4000,
              quantity: 1,
              unitPrice: Number(dishForTarget.price) || 4000,
              restaurantName: restForDish.restaurantName,
              image: getDishImage(dishForTarget.name),
            },
          ],
        })
      );
    }
  }

  const spicyNames = [/lahpet\s*thoke/i, /fried\s*chicken/i, /kyay\s*oh/i, /burger/i];
  const spicyRest = hlaingRests[0];
  for (let i = 0; i < 8; i++) {
    const matcher = spicyNames[i % spicyNames.length];
    const dish =
      findDish(spicyRest, matcher) ||
      menus.find((m) => matcher.test(String(m.name || ''))) ||
      menus[0];
    if (!dish) continue;
    const createdAt = new Date(now.getTime() - (i + 1) * 36 * 60 * 60 * 1000);
    orders.push(
      buildOrder({
        index: idx++,
        restaurant: spicyRest,
        customer: demoCustomer,
        createdAt,
        weather: 'Rainy',
        items: [
          {
            id: dish._id.toString(),
            name: String(dish.name),
            category: String(dish.category || 'Burmese'),
            price: Number(dish.price) || 3500,
            quantity: 2,
            unitPrice: Number(dish.price) || 3500,
            restaurantName: spicyRest.restaurantName,
            image: getDishImage(dish.name),
          },
        ],
      })
    );
  }

  await Order.insertMany(orders, { ordered: false });

  console.log(`🧾 Demo orders inserted : ${orders.length} (${AI_ORDER_PREFIX}*)`);
  console.log(`👤 Recommend customer  : ${demoCustomer.email || demoCustomer.customerId}`);
  console.log(`🏙  Hlaing kitchens     : ${hlaingRests.length}`);
  console.log('\n💡 Demo');
  console.log('   Login  → customer.hlaing.1@test.com / Test@2026');
  console.log('   Open   → Customer Dashboard → AI Picks');
  console.log('   Lanes  → Recommend · Perfect Weather · Trending\n');
}

seedAiPicks()
  .then(async () => {
    const mongoose = await import('mongoose');
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ AI Picks seed failed:', error);
    try {
      const mongoose = await import('mongoose');
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  });
