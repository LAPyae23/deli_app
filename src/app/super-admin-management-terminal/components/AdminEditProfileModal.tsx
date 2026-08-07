'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Camera, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import AppImage from '@/components/ui/AppImage';
import {
  getAvatarSrc,
  getDisplayName,
  type SessionUser,
  writeSession,
} from '@/lib/session';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

interface EditProfileForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface AdminEditProfileModalProps {
  open: boolean;
  user: SessionUser;
  onClose: () => void;
  onSaved: (user: SessionUser) => void;
}

export default function AdminEditProfileModal({
  open,
  user,
  onClose,
  onSaved,
}: AdminEditProfileModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.avatarUrl);
  const [removePhoto, setRemovePhoto] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<EditProfileForm>({
    mode: 'onChange',
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
    });
    setPreviewUrl(user.avatarUrl);
    setRemovePhoto(false);
    setPhotoError(null);
    setSaving(false);
  }, [open, user, reset]);

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

  const displayPreview = removePhoto
    ? getAvatarSrc({ ...user, avatarUrl: null })
    : previewUrl || getAvatarSrc(user);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setPhotoError('Only JPG, JPEG, PNG, and WebP images are allowed.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setPhotoError('Image must be 5 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result) {
        setPhotoError('Could not read the selected image.');
        return;
      }
      setPreviewUrl(result);
      setRemovePhoto(false);
      setPhotoError(null);
    };
    reader.onerror = () => setPhotoError('Could not read the selected image.');
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPreviewUrl(null);
    setRemovePhoto(true);
    setPhotoError(null);
  };

  const onSubmit = async (data: EditProfileForm) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        userId: user.id,
        emailLookup: user.email,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
      };

      if (removePhoto) {
        payload.clearAvatar = true;
        payload.avatarUrl = null;
      } else if (previewUrl && previewUrl.startsWith('data:')) {
        payload.avatarUrl = previewUrl;
      }

      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        toast.error(result.message || 'Could not save profile');
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
      toast.success('Profile updated successfully');
      onClose();
    } catch {
      toast.error('Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close edit profile dialog"
        onClick={() => !saving && onClose()}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="relative w-full sm:max-w-lg bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 id="edit-profile-title" className="text-base font-bold text-white">
              Edit Profile
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Update your account details for {getDisplayName(user)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-admin/50"
            aria-label="Close"
            disabled={saving}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto px-5 py-5 space-y-5"
        >
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative">
              <AppImage
                key={displayPreview}
                src={displayPreview}
                alt="Profile photo preview"
                width={80}
                height={80}
                className="rounded-full bg-zinc-800 object-cover w-20 h-20"
                unoptimized
              />
            </div>
            <div className="flex flex-col items-center sm:items-start gap-2 w-full">
              <p className="text-sm font-medium text-white">Profile photo</p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-admin/50 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {previewUrl && !removePhoto ? 'Change photo' : 'Upload photo'}
                </button>
                {(user.avatarUrl || (previewUrl && !removePhoto)) && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-danger hover:border-danger/40 focus:outline-none focus:ring-2 focus:ring-danger/40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[11px] text-zinc-600">JPG, JPEG, PNG, or WebP · max 5 MB</p>
              {photoError && (
                <p className="text-xs text-danger" role="alert">
                  {photoError}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="sr-only"
                onChange={handleFileChange}
                aria-label="Upload profile photo"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="admin-first-name" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                First name
              </label>
              <input
                id="admin-first-name"
                type="text"
                autoComplete="given-name"
                className="w-full px-3.5 py-2.5 text-sm text-white bg-zinc-950 border border-zinc-700 rounded-lg outline-none placeholder:text-zinc-600 focus:border-admin focus:ring-2 focus:ring-admin/30"
                placeholder="First name"
                {...register('firstName', {
                  required: 'First name is required',
                  validate: (v) => v.trim().length > 0 || 'First name cannot be empty',
                })}
              />
              {errors.firstName && (
                <p className="mt-1 text-xs text-danger" role="alert">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="admin-last-name" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Last name
              </label>
              <input
                id="admin-last-name"
                type="text"
                autoComplete="family-name"
                className="w-full px-3.5 py-2.5 text-sm text-white bg-zinc-950 border border-zinc-700 rounded-lg outline-none placeholder:text-zinc-600 focus:border-admin focus:ring-2 focus:ring-admin/30"
                placeholder="Last name"
                {...register('lastName', {
                  required: 'Last name is required',
                  validate: (v) => v.trim().length > 0 || 'Last name cannot be empty',
                })}
              />
              {errors.lastName && (
                <p className="mt-1 text-xs text-danger" role="alert">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="admin-email" className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Email address
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              className="w-full px-3.5 py-2.5 text-sm text-white bg-zinc-950 border border-zinc-700 rounded-lg outline-none placeholder:text-zinc-600 focus:border-admin focus:ring-2 focus:ring-admin/30"
              placeholder="you@example.com"
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Enter a valid email address',
                },
              })}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-danger" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="admin-phone" className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Phone number
            </label>
            <input
              id="admin-phone"
              type="tel"
              autoComplete="tel"
              className="w-full px-3.5 py-2.5 text-sm text-white bg-zinc-950 border border-zinc-700 rounded-lg outline-none placeholder:text-zinc-600 focus:border-admin focus:ring-2 focus:ring-admin/30"
              placeholder="+1 (555) 000-0000"
              {...register('phone')}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-zinc-800">
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
              disabled={!isValid || saving || Boolean(photoError)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-admin text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-admin/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
