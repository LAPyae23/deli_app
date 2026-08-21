/**
 * Sequential API smoke test for every route under src/app/api/.
 *
 * Prerequisite: Next.js dev server must be running.
 *   npm run dev
 *
 * Run:
 *   npx tsx scripts/test-all-apis.ts
 *
 * Optional:
 *   API_BASE=http://localhost:4028 npx tsx scripts/test-all-apis.ts
 *
 * Destructive writes (register, delete menu, remittance, promo, password)
 * use dummy IDs or invalid payloads so demo accounts stay intact.
 */

const BASE = (process.env.API_BASE || 'http://localhost:4028').replace(/\/$/, '');
const DUMMY_ID = '000000000000000000000000';
const TIMEOUT_MS = 12_000;

const DEMO = {
  customer: {
    email: 'customer.hlaing.1@test.com',
    password: 'Test@2026',
    role: 'CUSTOMER',
  },
  restaurant: {
    email: 'restaurant.hlaing.1@test.com',
    password: 'Test@2026',
    role: 'RESTAURANT',
  },
  rider: {
    email: 'rider.hlaing.1@test.com',
    password: 'Test@2026',
    role: 'RIDER',
  },
  admin: {
    email: 'ops.admin@fooddash.app',
    password: 'Admin#2026',
    role: 'ADMIN',
  },
} as const;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type Case = {
  method: Method;
  path: string;
  body?: unknown;
  formData?: FormData;
  expected?: number[];
};

type Result = {
  method: Method;
  path: string;
  ok: boolean;
  status: number | 'ERR';
  detail: string;
  ms: number;
};

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {};
}

async function login(creds: {
  email: string;
  password: string;
  role: string;
}): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = asRecord(await res.json().catch(() => ({})));
  if (!res.ok || !json.userId) {
    throw new Error(
      `Login failed for ${creds.role} (${res.status}): ${String(json.message || '')}`
    );
  }
  return String(json.userId);
}

async function getJson(path: string): Promise<Json> {
  const res = await fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return asRecord(await res.json().catch(() => ({})));
}

function pickId(list: unknown, keys: string[]): string {
  if (!Array.isArray(list) || list.length === 0) return DUMMY_ID;
  const first = asRecord(list[0]);
  for (const key of keys) {
    const value = first[key];
    if (value != null && String(value).trim()) return String(value);
  }
  return DUMMY_ID;
}

async function runCase(c: Case): Promise<Result> {
  const url = `${BASE}${c.path}`;
  const started = Date.now();
  try {
    const headers: Record<string, string> = {};
    const init: RequestInit = {
      method: c.method,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    };

    if (c.formData) {
      init.body = c.formData;
    } else if (c.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(c.body);
    }

    init.headers = headers;
    const res = await fetch(url, init);
    const ms = Date.now() - started;
    const expected = c.expected ?? [200, 201];
    const text = await res.text();
    let message = '';
    try {
      const json = JSON.parse(text) as Json;
      message = String(json.message || json.error || '');
    } catch {
      message = text.slice(0, 180).replace(/\s+/g, ' ').trim();
    }

    const ok = expected.includes(res.status);
    return {
      method: c.method,
      path: c.path,
      ok,
      status: res.status,
      detail: message,
      ms,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      method: c.method,
      path: c.path,
      ok: false,
      status: 'ERR',
      detail,
      ms: Date.now() - started,
    };
  }
}

function line(r: Result): string {
  const label = `${r.method} ${r.path}`;
  if (r.ok) {
    return `✅ ${label} - Passed (${r.status}) [${r.ms}ms]`;
  }
  const extra = r.detail ? ` - ${r.detail}` : '';
  return `❌ ${label} - Failed (${r.status})${extra} [${r.ms}ms]`;
}

async function main() {
  console.log(`\nFoodDash API test suite → ${BASE}\n`);

  let customerId = DUMMY_ID;
  let restaurantId = DUMMY_ID;
  let riderId = DUMMY_ID;
  let adminId = DUMMY_ID;
  let restaurantName = 'Hlaing Kitchen';
  let orderId = DUMMY_ID;
  let menuId = DUMMY_ID;

  try {
    console.log('Bootstrapping demo sessions…');
    customerId = await login(DEMO.customer);
    restaurantId = await login(DEMO.restaurant);
    riderId = await login(DEMO.rider);
    adminId = await login(DEMO.admin);

    const restaurantsPayload = await getJson('/api/restaurants?approved=1');
    restaurantId =
      pickId(restaurantsPayload.restaurants, ['restaurantId', '_id']) ||
      restaurantId;
    const restaurants = Array.isArray(restaurantsPayload.restaurants)
      ? restaurantsPayload.restaurants
      : [];
    const firstRestaurant = asRecord(restaurants[0]);
    if (firstRestaurant.restaurantName) {
      restaurantName = String(firstRestaurant.restaurantName);
    }
    if (firstRestaurant.restaurantId) {
      restaurantId = String(firstRestaurant.restaurantId);
    }

    const menuPayload = await getJson(
      `/api/menu?restaurantId=${encodeURIComponent(restaurantId)}`
    );
    menuId = pickId(menuPayload.items, ['_id', 'id']);

    const ordersPayload = await getJson(
      `/api/orders?customerId=${encodeURIComponent(customerId)}`
    );
    orderId = pickId(ordersPayload.orders, ['_id', 'id']);

    console.log(
      `IDs  customer=${customerId}  restaurant=${restaurantId}  rider=${riderId}  admin=${adminId}`
    );
    console.log(`     order=${orderId}  menuItem=${menuId}\n`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.log(
      `⚠️  Bootstrap failed (${detail}). Falling back to dummy IDs.\n`
    );
  }

  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  const uploadForm = new FormData();
  uploadForm.append(
    'file',
    new Blob([png], { type: 'image/png' }),
    'api-test.png'
  );

  const cases: Case[] = [
    // Auth
    {
      method: 'POST',
      path: '/api/auth/login',
      body: DEMO.customer,
    },
    {
      method: 'POST',
      path: '/api/auth/register',
      body: {
        firstName: 'Api',
        lastName: 'Tester',
        email: 'not-an-email',
        phone: '0912345678',
        password: 'weak',
        role: 'CUSTOMER',
      },
      expected: [400],
    },
    {
      method: 'POST',
      path: '/api/auth/change-password',
      body: {
        userId: DUMMY_ID,
        oldPassword: 'Wrong@123',
        newPassword: 'NewPass@2026',
      },
      expected: [404, 401, 400],
    },

    // Orders
    { method: 'GET', path: '/api/orders' },
    {
      method: 'GET',
      path: `/api/orders?customerId=${encodeURIComponent(customerId)}`,
    },
    {
      method: 'POST',
      path: '/api/orders',
      body: { items: [], deliveryAddress: {} },
      expected: [400],
    },
    {
      method: 'PATCH',
      path: '/api/orders',
      body: {},
      expected: [400],
    },
    { method: 'GET', path: `/api/orders/${orderId}` },
    {
      method: 'PATCH',
      path: `/api/orders/${DUMMY_ID}`,
      body: { status: 'PREPARING' },
      expected: [404, 400],
    },

    // Messages
    {
      method: 'GET',
      path: `/api/messages?senderId=${encodeURIComponent(customerId)}&receiverId=super-admin-001`,
    },
    {
      method: 'POST',
      path: '/api/messages',
      body: { text: 'hello' },
      expected: [400],
    },

    // Chat (may 500 if OpenAI key is missing)
    {
      method: 'POST',
      path: '/api/chat',
      body: { message: 'What is on the menu?' },
      expected: [200, 400, 500],
    },

    // Menu
    {
      method: 'GET',
      path: `/api/menu?restaurantId=${encodeURIComponent(restaurantId)}`,
    },
    {
      method: 'POST',
      path: '/api/menu',
      body: { name: 'API Test Item' },
      expected: [400],
    },
    {
      method: 'PATCH',
      path: `/api/menu/${DUMMY_ID}`,
      body: { isAvailable: true },
      expected: [404, 400],
    },
    {
      method: 'DELETE',
      path: `/api/menu/${DUMMY_ID}`,
    },

    // Restaurants
    { method: 'GET', path: '/api/restaurants' },
    { method: 'GET', path: '/api/restaurants?approved=1' },
    {
      method: 'GET',
      path: `/api/restaurants/${encodeURIComponent(restaurantId)}/reviews`,
    },

    // Restaurant portal
    {
      method: 'GET',
      path: `/api/restaurant/profile?restaurantId=${encodeURIComponent(restaurantId)}`,
    },
    {
      method: 'POST',
      path: '/api/restaurant/profile',
      body: { restaurantName: 'API Test' },
      expected: [400],
    },
    {
      method: 'PATCH',
      path: '/api/restaurant/profile',
      body: { restaurantId: DUMMY_ID, storeStatus: 'OPEN' },
      expected: [404, 400],
    },
    {
      method: 'GET',
      path: `/api/restaurant/stats?restaurantId=${encodeURIComponent(restaurantId)}`,
    },
    {
      method: 'GET',
      path: `/api/restaurant/insights?restaurantId=${encodeURIComponent(restaurantId)}&restaurantName=${encodeURIComponent(restaurantName)}`,
    },

    // Rider
    {
      method: 'GET',
      path: `/api/rider/profile?riderId=${encodeURIComponent(riderId)}`,
    },
    {
      method: 'POST',
      path: '/api/rider/profile',
      body: { name: 'API Test Rider' },
      expected: [400],
    },
    {
      method: 'GET',
      path: `/api/rider/dashboard?riderId=${encodeURIComponent(riderId)}`,
    },
    {
      method: 'GET',
      path: `/api/rider/routes?riderId=${encodeURIComponent(riderId)}`,
    },
    { method: 'GET', path: '/api/rider/heatmap' },
    {
      method: 'POST',
      path: '/api/rider/remittance',
      body: { riderId, amount: 0, method: 'KBZPay' },
      expected: [400],
    },

    // Customer
    {
      method: 'GET',
      path: `/api/customer/profile?customerId=${encodeURIComponent(customerId)}`,
    },
    {
      method: 'POST',
      path: '/api/customer/profile',
      body: { name: 'API Test Customer' },
      expected: [400],
    },
    {
      method: 'GET',
      path: `/api/customer/streak?customerId=${encodeURIComponent(customerId)}`,
    },
    {
      method: 'POST',
      path: '/api/customer/streak',
      body: { customerId },
    },
    {
      method: 'GET',
      path: `/api/customer/wrapped?customerId=${encodeURIComponent(customerId)}`,
    },
    {
      method: 'GET',
      path: `/api/customer/recommendations?customerId=${encodeURIComponent(customerId)}`,
    },
    {
      method: 'GET',
      path: `/api/customer/ai-picks?customerId=${encodeURIComponent(customerId)}`,
    },
    {
      method: 'POST',
      path: '/api/customer/consume-promo',
      body: { customerId: DUMMY_ID },
      expected: [404, 400],
    },
    {
      method: 'PATCH',
      path: `/api/customer/orders/${DUMMY_ID}/review`,
      body: { rating: 5, review: 'API test review' },
      expected: [404, 400],
    },

    // Admin
    { method: 'GET', path: '/api/admin/stats' },
    { method: 'GET', path: '/api/admin/advanced-analytics' },
    { method: 'GET', path: '/api/admin/order-volume?range=today' },
    { method: 'GET', path: '/api/admin/config' },
    {
      method: 'PATCH',
      path: '/api/admin/config',
      body: {},
    },
    { method: 'GET', path: '/api/admin/approvals' },
    { method: 'GET', path: '/api/admin/approvals?inbox=1' },
    {
      method: 'PATCH',
      path: `/api/admin/approvals/${DUMMY_ID}`,
      body: { status: 'APPROVED', type: 'RESTAURANT' },
      expected: [404, 400],
    },
    { method: 'GET', path: '/api/admin/surge' },
    {
      method: 'PATCH',
      path: '/api/admin/surge',
      body: {},
    },
    { method: 'GET', path: '/api/admin/rfm-analysis' },
    { method: 'GET', path: '/api/admin/ml-analytics?range=30d' },
    { method: 'GET', path: '/api/admin/executive-summary' },
    { method: 'GET', path: '/api/admin/export' },
    { method: 'GET', path: '/api/admin/messages' },
    { method: 'GET', path: `/api/admin/users/${adminId}` },
    { method: 'GET', path: `/api/admin/contacts/${customerId}` },
    {
      method: 'GET',
      path: `/api/admin/restaurants/${encodeURIComponent(restaurantId)}/stats`,
    },
    {
      method: 'POST',
      path: '/api/admin/grant-promo',
      body: { customerId: DUMMY_ID },
      expected: [400],
    },
    {
      method: 'POST',
      path: '/api/admin/create-admin',
      body: { firstName: 'Api' },
      expected: [400, 401],
    },

    // Other
    { method: 'GET', path: '/api/recommendations?item=Mohinga&limit=4' },
    {
      method: 'POST',
      path: '/api/upload',
      formData: uploadForm,
    },
  ];

  const results: Result[] = [];
  for (const c of cases) {
    const result = await runCase(c);
    results.push(result);
    console.log(line(result));
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log('\n────────────────────────────────────────');
  console.log(`Summary: ${passed}/${results.length} passed, ${failed.length} failed`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const r of failed) console.log(`  ${line(r)}`);
  }
  console.log('────────────────────────────────────────\n');

  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ Test runner crashed:', error);
  process.exit(1);
});
