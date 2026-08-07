'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { KeyRound, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { SessionUser } from '@/lib/session';
import { writeSession } from '@/lib/session';
import {
  getPasswordRequirements,
  isPasswordValid,
  PASSWORD_ERROR_MESSAGE,
} from '@/lib/password';

interface ChangePasswordForm {
  password: string;
  confirmPassword: string;
}

interface AdminChangePasswordModalProps {
  open: boolean;
  user: SessionUser;
  onClose: () => void;
  onSaved: (user: SessionUser) => void;
}

export default function AdminChangePasswordModal({
  open,
  user,
  onClose,
  onSaved,
}: AdminChangePasswordModalProps) {
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm<ChangePasswordForm>({
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = watch('password') || '';
  const requirements = getPasswordRequirements(password);

  useEffect(() => {
    if (!open) return;
    reset({ password: '', confirmPassword: '' });
    setSaving(false);
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, saving]);

  if (!open) return null;

  const onSubmit = async (data: ChangePasswordForm) => {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          emailLookup: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          password: data.password,
        }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        toast.error(result.message || 'Could not update password');
        return;
      }

      const nextUser: SessionUser = {
        id: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        phone: result.user.phone || '',
        role: result.user.role || user.role,
        avatarUrl: result.user.avatarUrl ?? null,
      };

      writeSession(nextUser);
      onSaved(nextUser);
      toast.success('Password updated. You can log in with the new password.');
      onClose();
    } catch {
      toast.error('Could not update password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close change password dialog"
        onClick={() => !saving && onClose()}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="relative w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-admin/15 text-admin">
              <KeyRound className="w-4 h-4" />
            </span>
            <div>
              <h2 id="change-password-title" className="text-base font-bold text-white">
                Change Password
              </h2>
              <p className="text-xs text-zinc-500">Updates your login password in the database</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            disabled={saving}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-admin/50 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-5 space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-xs font-semibold text-zinc-400 mb-1.5">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className="w-full px-3.5 py-2.5 text-sm text-white bg-zinc-950 border border-zinc-700 rounded-lg outline-none placeholder:text-zinc-600 focus:border-admin focus:ring-2 focus:ring-admin/30"
              placeholder="Enter new password"
              {...register('password', {
                required: 'Password is required',
                validate: (v) => isPasswordValid(v) || PASSWORD_ERROR_MESSAGE,
              })}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-danger" role="alert">
                {errors.password.message}
              </p>
            )}
            <ul className="mt-2 space-y-1">
              {requirements.map((req) => (
                <li
                  key={req.id}
                  className={`text-[11px] ${req.met ? 'text-success' : 'text-zinc-600'}`}
                >
                  {req.met ? '✓' : '○'} {req.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-xs font-semibold text-zinc-400 mb-1.5"
            >
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              className="w-full px-3.5 py-2.5 text-sm text-white bg-zinc-950 border border-zinc-700 rounded-lg outline-none placeholder:text-zinc-600 focus:border-admin focus:ring-2 focus:ring-admin/30"
              placeholder="Re-enter new password"
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (v) => v === password || 'Passwords do not match',
              })}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-danger" role="alert">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-admin text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-admin/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              {saving ? 'Saving...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
