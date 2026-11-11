import type { Role } from '@/lib/auth';

export const BASE = 'http://localhost';

/** A Request as the route sees it after middleware verified the session. */
export function req(
  path: string,
  { method = 'GET', body, user }: { method?: string; body?: unknown; user?: { id: string; role: Role } } = {}
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user) {
    headers['x-auth-user-id'] = user.id;
    headers['x-auth-role'] = user.role;
  }
  return new Request(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

export const params = (id: string) => ({ params: Promise.resolve({ id }) });
