'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, ShieldCheck, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    const sessionId = localStorage.getItem('fooddash_session_id');
    if (!sessionId) {
      window.location.href = '/';
      return;
    }
    setReady(true);
  }, []);

  function goBack() {
    const role = localStorage.getItem('fooddash_session_role');
    if (role === 'ADMIN') router.push('/super-admin-management-terminal');
    else if (role === 'RESTAURANT') router.push('/restaurant-vendor-portal');
    else if (role === 'RIDER') router.push('/rider-fleet-dashboard');
    else router.push('/customer-dashboard');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    const sessionId = localStorage.getItem('fooddash_session_id');
    if (!sessionId) {
      toast.error('Please sign in again');
      return;
    }

    setIsChanging(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: sessionId, oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to change password');
      }
      toast.success(data.message || 'Password updated successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      goBack();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setIsChanging(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(230,36,41,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(23,105,170,0.14),_transparent_50%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10 sm:px-6">
        <button
          type="button"
          onClick={goBack}
          className="mb-6 inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-black/5">
          <div className="relative overflow-hidden bg-gradient-to-br from-primary via-[#C41E24] to-accent px-6 py-7 text-white">
            <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xl font-bold tracking-tight">Change Password</p>
                <p className="text-sm text-white/80">Secure your FoodDash account</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Use at least 8 characters with uppercase, lowercase, number, and special
              character (@$!%*?&#).
            </p>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                Current Password
              </label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="input-field"
                placeholder="Enter current password"
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field pr-11"
                  placeholder="Enter new password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={isChanging}
              className="btn-primary w-full justify-center py-3.5 disabled:opacity-60"
            >
              {isChanging ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {isChanging ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
