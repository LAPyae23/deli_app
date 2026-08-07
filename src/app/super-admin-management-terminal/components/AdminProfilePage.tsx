'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import AppImage from '@/components/ui/AppImage';
import {
  clearSession,
  DEFAULT_ADMIN_SESSION,
  getAvatarSrc,
  getDisplayName,
  readSession,
  type SessionUser,
  writeSession,
} from '@/lib/session';
import AdminEditProfileModal from './AdminEditProfileModal';
import AdminChangePasswordModal from './AdminChangePasswordModal';

function roleLabel(role: string): string {
  if (role === 'ADMIN') return 'Super Admin';
  return role || 'Admin';
}

export default function AdminProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser>(DEFAULT_ADMIN_SESSION);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    const session = readSession() || DEFAULT_ADMIN_SESSION;
    setUser(session);

    if (!session.email && !session.id) {
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (session.id) params.set('userId', session.id);
      if (session.email) params.set('email', session.email);

      const res = await fetch(`/api/admin-profiles/me?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success && data.profile) {
        const next: SessionUser = {
          id: data.profile.id || session.id,
          firstName: data.profile.firstName,
          lastName: data.profile.lastName,
          email: data.profile.email,
          phone: data.profile.phone || '',
          role: data.profile.role || 'ADMIN',
          avatarUrl: data.profile.avatarUrl ?? null,
        };
        writeSession(next);
        setUser(next);
      }
    } catch {
      toast.error('Could not load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    const onSession = () => setUser(readSession() || DEFAULT_ADMIN_SESSION);
    window.addEventListener('fooddash-session-updated', onSession);
    return () => window.removeEventListener('fooddash-session-updated', onSession);
  }, [loadProfile]);

  const fullName = getDisplayName(user);
  const avatarSrc = getAvatarSrc(user);

  const handleLogout = () => {
    clearSession();
    toast.success('Signed out');
    router.push('/');
  };

  const handleSaved = (next: SessionUser) => {
    setUser(next);
  };

  return (
    <div className="p-4 sm:p-6 xl:p-8 max-w-3xl mx-auto">
      <button
        type="button"
        onClick={() => router.push('/super-admin-management-terminal')}
        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-200 transition-colors mb-6 focus:outline-none focus:ring-2 focus:ring-admin/40 rounded-lg px-1 py-1"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Back to dashboard
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">View Profile</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage your admin account details and security
        </p>
      </div>

      {loading ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 flex items-center justify-center gap-2 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
          Loading profile...
        </div>
      ) : (
        <div className="space-y-4">
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="h-1 bg-admin" aria-hidden />
            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <AppImage
                  key={avatarSrc}
                  src={avatarSrc}
                  alt={`${fullName} profile photo`}
                  width={96}
                  height={96}
                  className="rounded-full bg-zinc-800 object-cover w-24 h-24 ring-2 ring-admin/30 flex-shrink-0"
                  unoptimized
                />
                <div className="text-center sm:text-left min-w-0 flex-1">
                  <p className="text-xl font-bold text-white truncate">{fullName}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-admin">
                    <ShieldCheck className="w-4 h-4" aria-hidden />
                    {roleLabel(user.role)}
                  </p>
                  <p className="text-sm text-zinc-500 mt-2 break-all">{user.email}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
            <div className="flex items-start gap-3 px-5 py-4">
              <Mail className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Email</p>
                <p className="text-sm text-zinc-200 break-all mt-0.5">{user.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-5 py-4">
              <Phone className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Phone</p>
                <p className="text-sm text-zinc-200 break-all mt-0.5">{user.phone || 'Not set'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-5 py-4">
              <ShieldCheck className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Role</p>
                <p className="text-sm text-zinc-200 mt-0.5">{roleLabel(user.role)}</p>
              </div>
            </div>
          </section>

          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3 px-1">
              Account actions
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl bg-admin text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-admin/50 transition-all"
              >
                <Pencil className="w-4 h-4" aria-hidden />
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => setPasswordOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-admin/40 transition-colors"
              >
                <KeyRound className="w-4 h-4" aria-hidden />
                Change Password
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 focus:outline-none focus:ring-2 focus:ring-danger/40 transition-colors"
              >
                <LogOut className="w-4 h-4" aria-hidden />
                Log out
              </button>
            </div>
          </section>
        </div>
      )}

      <AdminEditProfileModal
        open={editOpen}
        user={user}
        onClose={() => setEditOpen(false)}
        onSaved={handleSaved}
      />
      <AdminChangePasswordModal
        open={passwordOpen}
        user={user}
        onClose={() => setPasswordOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
