'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Store, Image as ImageIcon, Crosshair, Clock, Save, X, Lock, MessageCircle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import ChatWidget from '@/components/ChatWidget';
import {
  SUPPORT_ADMIN_ID,
  SUPPORT_ADMIN_NAME,
  SUPPORT_ADMIN_ROLE,
} from '@/lib/support';

const ProfileMap = dynamic(() => import('./ProfileMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

const YANGON_CENTER = { lat: 16.8409, lng: 96.1735 };
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type ProfileForm = {
  restaurantName: string;
  description: string;
  logoImage: string;
  coverImage: string;
  address: string;
  openingTime: string;
  closingTime: string;
  lat: number;
  lng: number;
};

const INITIAL_FORM: ProfileForm = {
  restaurantName: '',
  description: '',
  logoImage: '',
  coverImage: '',
  address: '',
  openingTime: '09:00',
  closingTime: '22:00',
  lat: YANGON_CENTER.lat,
  lng: YANGON_CENTER.lng,
};

function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default function RestaurantProfile() {
  const [form, setForm] = useState<ProfileForm>(INITIAL_FORM);
  const [restaurantId, setRestaurantId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setIsLoading(true);
      try {
        const sessionId = localStorage.getItem('fooddash_session_id') || '';
        const sessionName = localStorage.getItem('fooddash_session_name') || '';
        const sessionEmail = localStorage.getItem('fooddash_session_email') || '';

        if (!sessionId) {
          if (!cancelled) {
            setRestaurantId('');
            setForm((prev) => ({
              ...prev,
              restaurantName: sessionName || sessionEmail || '',
            }));
            toast.error('Please sign in again to manage your restaurant profile');
          }
          return;
        }

        setRestaurantId(sessionId);

        const res = await fetch(
          `/api/restaurant/profile?restaurantId=${encodeURIComponent(sessionId)}`
        );
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load');

        if (!cancelled && data.profile) {
          const p = data.profile;
          setForm({
            restaurantName: p.restaurantName || sessionName || '',
            description: p.description || '',
            logoImage: p.logoImage || '',
            coverImage: p.coverImage || '',
            address: p.address || '',
            openingTime: p.openingTime || '09:00',
            closingTime: p.closingTime || '22:00',
            lat: p.location?.lat ?? YANGON_CENTER.lat,
            lng: p.location?.lng ?? YANGON_CENTER.lng,
          });
          setMapKey((k) => k + 1);
        } else if (!cancelled) {
          setForm((prev) => ({
            ...prev,
            restaurantName: sessionName || sessionEmail || '',
          }));
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) toast.error('Failed to load restaurant profile');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logoImage' | 'coverImage'
  ) => {
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
      setForm((prev) => ({ ...prev, [field]: data.url as string }));
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

  const handleMapPick = useCallback(async (lat: number, lng: number) => {
    const fallbackAddress = `Pinned location · ${formatCoords(lat, lng)}`;

    setIsGeocoding(true);
    setForm((prev) => ({
      ...prev,
      lat,
      lng,
      address: 'Fetching address...',
    }));

    try {
      const res = await fetch(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng,
        { headers: { Accept: 'application/json' } }
      );
      const data = await res.json();
      if (data && data.display_name) {
        setForm((prev) => ({ ...prev, lat, lng, address: data.display_name }));
      } else {
        setForm((prev) => ({ ...prev, lat, lng, address: fallbackAddress }));
      }
    } catch {
      setForm((prev) => ({ ...prev, lat, lng, address: fallbackAddress }));
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.restaurantName.trim()) {
      toast.error('Restaurant name is required');
      return;
    }

    const sessionId =
      restaurantId || localStorage.getItem('fooddash_session_id') || '';
    if (!sessionId) {
      toast.error('Missing session. Please sign in again.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/restaurant/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: sessionId,
          restaurantName: form.restaurantName.trim(),
          description: form.description.trim(),
          logoImage: form.logoImage,
          coverImage: form.coverImage,
          address: form.address.trim(),
          openingTime: form.openingTime,
          closingTime: form.closingTime,
          location: { lat: form.lat, lng: form.lng },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Save failed');

      localStorage.setItem('fooddash_session_name', form.restaurantName.trim());
      setRestaurantId(sessionId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('fooddash:restaurant-profile-updated', {
            detail: {
              restaurantName: form.restaurantName.trim(),
              address: form.address.trim(),
              logoImage: form.logoImage || '',
            },
          })
        );
      }
      toast.success('Restaurant profile saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-restaurant border-t-transparent" />
        <p className="text-sm font-medium">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Restaurant Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update store details, branding images, and map location.
          </p>
        </div>
        <button type="submit" disabled={isSaving} className="btn-primary py-2.5">
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>

      {/* Cover + logo */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card card-shadow">
        <div className="relative h-40 bg-muted sm:h-52">
          {form.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.coverImage} alt="Cover" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
              <p className="text-xs">No cover image</p>
            </div>
          )}
          <label
            className={`absolute bottom-3 right-3 rounded-xl border border-border bg-card/95 px-3 py-2 text-xs font-semibold shadow-sm backdrop-blur-sm transition-colors hover:bg-card ${
              isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'
            }`}
          >
            {isUploading ? 'Uploading…' : 'Upload Cover'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => handleImageUpload(e, 'coverImage')}
            />
          </label>
          {form.coverImage && (
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, coverImage: '' }))}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              aria-label="Remove cover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end">
          <div className="-mt-10 relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-muted shadow-md sm:h-28 sm:w-28">
            {form.logoImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoImage} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Store className="h-8 w-8" />
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2 sm:pb-1">
            <label
              className={`rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted ${
                isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'
              }`}
            >
              {isUploading ? 'Uploading…' : 'Upload Logo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploading}
                onChange={(e) => handleImageUpload(e, 'logoImage')}
              />
            </label>
            {form.logoImage && (
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, logoImage: '' }))}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10"
              >
                Remove logo
              </button>
            )}
            <p className="w-full text-[11px] text-muted-foreground">Max 2MB · Square logo recommended</p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 card-shadow sm:p-6">
        <h2 className="text-sm font-bold text-foreground">Store details</h2>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Restaurant Name</label>
          <input
            type="text"
            required
            value={form.restaurantName}
            onChange={(e) => setForm({ ...form, restaurantName: e.target.value })}
            className="input-field"
            placeholder="Your restaurant name"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-field h-24 resize-none"
            placeholder="Tell customers about your restaurant…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Opening Time
            </label>
            <input
              type="time"
              value={form.openingTime}
              onChange={(e) => setForm({ ...form, openingTime: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Closing Time
            </label>
            <input
              type="time"
              value={form.closingTime}
              onChange={(e) => setForm({ ...form, closingTime: e.target.value })}
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Address</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="input-field"
            placeholder="145 Broadway Ave, Manhattan"
            disabled={isGeocoding}
            readOnly={isGeocoding}
          />
          {isGeocoding && (
            <p className="mt-1.5 text-[11px] font-medium text-restaurant">Looking up address from map pin…</p>
          )}
        </div>
      </div>

      {/* Map picker */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card card-shadow">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-bold text-foreground">Map location</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Click the map to drop a pin at your exact store location.
          </p>
        </div>

        <div className="relative h-64 bg-muted sm:h-80">
          <ProfileMap
            key={mapKey}
            lat={form.lat}
            lng={form.lng}
            onPick={handleMapPick}
          />
        </div>

        <div className="flex items-start gap-3 border-t border-border px-5 py-4">
          <Crosshair className="mt-0.5 h-4 w-4 flex-shrink-0 text-restaurant" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Pinned coordinates</p>
            <p className="text-xs text-muted-foreground font-tabular">
              {formatCoords(form.lat, form.lng)} · Yangon, Myanmar
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end pb-4">
        <button type="submit" disabled={isSaving} className="btn-primary px-6 py-3">
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </form>

    <div className="rounded-2xl border border-border bg-card p-5 card-shadow sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-restaurant" />
        <h2 className="text-sm font-bold text-foreground">Support</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Contact FoodDash Support about payouts, approvals, or portal issues.
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

    <div className="rounded-2xl border border-border bg-card p-5 card-shadow sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Lock className="h-4 w-4 text-restaurant" />
        <h2 className="text-sm font-bold text-foreground">Security</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Keep your restaurant account secure with a strong password.
      </p>
      <Link href="/change-password" className="btn-secondary w-full justify-center py-3">
        <Lock className="h-4 w-4" />
        Change Password
      </Link>
    </div>

    {restaurantId && (
      <ChatWidget
        currentUserId={restaurantId}
        currentUserRole="RESTAURANT"
        targetUserId={SUPPORT_ADMIN_ID}
        targetUserRole={SUPPORT_ADMIN_ROLE}
        targetName={SUPPORT_ADMIN_NAME}
        open={supportOpen}
        onOpenChange={setSupportOpen}
        showLauncher={false}
        accentClassName="bg-restaurant"
      />
    )}
    </div>
  );
}
