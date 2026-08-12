/**
 * FoodDash Phase 3 — Yangon Township Seeder
 *
 * 10 townships · realistic coords · unique picsum images ·
 * 1-to-1 User ↔ Profile linking for every seeded account ·
 * Offline riders pinned to static township coordinates
 *
 * Run: npm run seed
 *
 * Passwords:
 *   ADMIN  → Admin#2026  (ops.admin@fooddash.app — exactly one)
 *   others → Test@2026
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

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

/** Shared password for every CUSTOMER / RIDER / RESTAURANT */
const USER_PASSWORD = 'Test@2026';
/** Single Super Admin password */
const ADMIN_PASSWORD = 'Admin#2026';
const ADMIN_EMAIL = 'ops.admin@fooddash.app';

/* ── 10 Yangon townships (approx. real centers) ─────────────── */

type TownshipKey =
  | 'South Dagon'
  | 'Bahan'
  | 'Kyauktada'
  | 'Pabedan'
  | 'Latha'
  | 'Lanmadaw'
  | 'Sanchaung'
  | 'Mayangone'
  | 'South Okkalapa'
  | 'North Okkalapa';

type TownshipConfig = {
  name: TownshipKey;
  slug: string;
  coords: { lat: number; lng: number };
  restaurants: string[];
  orderWeight: number;
};

type LoginCredential = {
  email: string;
  role: 'ADMIN' | 'CUSTOMER' | 'RIDER' | 'RESTAURANT';
  password: string;
  displayId: string;
  township: string;
  name: string;
  userId: string;
};

const TOWNSHIPS: TownshipConfig[] = [
  {
    name: 'South Dagon',
    slug: 'southdagon',
    coords: { lat: 16.8512, lng: 96.2128 },
    restaurants: ['South Dagon Kyay Oh House', 'Yuzana Garden Tea Shop'],
    orderWeight: 1.1,
  },
  {
    name: 'Bahan',
    slug: 'bahan',
    coords: { lat: 16.8156, lng: 96.1536 },
    restaurants: ['Bahan Inya Lake Cafe', 'Sayar San Road Grill'],
    orderWeight: 1.6,
  },
  {
    name: 'Kyauktada',
    slug: 'kyauktada',
    coords: { lat: 16.7738, lng: 96.1621 },
    restaurants: ['Sule Pagoda Mohinga', 'Kyauktada Business Lunch'],
    orderWeight: 1.4,
  },
  {
    name: 'Pabedan',
    slug: 'pabedan',
    coords: { lat: 16.7785, lng: 96.1558 },
    restaurants: ['Pabedan Street Noodles', 'Bogyoke Market Bites'],
    orderWeight: 1.3,
  },
  {
    name: 'Latha',
    slug: 'latha',
    coords: { lat: 16.7758, lng: 96.1502 },
    restaurants: ['Latha Chinatown Dim Sum', '19th Street BBQ Latha'],
    orderWeight: 1.2,
  },
  {
    name: 'Lanmadaw',
    slug: 'lanmadaw',
    coords: { lat: 16.773, lng: 96.142 },
    restaurants: ['Lanmadaw River View Kitchen', 'Strand Road Tea House'],
    orderWeight: 1.0,
  },
  {
    name: 'Sanchaung',
    slug: 'sanchaung',
    coords: { lat: 16.8068, lng: 96.1334 },
    restaurants: ['Sanchaung Bagaya Cafe', 'Myaynigone Hot Pot'],
    orderWeight: 1.8,
  },
  {
    name: 'Mayangone',
    slug: 'mayangone',
    coords: { lat: 16.868, lng: 96.152 },
    restaurants: ['Kaba Aye Garden Kitchen', 'Mayangone Lake Side Grill'],
    orderWeight: 1.2,
  },
  {
    name: 'South Okkalapa',
    slug: 'southokkalapa',
    coords: { lat: 16.847, lng: 96.182 },
    restaurants: ['South Okkalapa Shan Noodle', 'Thingangyun Junction Cafe'],
    orderWeight: 1.1,
  },
  {
    name: 'North Okkalapa',
    slug: 'northokkalapa',
    coords: { lat: 16.88, lng: 96.158 },
    restaurants: ['North Okkalapa Family Kitchen', 'Thamine Road Tea Leaf'],
    orderWeight: 1.0,
  },
];

const WEATHER = ['Sunny', 'Rainy', 'Cloudy', 'Stormy'] as const;
const VEHICLES = ['Motorcycle', 'Bicycle', 'Car'] as const;
const CATEGORIES = ['Fast Food', 'Burmese', 'Drinks', 'Dessert'] as const;
const STATUSES = [
  'PENDING',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REJECTED',
] as const;

const MYANMAR_FIRST = [
  'Aung', 'Kyaw', 'Zaw', 'Min', 'Htet', 'Soe', 'Win', 'Moe', 'Thura', 'Ye',
  'Su', 'May', 'Hnin', 'Thiri', 'Nandar', 'Aye', 'Khin', 'Phyo', 'Myat', 'Lin',
];
const MYANMAR_SECOND = [
  'Oo', 'Naing', 'Hlaing', 'Zin', 'Aung', 'Wai', 'Thu', 'Myint', 'Htwe', 'San',
  'Cho', 'Nyein', 'Kyaw', 'Htet', 'Lin', 'Soe', 'Win', 'Phyo', 'Yee', 'Maw',
];

const MENU_POOL: Array<{
  name: string;
  category: (typeof CATEGORIES)[number];
  price: number;
  description: string;
}> = [
  { name: 'Mohinga', category: 'Burmese', price: 3500, description: 'Classic Yangon fish noodle soup' },
  { name: 'Shan Noodles', category: 'Burmese', price: 4000, description: 'Rice noodles with tomato pork sauce' },
  { name: 'Kyay Oh', category: 'Burmese', price: 4500, description: 'Rich pork broth noodles' },
  { name: 'Ohno Kauk Swe', category: 'Burmese', price: 3800, description: 'Coconut chicken noodles' },
  { name: 'Lahpet Thoke', category: 'Burmese', price: 3000, description: 'Fermented tea leaf salad' },
  { name: 'Fried Rice', category: 'Fast Food', price: 3200, description: 'Wok-fried rice with egg' },
  { name: 'Chicken Burger', category: 'Fast Food', price: 5000, description: 'Crispy chicken burger' },
  { name: 'Fried Chicken', category: 'Fast Food', price: 4200, description: 'Golden fried chicken pieces' },
  { name: 'Milk Tea', category: 'Drinks', price: 1500, description: 'Hot Myanmar milk tea' },
  { name: 'Lahpet Yay', category: 'Drinks', price: 1000, description: 'Light tea for pairing' },
  { name: 'Cola', category: 'Drinks', price: 1200, description: 'Chilled soft drink' },
  { name: 'Mont Lone Yay Paw', category: 'Dessert', price: 2500, description: 'Sticky rice balls in coconut milk' },
  { name: 'Shwe Yin Aye', category: 'Dessert', price: 2800, description: 'Cool coconut jelly dessert' },
];

const CANCEL_REASONS = [
  'Customer changed mind',
  'Restaurant out of stock',
  'No rider available',
  'Long wait time',
  'Payment failed',
];

/* ── Unique picsum helpers ──────────────────────────────────── */

const usedImageSeeds = new Set<string>();

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
}

/** Never reuse the same picsum seed twice in one seed run */
function uniquePicsum(seedBase: string, w = 400, h = 300) {
  let seed = slugify(seedBase) || `img-${usedImageSeeds.size + 1}`;
  let n = 0;
  while (usedImageSeeds.has(seed)) {
    n += 1;
    seed = `${slugify(seedBase)}-${n}`;
  }
  usedImageSeeds.add(seed);
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

function myanmarName() {
  return `${faker.helpers.arrayElement(MYANMAR_FIRST)} ${faker.helpers.arrayElement(MYANMAR_SECOND)}`;
}

/** Small jitter still within ~1 km of township center */
function jitter(base: { lat: number; lng: number }, spread = 0.008) {
  return {
    lat: Number((base.lat + (Math.random() - 0.5) * spread).toFixed(6)),
    lng: Number((base.lng + (Math.random() - 0.5) * spread).toFixed(6)),
  };
}

/** Exact static pin for offline riders (no jitter) */
function staticTownshipCoords(base: { lat: number; lng: number }, index: number) {
  const lat = Number((base.lat + index * 0.00035).toFixed(6));
  const lng = Number((base.lng + index * 0.00028).toFixed(6));
  return { lat, lng };
}

function pickTownshipWeighted(): TownshipConfig {
  const total = TOWNSHIPS.reduce((s, t) => s + t.orderWeight, 0);
  let r = Math.random() * total;
  for (const t of TOWNSHIPS) {
    r -= t.orderWeight;
    if (r <= 0) return t;
  }
  return TOWNSHIPS[0];
}

function pad(str: string, width: number) {
  return str.length >= width ? str.slice(0, width) : str + ' '.repeat(width - str.length);
}

function log(msg: string) {
  console.log(msg);
}

function printCredentialsTable(rows: LoginCredential[]) {
  const sorted = [...rows].sort((a, b) => {
    const order = { ADMIN: 0, CUSTOMER: 1, RESTAURANT: 2, RIDER: 3 } as const;
    if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role];
    return a.email.localeCompare(b.email);
  });

  console.log('\n🔑 ══════════════════════════════════════════════════════════════════════════════');
  console.log('   LOGIN CREDENTIALS — copy any row to test');
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log(
    `   ${pad('EMAIL', 36)} ${pad('ROLE', 12)} ${pad('PASSWORD', 14)} ${pad('DISPLAY ID', 12)} TOWNSHIP`
  );
  console.log(
    `   ${pad('─'.repeat(34), 36)} ${pad('─'.repeat(10), 12)} ${pad('─'.repeat(12), 14)} ${pad('─'.repeat(10), 12)} ────────`
  );

  for (const row of sorted) {
    console.log(
      `   ${pad(row.email, 36)} ${pad(row.role, 12)} ${pad(row.password, 14)} ${pad(row.displayId, 12)} ${row.township || '—'}`
    );
  }

  console.log('──────────────────────────────────────────────────────────────────────────────');
  console.log(`   ADMIN password  : ${ADMIN_PASSWORD}`);
  console.log(`   All other roles : ${USER_PASSWORD}`);
  console.log(`   Total accounts  : ${sorted.length}  (exactly 1 ADMIN)`);
  console.log('══════════════════════════════════════════════════════════════════════════════\n');
}

async function seed() {
  console.log('\n🇲🇲 ════════════════════════════════════════════════');
  console.log('   FoodDash Phase 3 — 10 Yangon Townships');
  console.log('   1-to-1 Users · Test@2026 · Single Admin');
  console.log('════════════════════════════════════════════════\n');

  try {
    const { default: dbConnect } = await import('../src/lib/mongodb');
    const { default: User } = await import('../src/models/User');
    const { default: Order } = await import('../src/models/Order');
    const { default: RestaurantProfile } = await import(
      '../src/models/RestaurantProfile'
    );
    const { default: CustomerProfile } = await import(
      '../src/models/CustomerProfile'
    );
    const { default: RiderProfile } = await import('../src/models/RiderProfile');
    const { default: MenuItem } = await import('../src/models/MenuItem');

    await dbConnect();
    log('✅ Connected to MongoDB');

    log('🗑  Clearing User / RestaurantProfile / RiderProfile / MenuItem (+ related)…');
    await Promise.all([
      User.deleteMany({}),
      RestaurantProfile.deleteMany({}),
      RiderProfile.deleteMany({}),
      MenuItem.deleteMany({}),
      CustomerProfile.deleteMany({}),
      Order.deleteMany({}),
    ]);
    log('✨ Collections cleared\n');

    const [userPasswordHash, adminPasswordHash] = await Promise.all([
      bcrypt.hash(USER_PASSWORD, 10),
      bcrypt.hash(ADMIN_PASSWORD, 10),
    ]);

    type RestSeed = {
      restaurantId: string;
      restaurantName: string;
      township: TownshipKey;
      location: { lat: number; lng: number };
      rating: number;
      address: string;
      logoImage: string;
      coverImage: string;
      email: string;
      phone: string;
      displayId: string;
    };
    type CustSeed = {
      customerId: string;
      name: string;
      email: string;
      phone: string;
      township: TownshipKey;
      profileImage: string;
      displayId: string;
      address: {
        label: string;
        address: string;
        detail: string;
        lat: number;
        lng: number;
      };
    };
    type RiderSeed = {
      riderId: string;
      name: string;
      email: string;
      phone: string;
      vehicleType: (typeof VEHICLES)[number];
      status: 'Online' | 'Offline';
      township: TownshipKey;
      profileImage: string;
      displayId: string;
      riderCoords: { lat: number; lng: number };
    };
    type MenuSeed = {
      _id: mongoose.Types.ObjectId;
      restaurantId: string;
      name: string;
      category: (typeof CATEGORIES)[number];
      price: number;
      restaurantName: string;
    };

    const restaurantsByTownship = new Map<TownshipKey, RestSeed[]>();
    const customersByTownship = new Map<TownshipKey, CustSeed[]>();
    const ridersByTownship = new Map<TownshipKey, RiderSeed[]>();
    const menusByRestaurant = new Map<string, MenuSeed[]>();

    const allRestaurants: RestSeed[] = [];
    const allCustomers: CustSeed[] = [];
    const allRiders: RiderSeed[] = [];
    const allMenus: Record<string, unknown>[] = [];
    /** Every non-admin User — created 1:1 with each profile */
    const userDocs: Record<string, unknown>[] = [];
    const credentials: LoginCredential[] = [];

    let restSeq = 0;
    let riderSeq = 0;
    let custSeq = 0;

    // ── Exactly ONE Super Admin ────────────────────────────
    const adminId = new mongoose.Types.ObjectId();
    await User.create({
      _id: adminId,
      firstName: 'Ops',
      lastName: 'Admin',
      email: ADMIN_EMAIL,
      phone: '+959111000001',
      password: adminPasswordHash,
      role: 'ADMIN',
      displayId: 'ADMIN-0001',
    });
    credentials.push({
      email: ADMIN_EMAIL,
      role: 'ADMIN',
      password: ADMIN_PASSWORD,
      displayId: 'ADMIN-0001',
      township: '—',
      name: 'Ops Admin',
      userId: String(adminId),
    });
    log(`🔐 Single ADMIN created → ${ADMIN_EMAIL}`);

    // ── Per-township entities + matching User (1:1) ───────
    for (const township of TOWNSHIPS) {
      log(`📍 ${township.name}  (${township.coords.lat}, ${township.coords.lng})`);

      const restList: RestSeed[] = [];
      const custList: CustSeed[] = [];
      const riderList: RiderSeed[] = [];

      // Restaurants (1–2) — each gets a User with role RESTAURANT
      for (let i = 0; i < township.restaurants.length; i++) {
        restSeq += 1;
        const restaurantName = township.restaurants[i];
        const userId = new mongoose.Types.ObjectId();
        const restaurantId = String(userId); // session id === profile.restaurantId
        const location = jitter(township.coords);
        const email = `restaurant.${township.slug}.${i + 1}@test.com`;
        const displayId = `REST-${String(restSeq).padStart(4, '0')}`;
        const phone = `+9592${String(10000000 + restSeq).slice(-8)}`;
        const nameParts = restaurantName.split(' ');

        userDocs.push({
          _id: userId,
          firstName: nameParts[0] || 'Kitchen',
          lastName: nameParts.slice(1).join(' ') || township.name,
          email,
          phone,
          password: userPasswordHash,
          role: 'RESTAURANT',
          displayId,
        });
        credentials.push({
          email,
          role: 'RESTAURANT',
          password: USER_PASSWORD,
          displayId,
          township: township.name,
          name: restaurantName,
          userId: restaurantId,
        });

        restList.push({
          restaurantId,
          restaurantName,
          township: township.name,
          location,
          rating: faker.number.float({ min: 3.8, max: 5, fractionDigits: 1 }),
          address: `${restaurantName}, ${township.name} Township, Yangon`,
          logoImage: uniquePicsum(`logo-${restaurantName}`, 400, 400),
          coverImage: uniquePicsum(`cover-${restaurantName}`, 800, 400),
          email,
          phone,
          displayId,
        });

        const picks = faker.helpers.arrayElements(
          MENU_POOL,
          faker.number.int({ min: 4, max: 6 })
        );
        const menus: MenuSeed[] = [];
        picks.forEach((item, mi) => {
          const objectId = new mongoose.Types.ObjectId();
          const stock = faker.helpers.arrayElement([
            0,
            faker.number.int({ min: 5, max: 20 }),
            faker.number.int({ min: 40, max: 120 }),
            faker.number.int({ min: 40, max: 120 }),
          ]);
          menus.push({
            _id: objectId,
            restaurantId,
            name: item.name,
            category: item.category,
            price: item.price,
            restaurantName,
          });
          allMenus.push({
            _id: objectId,
            restaurantId,
            name: item.name,
            category: item.category,
            description: `${item.description} · ${township.name}`,
            price: item.price,
            prepTime: faker.number.int({ min: 10, max: 35 }),
            stockQuantity: stock,
            isAvailable: stock > 0,
            isPopular: mi < 2,
            dietaryTags: [],
            addons: [],
            image: uniquePicsum(`menu-${restaurantName}-${item.name}-${mi}`),
            imageAlt: item.name,
          });
        });
        menusByRestaurant.set(restaurantId, menus);
      }

      // Riders (2) — each gets a User with role RIDER
      for (let i = 0; i < 2; i++) {
        riderSeq += 1;
        const userId = new mongoose.Types.ObjectId();
        const riderId = String(userId);
        const name = myanmarName();
        const [first, last] = name.split(' ');
        const status: 'Online' | 'Offline' = i === 0 ? 'Online' : 'Offline';
        const riderCoords =
          status === 'Offline'
            ? staticTownshipCoords(township.coords, i)
            : jitter(township.coords, 0.006);
        const email = `rider.${township.slug}.${i + 1}@test.com`;
        const displayId = `RIDER-${String(riderSeq).padStart(4, '0')}`;
        const phone = `+9593${String(20000000 + riderSeq).slice(-8)}`;

        userDocs.push({
          _id: userId,
          firstName: first || 'Rider',
          lastName: last || township.name,
          email,
          phone,
          password: userPasswordHash,
          role: 'RIDER',
          displayId,
        });
        credentials.push({
          email,
          role: 'RIDER',
          password: USER_PASSWORD,
          displayId,
          township: township.name,
          name: `${name} (${status})`,
          userId: riderId,
        });

        riderList.push({
          riderId,
          name,
          email,
          phone,
          vehicleType: faker.helpers.arrayElement(VEHICLES),
          status,
          township: township.name,
          profileImage: uniquePicsum(`rider-avatar-${email}`, 200, 200),
          displayId,
          riderCoords,
        });
      }

      // Customers (2) — each gets a User with role CUSTOMER
      for (let i = 0; i < 2; i++) {
        custSeq += 1;
        const userId = new mongoose.Types.ObjectId();
        const customerId = String(userId);
        const name = myanmarName();
        const [first, last] = name.split(' ');
        const coords = jitter(township.coords);
        const email = `customer.${township.slug}.${i + 1}@test.com`;
        const displayId = `CUST-${String(custSeq).padStart(4, '0')}`;
        const phone = `+9594${String(30000000 + custSeq).slice(-8)}`;

        userDocs.push({
          _id: userId,
          firstName: first || 'Customer',
          lastName: last || township.name,
          email,
          phone,
          password: userPasswordHash,
          role: 'CUSTOMER',
          displayId,
        });
        credentials.push({
          email,
          role: 'CUSTOMER',
          password: USER_PASSWORD,
          displayId,
          township: township.name,
          name,
          userId: customerId,
        });

        custList.push({
          customerId,
          name,
          email,
          phone,
          township: township.name,
          profileImage: uniquePicsum(`customer-avatar-${email}`, 200, 200),
          displayId,
          address: {
            label: faker.helpers.arrayElement(['Home', 'Work', 'Other']),
            address: `${faker.location.streetAddress()}, ${township.name} Township`,
            detail: `${township.name}, Yangon`,
            ...coords,
          },
        });
      }

      restaurantsByTownship.set(township.name, restList);
      customersByTownship.set(township.name, custList);
      ridersByTownship.set(township.name, riderList);
      allRestaurants.push(...restList);
      allCustomers.push(...custList);
      allRiders.push(...riderList);

      log(
        `   ✓ 🍽 ${restList.length}  ·  🛵 ${riderList.length}  ·  👤 ${custList.length}  (+ matching Users)`
      );
    }

    // Integrity: every profile has a matching User doc staged
    if (userDocs.length !== allRestaurants.length + allRiders.length + allCustomers.length) {
      throw new Error(
        `1-to-1 User mismatch: users=${userDocs.length} vs profiles=` +
          `${allRestaurants.length}+${allRiders.length}+${allCustomers.length}`
      );
    }

    log(`\n🔐 Inserting ${userDocs.length} User accounts (hashed ${USER_PASSWORD})…`);
    await User.insertMany(userDocs);

    const adminCount = await User.countDocuments({ role: 'ADMIN' });
    if (adminCount !== 1) {
      throw new Error(`Expected exactly 1 ADMIN user, found ${adminCount}`);
    }

    const [userTotal, restUsers, riderUsers, custUsers] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'RESTAURANT' }),
      User.countDocuments({ role: 'RIDER' }),
      User.countDocuments({ role: 'CUSTOMER' }),
    ]);

    if (restUsers !== allRestaurants.length) {
      throw new Error(`RESTAURANT users (${restUsers}) ≠ RestaurantProfiles (${allRestaurants.length})`);
    }
    if (riderUsers !== allRiders.length) {
      throw new Error(`RIDER users (${riderUsers}) ≠ RiderProfiles (${allRiders.length})`);
    }
    if (custUsers !== allCustomers.length) {
      throw new Error(`CUSTOMER users (${custUsers}) ≠ CustomerProfiles (${allCustomers.length})`);
    }

    log(
      `   ✅ Users OK — total ${userTotal} (1 ADMIN + ${restUsers} REST + ${riderUsers} RIDER + ${custUsers} CUST)\n`
    );

    await RestaurantProfile.insertMany(
      allRestaurants.map((r, index) => {
        let storeStatus: 'OPEN' | 'BUSY' | 'CLOSED' = 'OPEN';
        if (index % 9 === 0) storeStatus = 'CLOSED';
        else if (index % 6 === 0) storeStatus = 'BUSY';

        return {
          restaurantId: r.restaurantId,
          restaurantName: r.restaurantName,
          description: `${r.township} Township · Rated ${r.rating.toFixed(1)}★ · Yangon`,
          address: r.address,
          location: r.location,
          openingTime: '08:30',
          closingTime: '21:30',
          storeStatus,
          logoImage: r.logoImage,
          coverImage: r.coverImage,
          township: r.township,
          approvalStatus: index % 4 !== 0 ? 'APPROVED' : 'PENDING',
        };
      })
    );

    await MenuItem.insertMany(allMenus);

    await CustomerProfile.insertMany(
      allCustomers.map((c) => ({
        customerId: c.customerId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        profileImage: c.profileImage,
        savedAddresses: [c.address],
      }))
    );

    await RiderProfile.insertMany(
      allRiders.map((r, index) => ({
        riderId: r.riderId,
        name: r.name,
        phone: r.phone,
        vehicle: r.vehicleType,
        vehicleType: r.vehicleType,
        status: r.status,
        licensePlate: `YGN-${faker.string.numeric(4)}`,
        profileImage: r.profileImage,
        township: r.township,
        riderCoords: r.riderCoords,
        location: r.riderCoords,
        approvalStatus: index % 5 !== 0 ? 'APPROVED' : 'PENDING',
      }))
    );

    // Final 1-to-1 DB check (profile id === User _id, email match)
    const [dbRests, dbRiders, dbCusts] = await Promise.all([
      RestaurantProfile.find({}).select('restaurantId').lean(),
      RiderProfile.find({}).select('riderId').lean(),
      CustomerProfile.find({}).select('customerId email').lean(),
    ]);
    for (const r of dbRests) {
      const u = await User.findById(r.restaurantId).select('role email').lean();
      if (!u || u.role !== 'RESTAURANT') {
        throw new Error(`RestaurantProfile ${r.restaurantId} missing RESTAURANT User`);
      }
    }
    for (const r of dbRiders) {
      const u = await User.findById(r.riderId).select('role').lean();
      if (!u || u.role !== 'RIDER') {
        throw new Error(`RiderProfile ${r.riderId} missing RIDER User`);
      }
    }
    for (const c of dbCusts) {
      const u = await User.findById(c.customerId).select('role email').lean();
      if (!u || u.role !== 'CUSTOMER' || u.email !== c.email) {
        throw new Error(`CustomerProfile ${c.customerId} missing / mismatched CUSTOMER User`);
      }
    }
    log('✅ 1-to-1 User ↔ Profile linkage verified\n');

    log(
      `✅ Profiles saved — 🍽 ${allRestaurants.length} · 📋 ${allMenus.length} · 👤 ${allCustomers.length} · 🛵 ${allRiders.length}`
    );
    log(`   Unique picsum seeds used: ${usedImageSeeds.size}\n`);

    // ── Orders for analytics / live tracking tests ─────────
    log('🧾 Generating 300 orders across 10 townships…');
    const orderCountByCustomer = new Map<string, number>();
    const townshipOrderCounts = new Map<TownshipKey, number>();

    const orders = Array.from({ length: 300 }, (_, index) => {
      const township = pickTownshipWeighted();
      townshipOrderCounts.set(
        township.name,
        (townshipOrderCounts.get(township.name) || 0) + 1
      );

      const customers = customersByTownship.get(township.name)!;
      const restaurants = restaurantsByTownship.get(township.name)!;
      const riders = ridersByTownship.get(township.name)!;

      const customer = faker.helpers.arrayElement(customers);
      const restaurant = faker.helpers.arrayElement(restaurants);
      const onlineRiders = riders.filter((r) => r.status === 'Online');
      const riderPool = onlineRiders.length > 0 ? onlineRiders : riders;
      const rider = faker.helpers.arrayElement(riderPool);

      orderCountByCustomer.set(
        customer.customerId,
        (orderCountByCustomer.get(customer.customerId) || 0) + 1
      );

      const status = faker.helpers.arrayElement(STATUSES);
      const isPending = status === 'PENDING';
      const isCancelled = status === 'CANCELLED' || status === 'REJECTED';
      const isTerminal =
        status === 'DELIVERED' || status === 'CANCELLED' || status === 'REJECTED';

      const menu = menusByRestaurant.get(restaurant.restaurantId) || [];
      const picked =
        menu.length > 0
          ? faker.helpers.arrayElements(
              menu,
              Math.min(menu.length, faker.number.int({ min: 1, max: 3 }))
            )
          : [];

      const items = picked.map((m) => {
        const quantity = faker.number.int({ min: 1, max: 3 });
        return {
          id: m._id.toString(),
          name: m.name,
          category: m.category,
          price: m.price,
          quantity,
          unitPrice: m.price,
          restaurantName: restaurant.restaurantName,
        };
      });

      const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
      const discount = faker.helpers.arrayElement([0, 0, 500, 1000]);
      const surgePrice =
        Math.random() < 0.25 ? faker.helpers.arrayElement([500, 1000, 1500]) : 0;
      const deliveryFee = faker.helpers.arrayElement([1000, 1500, 2000, 2500]);
      const totalAmount = Math.max(0, subtotal - discount + surgePrice + deliveryFee);

      const prepTimeMins = faker.number.int({ min: 12, max: 35 });
      const durationMins = faker.number.int({ min: 20, max: 50 });
      const travelMins = Math.max(5, durationMins - prepTimeMins);
      const distanceKm = parseFloat(
        faker.number.float({ min: 1, max: 6, fractionDigits: 1 }).toFixed(1)
      );
      const createdAt = faker.date.recent({ days: 40 });
      const assignedRider = isPending ? null : rider;

      const riderCoords = assignedRider
        ? assignedRider.status === 'Offline'
          ? assignedRider.riderCoords
          : jitter(township.coords, 0.01)
        : undefined;

      return {
        orderNumber: `#YG-${String(1000 + index).padStart(4, '0')}`,
        restaurantId: restaurant.restaurantId,
        restaurantName: restaurant.restaurantName,
        customerId: customer.customerId,
        customerName: customer.name,
        status,
        prepTime: prepTimeMins,
        travelMins,
        restaurantCoords: restaurant.location,
        riderId: assignedRider?.riderId || '',
        riderName: assignedRider?.name || '',
        riderCoords,
        items,
        totals: {
          subtotal,
          deliveryFee,
          discount,
          surgePrice,
          total: totalAmount,
          totalAmount,
          township: township.name,
        },
        deliveryAddress: {
          ...customer.address,
          township: township.name,
        },
        paymentMethod: faker.helpers.arrayElement(['cash', 'wallet', 'card']),
        discount,
        surgePrice,
        weather: faker.helpers.arrayElement(WEATHER),
        vehicleType: assignedRider?.vehicleType || rider.vehicleType,
        distanceKm,
        durationMins,
        customerOrderCount: orderCountByCustomer.get(customer.customerId) || 1,
        cancelReason: isCancelled
          ? faker.helpers.arrayElement(CANCEL_REASONS)
          : '',
        restaurantRating: restaurant.rating,
        baseRiderFee: faker.number.int({ min: 1000, max: 2500 }),
        tipAmount:
          status === 'DELIVERED' ? faker.helpers.arrayElement([0, 500, 1000]) : 0,
        completedAt: isTerminal
          ? faker.date.between({ from: createdAt, to: new Date() })
          : undefined,
        createdAt,
        updatedAt: createdAt,
      };
    });

    const inserted = await Order.insertMany(orders, { ordered: false });

    console.log('\n📊 Orders by township:');
    for (const t of TOWNSHIPS) {
      const n = townshipOrderCounts.get(t.name) || 0;
      const bar = '█'.repeat(Math.max(1, Math.round(n / 6)));
      console.log(`   ${t.name.padEnd(18)} ${String(n).padStart(3)}  ${bar}`);
    }

    printCredentialsTable(credentials);

    console.log('💡 Quick-start (Bahan township):');
    console.log(`   Customer   → customer.bahan.1@test.com / ${USER_PASSWORD}`);
    console.log(`   Restaurant → restaurant.bahan.1@test.com / ${USER_PASSWORD}`);
    console.log(`   Rider On   → rider.bahan.1@test.com / ${USER_PASSWORD}`);
    console.log(`   Rider Off  → rider.bahan.2@test.com / ${USER_PASSWORD}`);
    console.log(`   Admin      → ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);

    console.log('\n🎉 ════════════════════════════════════════════════');
    console.log('   Phase 3 seed complete');
    console.log('────────────────────────────────────────────────');
    console.log(`   🏙  Townships   : ${TOWNSHIPS.length}`);
    console.log(`   🍽  Restaurants : ${allRestaurants.length}`);
    console.log(`   📋 Menu items  : ${allMenus.length}`);
    console.log(`   👤 Customers   : ${allCustomers.length}`);
    console.log(`   🛵 Riders      : ${allRiders.length}`);
    console.log(`   🧾 Orders      : ${inserted.length}`);
    console.log(`   🔐 Users       : ${userTotal} (1 ADMIN only)`);
    console.log(`   🖼  Unique imgs : ${usedImageSeeds.size}`);
    console.log('════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => undefined);
    console.log('🔌 Disconnected from MongoDB');
    process.exit(process.exitCode ?? 0);
  }
}

void seed();
