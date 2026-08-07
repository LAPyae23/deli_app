'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import {
  DEFAULT_ADMIN_SESSION,
  getAvatarSrc,
  getDisplayName,
  readSession,
  type SessionUser,
  writeSession,
} from '@/lib/session';

function roleLabel(role: string): string {
  if (role === 'ADMIN') return 'Super Admin';
  return role || 'Admin';
}

export default function AdminProfileMenu() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser>(DEFAULT_ADMIN_SESSION);

  const hydrate = useCallback(async () => {
    const session = readSession() || DEFAULT_ADMIN_SESSION;
    setUser(session);

    if (!session.email) return;

    try {
      const params = new URLSearchParams();
      if (session.id) params.set('userId', session.id);
      params.set('email', session.email);
      const res = await fetch(`/api/admin-profiles/me?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success && data.profile) {
        const next: SessionUser = {
          id: data.profile.id,
          firstName: data.profile.firstName,
          lastName: data.profile.lastName,
          email: data.profile.email,
          phone: data.profile.phone || '',
          role: data.profile.role || session.role,
          avatarUrl: data.profile.avatarUrl ?? null,
        };
        writeSession(next);
        setUser(next);
      }
    } catch {
      // Keep local session if refresh fails
    }
  }, []);

  useEffect(() => {
    void hydrate();
    const onSession = () => {
      setUser(readSession() || DEFAULT_ADMIN_SESSION);
    };
    window.addEventListener('fooddash-session-updated', onSession);
    window.addEventListener('storage', onSession);
    return () => {
      window.removeEventListener('fooddash-session-updated', onSession);
      window.removeEventListener('storage', onSession);
    };
  }, [hydrate]);

  const fullName = getDisplayName(user);
  const avatarSrc = getAvatarSrc(user);

  return (
    <button
      type="button"
      onClick={() => router.push('/super-admin-management-terminal/profile')}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-admin/40"
      aria-label={`Open profile for ${fullName}`}
    >
      <AppImage
        key={avatarSrc}
        src={avatarSrc}
        alt={`${fullName} profile photo`}
        width={32}
        height={32}
        className="rounded-full bg-zinc-700 object-cover w-8 h-8"
        unoptimized
      />
      <div className="hidden md:block text-left">
        <p className="text-sm font-semibold leading-tight text-white max-w-[140px] truncate">
          {fullName}
        </p>
        <p className="text-xs text-zinc-500 leading-tight">{roleLabel(user.role)}</p>
      </div>
      <ChevronRight
        className="w-3.5 h-3.5 text-zinc-500 hidden sm:block"
        aria-hidden
      />
    </button>
  );
}
