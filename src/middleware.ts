import { NextResponse, type NextRequest } from 'next/server';
import {
  AUTH_ROLE_HEADER,
  AUTH_USER_HEADER,
  SESSION_COOKIE,
  verifySessionToken,
  type Role,
  type Session,
} from '@/lib/auth';

type Rule = {
  /** Path prefix this rule applies to. */
  prefix: string;
  /** HTTP methods this rule applies to (all if omitted). */
  methods?: string[];
  /** 'public' = no login needed; otherwise roles allowed (empty = any signed-in user). */
  access: 'public' | Role[];
};

// First matching rule wins, so list more specific prefixes first.
const API_RULES: Rule[] = [
  { prefix: '/api/auth/login', access: 'public' },
  { prefix: '/api/auth/register', access: 'public' },
  { prefix: '/api/auth/logout', access: 'public' },
  { prefix: '/api/auth/', access: [] },

  { prefix: '/api/admin/', access: ['ADMIN'] },
  { prefix: '/api/customer/', access: ['CUSTOMER', 'ADMIN'] },
  { prefix: '/api/rider/', access: ['RIDER', 'ADMIN'] },
  // Customers read a restaurant's public profile while tracking an order.
  { prefix: '/api/restaurant/profile', methods: ['GET'], access: [] },
  { prefix: '/api/restaurant/', access: ['RESTAURANT', 'ADMIN'] },

  // Public browsing
  { prefix: '/api/restaurants', methods: ['GET'], access: 'public' },
  { prefix: '/api/menu', methods: ['GET'], access: 'public' },
  { prefix: '/api/recommendations', methods: ['GET'], access: 'public' },
  { prefix: '/api/menu', access: ['RESTAURANT', 'ADMIN'] },
];

const PAGE_RULES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/customer-dashboard', roles: ['CUSTOMER'] },
  { prefix: '/restaurant-vendor-portal', roles: ['RESTAURANT'] },
  { prefix: '/rider-fleet-dashboard', roles: ['RIDER'] },
  { prefix: '/super-admin-management-terminal', roles: ['ADMIN'] },
  { prefix: '/change-password', roles: [] },
];

/** Query params that identify the caller themself for each role. */
const OWN_ID_PARAM: Record<Role, string | null> = {
  CUSTOMER: 'customerId',
  RESTAURANT: 'restaurantId',
  RIDER: 'riderId',
  ADMIN: null,
};

function matchPrefix(pathname: string, prefix: string) {
  return pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix);
}

function json(status: number, message: string) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const session: Session | null = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value
  );

  // Never trust auth headers sent by the client.
  const headers = new Headers(request.headers);
  headers.delete(AUTH_USER_HEADER);
  headers.delete(AUTH_ROLE_HEADER);
  if (session) {
    headers.set(AUTH_USER_HEADER, session.userId);
    headers.set(AUTH_ROLE_HEADER, session.role);
  }
  const next = () => NextResponse.next({ request: { headers } });

  if (pathname.startsWith('/api/')) {
    const rule = API_RULES.find(
      (r) =>
        matchPrefix(pathname, r.prefix) &&
        (!r.methods || r.methods.includes(request.method))
    );
    const access = rule ? rule.access : []; // default: any signed-in user

    if (access === 'public') return next();
    if (!session) return json(401, 'Please sign in');
    if (access.length > 0 && !access.includes(session.role)) {
      return json(403, 'You do not have access to this resource');
    }

    // Non-admins can only pass their own ID in role-identifying query params.
    const ownParam = OWN_ID_PARAM[session.role];
    if (ownParam) {
      const requested = searchParams.get(ownParam);
      if (requested && requested !== session.userId) {
        return json(403, 'You can only access your own data');
      }
    }
    return next();
  }

  const pageRule = PAGE_RULES.find((r) => matchPrefix(pathname, r.prefix));
  if (pageRule) {
    if (!session || (pageRule.roles.length > 0 && !pageRule.roles.includes(session.role))) {
      const url = request.nextUrl.clone();
      url.pathname = '/sign-up-login-screen';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/customer-dashboard/:path*',
    '/restaurant-vendor-portal/:path*',
    '/rider-fleet-dashboard/:path*',
    '/super-admin-management-terminal/:path*',
    '/change-password',
  ],
};
