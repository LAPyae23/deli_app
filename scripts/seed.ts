/**
 * FoodDash — Yangon Township Seeder (supply / demand imbalance)
 *
 * 10 townships · bbox lat/lng · intentional rider shortage in Insein ·
 * rider surplus in South Dagon · 1-to-1 User ↔ Profile · wipe-then-seed
 *
 * Run: npm run seed
 *
 * Passwords:
 *   ADMIN  → Admin#2026  (ops.admin@fooddash.app — exactly one)
 *   others → Test@2026
 *
 * Email pattern:
 *   customer.{slug}.{n}@test.com
 *   restaurant.{slug}.{n}@test.com
 *   rider.{slug}.{n}@test.com
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
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

/** Shared password for every CUSTOMER / RIDER / RESTAURANT */
const USER_PASSWORD = 'Test@2026';
/** Single Super Admin password */
const ADMIN_PASSWORD = 'Admin#2026';
const ADMIN_EMAIL = 'ops.admin@fooddash.app';

/* ── Exactly 10 Yangon townships (bbox + role counts) ───────── */

type TownshipKey =
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

type DemandTier = 'HIGH' | 'LOW' | 'NORMAL' | 'MINOR';

type TownshipConfig = {
  name: TownshipKey;
  slug: string;
  bounds: { lat: [number, number]; lng: [number, number] };
  coords: { lat: number; lng: number };
  customers: number;
  restaurants: number;
  riders: number;
  featuredNames: string[];
  orderWeight: number;
  demandTier: DemandTier;
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

const RESTAURANT_SUFFIXES = [
  'Market BBQ',
  'Tea House',
  'Mohinga Stall',
  'Kyay Oh House',
  'Shan Noodle',
  'Seafood',
  'Shwe Kaung',
  'Hot Pot',
  'Family Kitchen',
  'Street Noodles',
  'Night Market Grill',
  'Garden Cafe',
  'Junction Kitchen',
  'Rice House',
  'BBQ Corner',
  'Pinlon Tea Shop',
  'Lake View Kitchen',
  'Station Tea Shop',
];

const TOWNSHIPS: TownshipConfig[] = [
  {
    name: 'Insein',
    slug: 'insein',
    bounds: { lat: [16.88, 16.91], lng: [96.08, 96.11] },
    coords: { lat: 16.895, lng: 96.095 },
    customers: 80,
    restaurants: 40,
    riders: 5,
    featuredNames: [
      'Insein Market BBQ',
      'Insein Station Tea House',
      'Thamaing Junction Grill',
      'Insein Fresh Mohinga',
      'Aung Mingalar Kyay Oh Insein',
    ],
    orderWeight: 4.5,
    demandTier: 'HIGH',
  },
  {
    name: 'South Dagon',
    slug: 'southdagon',
    bounds: { lat: [16.81, 16.84], lng: [96.2, 96.24] },
    coords: { lat: 16.825, lng: 96.22 },
    customers: 15,
    restaurants: 10,
    riders: 35,
    featuredNames: [
      'South Dagon Kyay Oh House',
      'Yuzana Garden Tea Shop',
      'South Dagon Night Market BBQ',
    ],
    orderWeight: 0.35,
    demandTier: 'LOW',
  },
  {
    name: 'Hlaing',
    slug: 'hlaing',
    bounds: { lat: [16.83, 16.86], lng: [96.11, 96.13] },
    coords: { lat: 16.845, lng: 96.12 },
    customers: 30,
    restaurants: 20,
    riders: 15,
    featuredNames: ['Hledan Centre Food', 'Hlaing University Cafe', 'Hlaing Township Shan Noodle'],
    orderWeight: 1.2,
    demandTier: 'NORMAL',
  },
  {
    name: 'Kamaryut',
    slug: 'kamaryut',
    bounds: { lat: [16.82, 16.84], lng: [96.12, 96.14] },
    coords: { lat: 16.83, lng: 96.13 },
    customers: 30,
    restaurants: 20,
    riders: 15,
    featuredNames: ['Kamaryut Junction Noodles', 'Hledan Kamaryut Grill', 'Kamaryut Tea Leaf'],
    orderWeight: 1.2,
    demandTier: 'NORMAL',
  },
  {
    name: 'Bahan',
    slug: 'bahan',
    bounds: { lat: [16.8, 16.82], lng: [96.14, 96.16] },
    coords: { lat: 16.81, lng: 96.15 },
    customers: 30,
    restaurants: 20,
    riders: 15,
    featuredNames: ['Bahan Shwe Kaung', 'Inya Lake Cafe', 'Sayar San Road Grill'],
    orderWeight: 1.3,
    demandTier: 'NORMAL',
  },
  {
    name: 'Yankin',
    slug: 'yankin',
    bounds: { lat: [16.83, 16.85], lng: [96.15, 96.17] },
    coords: { lat: 16.84, lng: 96.16 },
    customers: 30,
    restaurants: 20,
    riders: 15,
    featuredNames: ['Yankin Seafood', 'Yankin Centre Kitchen', 'Yankin Shwe Hintha'],
    orderWeight: 1.2,
    demandTier: 'NORMAL',
  },
  {
    name: 'Mingaladon',
    slug: 'mingaladon',
    bounds: { lat: [16.9, 16.95], lng: [96.11, 96.16] },
    coords: { lat: 16.925, lng: 96.135 },
    customers: 30,
    restaurants: 20,
    riders: 15,
    featuredNames: ['Mingaladon Airport Cafe', 'Mingaladon Tea House', 'Mingaladon Family Kitchen'],
    orderWeight: 1.1,
    demandTier: 'NORMAL',
  },
  {
    name: 'North Dagon',
    slug: 'northdagon',
    bounds: { lat: [16.85, 16.88], lng: [96.18, 96.21] },
    coords: { lat: 16.865, lng: 96.195 },
    customers: 30,
    restaurants: 20,
    riders: 15,
    featuredNames: ['North Dagon Pinlon Tea House', 'North Dagon Street Noodles', 'Pinlon Road BBQ'],
    orderWeight: 1.15,
    demandTier: 'NORMAL',
  },
  {
    name: 'Mayangone',
    slug: 'mayangone',
    bounds: { lat: [16.85, 16.89], lng: [96.14, 96.17] },
    coords: { lat: 16.87, lng: 96.155 },
    customers: 5,
    restaurants: 5,
    riders: 5,
    featuredNames: ['Kaba Aye Garden Kitchen', 'Mayangone Lake Side Grill'],
    orderWeight: 0.4,
    demandTier: 'MINOR',
  },
  {
    name: 'Thingangyun',
    slug: 'thingangyun',
    bounds: { lat: [16.82, 16.85], lng: [96.17, 96.2] },
    coords: { lat: 16.835, lng: 96.185 },
    customers: 5,
    restaurants: 5,
    riders: 5,
    featuredNames: ['Thingangyun Junction Cafe', 'Thingangyun Shan Noodle'],
    orderWeight: 0.4,
    demandTier: 'MINOR',
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

function myanmarName() {
  return `${faker.helpers.arrayElement(MYANMAR_FIRST)} ${faker.helpers.arrayElement(MYANMAR_SECOND)}`;
}

function randomInBounds(bounds: { lat: [number, number]; lng: [number, number] }) {
  const lat = bounds.lat[0] + Math.random() * (bounds.lat[1] - bounds.lat[0]);
  const lng = bounds.lng[0] + Math.random() * (bounds.lng[1] - bounds.lng[0]);
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

/** Offline riders stay on a deterministic pin inside the township bbox */
function staticTownshipCoords(
  bounds: { lat: [number, number]; lng: [number, number] },
  index: number
) {
  const t = (index + 1) / (index + 6);
  const lat = bounds.lat[0] + (bounds.lat[1] - bounds.lat[0]) * t;
  const lng = bounds.lng[0] + (bounds.lng[1] - bounds.lng[0]) * t;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

function restaurantNameFor(township: TownshipConfig, index: number) {
  if (township.featuredNames[index]) return township.featuredNames[index];
  const overflow = index - township.featuredNames.length;
  const suffix = RESTAURANT_SUFFIXES[overflow % RESTAURANT_SUFFIXES.length];
  const cycle = Math.floor(overflow / RESTAURANT_SUFFIXES.length);
  const base = `${township.name} ${suffix}`;
  return cycle > 0 ? `${base} ${cycle + 1}` : base;
}

function riderStatusFor(township: TownshipConfig, index: number): 'Online' | 'Offline' {
  if (township.demandTier === 'HIGH') return 'Online';
  if (township.demandTier === 'LOW') return index % 7 === 0 ? 'Offline' : 'Online';
  return index % 3 === 0 ? 'Offline' : 'Online';
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

function printTownshipRoster() {
  console.log('\n🏙  TOWNSHIP ROSTER — intentional supply / demand imbalance');
  console.log(
    `   ${pad('TOWNSHIP', 16)} ${pad('TIER', 8)} ${pad('CUST', 6)} ${pad('REST', 6)} ${pad('RIDER', 7)} LAT / LNG`
  );
  for (const t of TOWNSHIPS) {
    const bbox = `${t.bounds.lat[0].toFixed(4)}–${t.bounds.lat[1].toFixed(4)}, ${t.bounds.lng[0].toFixed(4)}–${t.bounds.lng[1].toFixed(4)}`;
    console.log(
      `   ${pad(t.name, 16)} ${pad(t.demandTier, 8)} ${pad(String(t.customers), 6)} ${pad(String(t.restaurants), 6)} ${pad(String(t.riders), 7)} ${bbox}`
    );
  }
  const totals = TOWNSHIPS.reduce(
    (acc, t) => ({
      customers: acc.customers + t.customers,
      restaurants: acc.restaurants + t.restaurants,
      riders: acc.riders + t.riders,
    }),
    { customers: 0, restaurants: 0, riders: 0 }
  );
  console.log(
    `   ${pad('TOTAL', 16)} ${pad('', 8)} ${pad(String(totals.customers), 6)} ${pad(String(totals.restaurants), 6)} ${pad(String(totals.riders), 7)}`
  );
  console.log('   Insein = RED surge (80 cust / 5 riders) · South Dagon = cold (15 cust / 35 riders)\n');
}

function highlightCredentials(rows: LoginCredential[]) {
  const out: LoginCredential[] = [];
  const seen = new Set<string>();
  const add = (row?: LoginCredential) => {
    if (!row || seen.has(row.email)) return;
    seen.add(row.email);
    out.push(row);
  };

  add(rows.find((r) => r.role === 'ADMIN'));
  for (const township of TOWNSHIPS) {
    const ofTown = rows.filter((r) => r.township === township.name);
    const byRole = (role: LoginCredential['role']) => ofTown.filter((r) => r.role === role);
    byRole('CUSTOMER').slice(0, 2).forEach(add);
    byRole('RESTAURANT').slice(0, 2).forEach(add);
    if (township.demandTier === 'HIGH' || township.demandTier === 'LOW') {
      byRole('RIDER').forEach(add);
    } else {
      byRole('RIDER').slice(0, 2).forEach(add);
    }
  }
  return out;
}

function printCredentialsTable(rows: LoginCredential[], title: string) {
  const sorted = [...rows].sort((a, b) => {
    const order = { ADMIN: 0, CUSTOMER: 1, RESTAURANT: 2, RIDER: 3 } as const;
    if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role];
    if (a.township !== b.township) return a.township.localeCompare(b.township);
    return a.email.localeCompare(b.email);
  });

  console.log('\n🔑 ══════════════════════════════════════════════════════════════════════════════');
  console.log(`   ${title}`);
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log(
    `   ${pad('EMAIL', 40)} ${pad('ROLE', 12)} ${pad('PASSWORD', 14)} ${pad('DISPLAY ID', 12)} TOWNSHIP`
  );
  console.log(
    `   ${pad('─'.repeat(38), 40)} ${pad('─'.repeat(10), 12)} ${pad('─'.repeat(12), 14)} ${pad('─'.repeat(10), 12)} ────────`
  );

  for (const row of sorted) {
    console.log(
      `   ${pad(row.email, 40)} ${pad(row.role, 12)} ${pad(row.password, 14)} ${pad(row.displayId, 12)} ${row.township || '—'}`
    );
  }

  console.log('──────────────────────────────────────────────────────────────────────────────');
  console.log(`   ADMIN password  : ${ADMIN_PASSWORD}`);
  console.log(`   All other roles : ${USER_PASSWORD}`);
  console.log(`   Rows shown      : ${sorted.length}`);
  console.log('   Email pattern   : {role}.{township-slug}.{n}@test.com');
  console.log('   Examples        : customer.insein.1@test.com · rider.southdagon.12@test.com');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');
}

async function seed() {
  console.log('\n🇲🇲 ════════════════════════════════════════════════');
  console.log('   FoodDash — 10 Yangon Townships (imbalance seed)');
  console.log('   Wipe · bbox lat/lng · Test@2026 · Single Admin');
  console.log('════════════════════════════════════════════════\n');
  printTownshipRoster();

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

    if (TOWNSHIPS.length !== 10) {
      throw new Error(`Expected exactly 10 townships, got ${TOWNSHIPS.length}`);
    }

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
      log(
        `📍 ${township.name}  [${township.demandTier}]  ` +
          `${township.customers}C / ${township.restaurants}R / ${township.riders} riders  ` +
          `bbox ${township.bounds.lat[0]}–${township.bounds.lat[1]}, ${township.bounds.lng[0]}–${township.bounds.lng[1]}`
      );

      const restList: RestSeed[] = [];
      const custList: CustSeed[] = [];
      const riderList: RiderSeed[] = [];

      for (let i = 0; i < township.restaurants; i++) {
        restSeq += 1;
        const restaurantName = restaurantNameFor(township, i);
        const userId = new mongoose.Types.ObjectId();
        const restaurantId = String(userId); // session id === profile.restaurantId
        const location = randomInBounds(township.bounds);
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
          logoImage: faker.helpers.arrayElement(REAL_RESTAURANT_IMAGES),
          coverImage: faker.helpers.arrayElement(REAL_RESTAURANT_IMAGES),
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
            image: getDishImage(item.name),
            imageAlt: item.name,
            rating: faker.number.float({ min: 3.8, max: 5, fractionDigits: 1 }),
          });
        });
        menusByRestaurant.set(restaurantId, menus);
      }

      for (let i = 0; i < township.riders; i++) {
        riderSeq += 1;
        const userId = new mongoose.Types.ObjectId();
        const riderId = String(userId);
        const name = myanmarName();
        const [first, last] = name.split(' ');
        const status = riderStatusFor(township, i);
        const riderCoords =
          status === 'Offline'
            ? staticTownshipCoords(township.bounds, i)
            : randomInBounds(township.bounds);
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
          profileImage: uiAvatar(name),
          displayId,
          riderCoords,
        });
      }

      for (let i = 0; i < township.customers; i++) {
        custSeq += 1;
        const userId = new mongoose.Types.ObjectId();
        const customerId = String(userId);
        const name = myanmarName();
        const [first, last] = name.split(' ');
        const coords = randomInBounds(township.bounds);
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
          profileImage: uiAvatar(name),
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
        const isInsein = r.township === 'Insein';
        let storeStatus: 'OPEN' | 'BUSY' | 'CLOSED' = 'OPEN';
        if (!isInsein && index % 12 === 0) storeStatus = 'CLOSED';
        else if (!isInsein && index % 8 === 0) storeStatus = 'BUSY';

        return {
          restaurantId: r.restaurantId,
          restaurantName: r.restaurantName,
          description: `${r.township} Township · Rated ${r.rating.toFixed(1)}★ · Yangon`,
          address: r.address,
          location: r.location,
          openingTime: '08:30',
          closingTime: '21:30',
          storeStatus,
          logoImage: faker.helpers.arrayElement(REAL_RESTAURANT_IMAGES),
          coverImage: faker.helpers.arrayElement(REAL_RESTAURANT_IMAGES),
          rating: r.rating,
          reviewCount: 0,
          township: r.township,
          approvalStatus: isInsein || index % 7 !== 0 ? 'APPROVED' : 'PENDING',
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
        profileImage: uiAvatar(c.name),
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
        profileImage: uiAvatar(r.name),
        township: r.township,
        riderCoords: r.riderCoords,
        location: r.riderCoords,
        approvalStatus: r.township === 'Insein' || index % 8 !== 0 ? 'APPROVED' : 'PENDING',
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
      `✅ Profiles saved — 🍽 ${allRestaurants.length} · 📋 ${allMenus.length} · 👤 ${allCustomers.length} · 🛵 ${allRiders.length}\n`
    );

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
      const deliveryFee = faker.helpers.arrayElement([1000, 1500, 2000, 2500]);
      const pricing = calculateOrderPricing({ subtotal, deliveryFee });
      const surgePrice =
        Math.random() < 0.25 ? faker.helpers.arrayElement([500, 1000, 1500]) : 0;

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
          : randomInBounds(township.bounds)
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
          township: township.name,
        },
        deliveryAddress: {
          ...customer.address,
          township: township.name,
        },
        paymentMethod: faker.helpers.arrayElement(['cash', 'wallet', 'card']),
        discount: 0,
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
        baseRiderFee: pricing.riderEarning,
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

    console.log('\n📊 Orders by township (weighted toward Insein):');
    for (const t of TOWNSHIPS) {
      const n = townshipOrderCounts.get(t.name) || 0;
      const bar = '█'.repeat(Math.max(1, Math.round(n / 6)));
      console.log(`   ${pad(t.name, 16)} ${String(n).padStart(3)}  ${t.demandTier.padEnd(7)} ${bar}`);
    }

    printCredentialsTable(
      highlightCredentials(credentials),
      'LOGIN CREDENTIALS — admin, samples, all Insein + South Dagon riders'
    );
    printCredentialsTable(credentials, 'FULL LOGIN LIST — every seeded account');

    console.log('💡 Quick-start');
    console.log(`   Admin              → ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log(`   Insein customer    → customer.insein.1@test.com / ${USER_PASSWORD}`);
    console.log(`   Insein restaurant  → restaurant.insein.1@test.com / ${USER_PASSWORD}`);
    console.log(`   Insein rider (1/5) → rider.insein.1@test.com / ${USER_PASSWORD}`);
    console.log(`   South Dagon rider  → rider.southdagon.1@test.com / ${USER_PASSWORD}`);
    console.log(`   Bahan customer     → customer.bahan.1@test.com / ${USER_PASSWORD}`);
    console.log(`   Pattern            → {customer|restaurant|rider}.{slug}.{n}@test.com / ${USER_PASSWORD}`);

    console.log('\n🎉 ════════════════════════════════════════════════');
    console.log('   Yangon imbalance seed complete');
    console.log('────────────────────────────────────────────────');
    console.log(`   🏙  Townships   : ${TOWNSHIPS.length}`);
    console.log(`   🍽  Restaurants : ${allRestaurants.length}`);
    console.log(`   📋 Menu items  : ${allMenus.length}`);
    console.log(`   👤 Customers   : ${allCustomers.length}`);
    console.log(`   🛵 Riders      : ${allRiders.length}`);
    console.log(`   🧾 Orders      : ${inserted.length}`);
    console.log(`   🔐 Users       : ${userTotal} (1 ADMIN only)`);
    console.log('   🖼  Images      : Unsplash food/restaurant + UI Avatars');
    console.log('   🔴 Insein       : 80 customers / 40 kitchens / 5 riders');
    console.log('   🔵 South Dagon  : 15 customers / 10 kitchens / 35 riders');
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
