export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  avatarUrl: string | null;
}

export const SESSION_STORAGE_KEY = 'fooddash-session';

export const DEFAULT_ADMIN_AVATAR =
  'https://api.dicebear.com/7.x/avataaars/svg?seed=admin';

export function getDefaultAvatar(seed?: string): string {
  const safe = encodeURIComponent(seed || 'admin');
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${safe}`;
}

export function getDisplayName(user: Pick<SessionUser, 'firstName' | 'lastName' | 'email'>): string {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.email || 'Admin';
}

export function getAvatarSrc(user: Pick<SessionUser, 'avatarUrl' | 'email' | 'firstName'>): string {
  if (user.avatarUrl) return user.avatarUrl;
  return getDefaultAvatar(user.email || user.firstName || 'admin');
}

export function readSession(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    if (!parsed?.email) return null;
    return {
      id: String(parsed.id || ''),
      firstName: String(parsed.firstName || ''),
      lastName: String(parsed.lastName || ''),
      email: String(parsed.email || ''),
      phone: String(parsed.phone || ''),
      role: String(parsed.role || 'ADMIN'),
      avatarUrl: parsed.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}

export function writeSession(user: SessionUser): void {
  if (typeof window === 'undefined') return;
  const safe: SessionUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(safe));
  window.dispatchEvent(new Event('fooddash-session-updated'));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
  window.dispatchEvent(new Event('fooddash-session-updated'));
}

export const DEFAULT_ADMIN_SESSION: SessionUser = {
  id: '',
  firstName: 'Ops',
  lastName: 'Admin',
  email: 'ops.admin@fooddash.app',
  phone: '',
  role: 'ADMIN',
  avatarUrl: null,
};
