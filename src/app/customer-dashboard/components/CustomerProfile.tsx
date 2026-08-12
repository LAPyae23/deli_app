'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { User, Phone, Mail, MapPin, Save, Plus, Camera, Lock, MessageCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ChatWidget from '@/components/ChatWidget';
import {
  SUPPORT_ADMIN_ID,
  SUPPORT_ADMIN_NAME,
  SUPPORT_ADMIN_ROLE,
} from '@/lib/support';
import type { DeliveryAddressInfo } from '../types';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type ProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  profileImage: string;
  displayId?: string;
};

type ProfileUserData = {
  firstName: string;
  lastName: string;
  profileImage: string;
  displayId?: string;
};

interface CustomerProfileProps {
  deliveryAddress: DeliveryAddressInfo;
  savedAddresses: DeliveryAddressInfo[];
  onSelectSavedAddress: (address: DeliveryAddressInfo) => void;
  onRemoveSavedAddress: (address: DeliveryAddressInfo) => void;
  onOpenAddressPicker: () => void;
  onProfileUpdate: (userData: ProfileUserData) => void;
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export default function CustomerProfile({
  deliveryAddress,
  savedAddresses,
  onSelectSavedAddress,
  onRemoveSavedAddress,
  onOpenAddressPicker,
  onProfileUpdate,
}: CustomerProfileProps) {
  const [form, setForm] = useState<ProfileForm>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    profileImage: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [supportOpen, setSupportOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setIsLoading(true);
      try {
        const sessionId = localStorage.getItem('fooddash_session_id');
        if (!sessionId) {
          if (!cancelled) setIsLoading(false);
          return;
        }
        if (!cancelled) setSessionId(sessionId);

        const res = await fetch(
          `/api/customer/profile?customerId=${encodeURIComponent(sessionId)}`
        );
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load');

        if (!cancelled && data.profile) {
          const { firstName, lastName } = splitFullName(data.profile.name || '');
          setForm({
            firstName,
            lastName,
            phone: data.profile.phone || '',
            email: data.profile.email || '',
            profileImage: data.profile.profileImage || '',
            displayId: data.profile.displayId || '',
          });
        }
      } catch (error) {
        console.warn(error);
        if (!cancelled) toast.error('Failed to load profile');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image size should be less than 2MB');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Uploading image...');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.message || 'Upload failed');
      }
      setForm((prev) => ({ ...prev, profileImage: data.url as string }));
      toast.success('Image uploaded', { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload image', {
        id: toastId,
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim()) {
      toast.error('First name is required');
      return;
    }

    const fullName = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' ');
    const sessionId = localStorage.getItem('fooddash_session_id');
    if (!sessionId) {
      toast.error('Please sign in again');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: sessionId,
          name: fullName,
          phone: form.phone.trim(),
          email: form.email.trim(),
          profileImage: form.profileImage,
          savedAddresses,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Save failed');

      const userData = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        profileImage: form.profileImage,
      };
      onProfileUpdate(userData);
      window.dispatchEvent(
        new CustomEvent('fooddash:customer-profile-updated', { detail: userData })
      );
      toast.success('Profile saved');
    } catch (error) {
      console.warn(error);
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-customer border-t-transparent" />
        <p className="text-sm font-medium">Loading profile…</p>
      </div>
    );
  }

  const displayName = [form.firstName, form.lastName].filter(Boolean).join(' ') || 'Your name';

  return (
    <div className="mx-auto max-w-xl space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">My Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your photo, personal details, and delivery addresses.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col items-center gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-2 border-border bg-muted">
              {form.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.profileImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-customer">
                  <User className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="font-semibold text-foreground">{displayName}</p>
              {form.displayId && (
                <p className="inline-block px-2 py-0.5 mt-1 mb-1 rounded bg-customer/10 text-customer text-[10px] font-bold tracking-widest uppercase">
                  {form.displayId}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{form.email || 'Add your email'}</p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <label
                  className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted ${
                    isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'
                  }`}
                >
                  <Camera className="h-3.5 w-3.5" />
                  {isUploading ? 'Uploading…' : 'Change Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isUploading}
                    onChange={handleImageUpload}
                  />
                </label>
                {form.profileImage && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, profileImage: '' }))}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">Max 2MB · JPG or PNG</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">First Name</label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="input-field"
                placeholder="e.g. Maya"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="input-field"
                placeholder="e.g. Chen"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              Phone
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input-field"
              placeholder="+95 9 xxx xxx xxx"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-field"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-1 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-customer" />
            <h3 className="text-sm font-bold text-foreground">Saved Addresses</h3>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Save multiple locations with labels like Home or Work, then pick one at checkout.
          </p>

          <div className="space-y-3">
            {savedAddresses.length === 0 && (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No saved addresses yet. Add one from the map below.
              </p>
            )}
            {savedAddresses.map((a) => {
              const isActive =
                a.lat === deliveryAddress.lat &&
                a.lng === deliveryAddress.lng &&
                a.label === deliveryAddress.label;
              return (
                <div
                  key={`${a.label}-${a.lat}-${a.lng}`}
                  className={`flex w-full items-center gap-3 rounded-xl border p-4 transition-all ${
                    isActive
                      ? 'border-customer bg-orange-50'
                      : 'border-border bg-muted/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSavedAddress(a);
                      toast.success(`Delivering to ${a.label}`);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <MapPin className="h-4 w-4 flex-shrink-0 text-customer" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-muted-foreground">{a.label}</p>
                      <p className="truncate text-sm font-medium">{a.address}</p>
                    </div>
                    {isActive && (
                      <span className="rounded-full border border-customer/30 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-customer">
                        Active
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${a.label}`}
                    onClick={() => onRemoveSavedAddress(a)}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenAddressPicker}
            className="btn-primary mt-4 w-full justify-center gap-2 py-3"
          >
            <Plus className="h-4 w-4" />
            Add Address on Map
          </button>
        </div>

        <button type="submit" disabled={isSaving} className="btn-primary w-full justify-center py-3">
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving…' : 'Save Profile'}
        </button>
      </form>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-customer" />
          <h3 className="text-sm font-bold text-foreground">Support</h3>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Chat with FoodDash Support for order help, refunds, or account issues.
        </p>
        <button
          type="button"
          onClick={() => setSupportOpen(true)}
          className="btn-primary w-full justify-center py-3"
        >
          <MessageCircle className="h-4 w-4" />
          Contact Support
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <Lock className="h-4 w-4 text-customer" />
          <h3 className="text-sm font-bold text-foreground">Security</h3>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Keep your account safe with a strong password.
        </p>
        <Link href="/change-password" className="btn-secondary w-full justify-center py-3">
          <Lock className="h-4 w-4" />
          Change Password
        </Link>
      </div>

      {sessionId && (
        <ChatWidget
          currentUserId={sessionId}
          currentUserRole="CUSTOMER"
          targetUserId={SUPPORT_ADMIN_ID}
          targetUserRole={SUPPORT_ADMIN_ROLE}
          targetName={SUPPORT_ADMIN_NAME}
          open={supportOpen}
          onOpenChange={setSupportOpen}
          showLauncher={false}
          accentClassName="bg-customer"
        />
      )}
    </div>
  );
}
