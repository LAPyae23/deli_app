import { SignJWT, jwtVerify } from 'jose';

export type Role = 'CUSTOMER' | 'RESTAURANT' | 'RIDER' | 'ADMIN';

export type Session = {
  userId: string;
  role: Role;
};

export const SESSION_COOKIE = 'fooddash_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Headers set by middleware after verifying the session cookie. */
export const AUTH_USER_HEADER = 'x-auth-user-id';
export const AUTH_ROLE_HEADER = 'x-auth-role';

const ROLES: ReadonlySet<string> = new Set(['CUSTOMER', 'RESTAURANT', 'RIDER', 'ADMIN']);

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be set (32+ characters) in production');
    }
    // Development-only fallback so `npm run dev` works without extra setup.
    return new TextEncoder().encode('dev-only-insecure-secret-change-me-0123456789');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ role: session.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    const role = String(payload.role || '');
    if (!payload.sub || !ROLES.has(role)) return null;
    return { userId: payload.sub, role: role as Role };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

/**
 * Read the verified session in a route handler. Middleware strips any
 * client-supplied auth headers and sets these only after verifying the JWT.
 */
export function getSession(request: Request): Session | null {
  const userId = request.headers.get(AUTH_USER_HEADER);
  const role = request.headers.get(AUTH_ROLE_HEADER);
  if (!userId || !role || !ROLES.has(role)) return null;
  return { userId, role: role as Role };
}

export function forbidden(message = 'Forbidden') {
  return Response.json({ success: false, message }, { status: 403 });
}

export function unauthorized(message = 'Please sign in') {
  return Response.json({ success: false, message }, { status: 401 });
}

/**
 * For user-scoped routes: non-admins may only act on their own ID.
 * Returns the ID to use, or null if the caller is not allowed.
 */
export function resolveOwnId(
  session: Session | null,
  requestedId: string | null | undefined,
  ownerRole: Role
): string | null {
  if (!session) return null;
  if (session.role === 'ADMIN') return requestedId ? String(requestedId) : null;
  if (session.role !== ownerRole) return null;
  if (requestedId && String(requestedId) !== session.userId) return null;
  return session.userId;
}
