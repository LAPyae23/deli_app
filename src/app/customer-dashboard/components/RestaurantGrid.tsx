'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Star, Clock, Bike, Loader2, Store, MapPin } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import { formatMMK } from '@/lib/currency';
import { formatRating } from '@/lib/formatRating';
import type { DeliveryAddressInfo, Restaurant } from '../types';

type RestaurantProfileDoc = {
  restaurantId?: string;
  restaurantName?: string;
  description?: string;
  logoImage?: string;
  coverImage?: string;
  rating?: number | null;
  reviews?: number;
  address?: string;
  openingTime?: string;
  closingTime?: string;
  storeStatus?: 'OPEN' | 'BUSY' | 'CLOSED' | string;
  location?: { lat?: number; lng?: number };
};

const PLACEHOLDER_IMAGE = '/assets/images/no_image.png';
const DEFAULT_RADIUS_KM = 7;

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function isOpenNow(openingTime?: string, closingTime?: string): boolean {
  if (!openingTime || !closingTime) return true;
  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);
  if (![openH, openM, closeH, closeM].every(Number.isFinite)) return true;

  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const openMins = openH * 60 + openM;
  const closeMins = closeH * 60 + closeM;

  if (openMins === closeMins) return true;
  if (closeMins > openMins) return mins >= openMins && mins < closeMins;
  return mins >= openMins || mins < closeMins;
}

function normalizeStoreStatus(
  value?: string
): 'OPEN' | 'BUSY' | 'CLOSED' {
  const status = String(value || 'OPEN').toUpperCase();
  if (status === 'BUSY' || status === 'CLOSED') return status;
  return 'OPEN';
}

function parseRating(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function mapProfileToRestaurant(profile: RestaurantProfileDoc): Restaurant {
  const coverImage = profile.coverImage || '';
  const logoImage = profile.logoImage || '';
  const image = coverImage || logoImage || PLACEHOLDER_IMAGE;
  const name = profile.restaurantName || 'Restaurant';
  const lat = Number(profile.location?.lat);
  const lng = Number(profile.location?.lng);
  const storeStatus = normalizeStoreStatus(profile.storeStatus);
  const withinHours = isOpenNow(profile.openingTime, profile.closingTime);
  const isOpen = storeStatus === 'OPEN' && withinHours;
  return {
    id: profile.restaurantId || name,
    name,
    cuisine: profile.description?.trim() || profile.address || 'Local restaurant',
    rating: parseRating(profile.rating),
    reviews: Number(profile.reviews) || 0,
    deliveryTime: '20-35 min',
    deliveryFee: 1500,
    minOrder: 0,
    image,
    imageAlt: `${name} cover photo`,
    logoImage,
    coverImage,
    tags: [],
    isOpen,
    storeStatus,
    discount: null,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    location: profile.location,
  };
}

function restaurantBadge(r: Restaurant): { label: string; show: boolean } {
  if (r.storeStatus === 'CLOSED') return { label: 'Closed', show: true };
  if (r.storeStatus === 'BUSY') return { label: 'Temporarily Unavailable', show: true };
  if (!r.isOpen) return { label: 'Closed Now', show: true };
  return { label: '', show: false };
}

function canSelectRestaurant(r: Restaurant): boolean {
  return r.storeStatus === 'OPEN' && r.isOpen;
}

interface RestaurantGridProps {
  onSelectRestaurant?: (restaurant: Restaurant) => void;
  deliveryAddress?: DeliveryAddressInfo | any;
  searchQuery?: string;
}

export default function RestaurantGrid({
  onSelectRestaurant,
  deliveryAddress,
  searchQuery,
}: RestaurantGridProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [maxRadiusKm, setMaxRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRestaurants() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/restaurants');
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to load restaurants');
        }
        if (cancelled) return;
        const mapped = (Array.isArray(data.restaurants) ? data.restaurants : []).map(
          mapProfileToRestaurant
        );
        setRestaurants(mapped);
        const radius = Number(data.maxDeliveryRadiusKm);
        if (Number.isFinite(radius) && radius >= 1) {
          setMaxRadiusKm(Math.min(20, Math.round(radius)));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load restaurants');
          setRestaurants([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadRestaurants();
    return () => {
      cancelled = true;
    };
  }, []);

  const nearbyRestaurants = useMemo(() => {
    return restaurants
      .map((restaurant) => {
        const resLat = Number(restaurant.lat || restaurant.location?.lat);
        const resLng = Number(restaurant.lng || restaurant.location?.lng);
        const custLat = Number(deliveryAddress?.lat);
        const custLng = Number(deliveryAddress?.lng);

        if (
          !Number.isFinite(resLat) ||
          !Number.isFinite(resLng) ||
          !Number.isFinite(custLat) ||
          !Number.isFinite(custLng) ||
          !resLat ||
          !resLng ||
          !custLat ||
          !custLng
        ) {
          return { ...restaurant, distanceKm: undefined as number | undefined };
        }

        const distance = haversineKm(
          { lat: resLat, lng: resLng },
          { lat: custLat, lng: custLng }
        );
        return { ...restaurant, distanceKm: distance };
      })
      .filter((restaurant) => {
        const resLat = Number(restaurant.lat || restaurant.location?.lat);
        const resLng = Number(restaurant.lng || restaurant.location?.lng);
        const custLat = Number(deliveryAddress?.lat);
        const custLng = Number(deliveryAddress?.lng);

        if (!resLat || !resLng || !custLat || !custLng) return true; // Fallback if coords are missing

        return (restaurant.distanceKm ?? 0) <= maxRadiusKm;
      })
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }, [restaurants, deliveryAddress?.lat, deliveryAddress?.lng, maxRadiusKm]);

  const filteredRestaurants = nearbyRestaurants.filter((restaurant) => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    return (
      (restaurant.name && restaurant.name.toLowerCase().includes(lowerQuery)) ||
      (restaurant.cuisine && restaurant.cuisine.toLowerCase().includes(lowerQuery)) ||
      (restaurant.tags && restaurant.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)))
    );
  });

  return (
    <section>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-foreground">Restaurants Near You</h2>
        <p className="text-sm text-muted-foreground">
          Within {maxRadiusKm} km of your delivery address
          {deliveryAddress?.address ? ` · ${deliveryAddress.address}` : ''}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-customer" />
          <p className="text-sm font-medium">Loading restaurants…</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-2xl border border-danger/30 bg-card px-6 py-10 text-center">
          <p className="text-sm font-semibold text-foreground">Couldn’t load restaurants</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {!isLoading && !error && restaurants.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <Store className="h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-bold text-foreground">No restaurants yet</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Restaurant profiles will appear here once vendors set up their shops.
          </p>
        </div>
      )}

      {!isLoading && !error && restaurants.length > 0 && nearbyRestaurants.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <MapPin className="h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-bold text-foreground">No restaurants nearby</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Nothing within {maxRadiusKm} km of your delivery address. Try updating your address
            in Profile.
          </p>
        </div>
      )}

      {!isLoading &&
        !error &&
        nearbyRestaurants.length > 0 &&
        filteredRestaurants.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-center">
            <Store className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-bold text-foreground">No matches</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              No restaurants match “{searchQuery}”. Try another name, cuisine, or tag.
            </p>
          </div>
        )}

      {!isLoading && !error && filteredRestaurants.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredRestaurants.map((r) => {
            const selectable = canSelectRestaurant(r);
            const badge = restaurantBadge(r);
            const coverSrc = r.coverImage || r.image;
            const logoSrc = r.logoImage;
            return (
              <div
                key={r.id}
                role="button"
                tabIndex={selectable ? 0 : -1}
                aria-disabled={!selectable}
                onClick={() => selectable && onSelectRestaurant?.(r)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && selectable) {
                    e.preventDefault();
                    onSelectRestaurant?.(r);
                  }
                }}
                className={`group overflow-hidden rounded-xl border border-border bg-card card-shadow transition-all duration-200 ${
                  selectable
                    ? 'cursor-pointer hover:card-shadow-md'
                    : 'cursor-not-allowed grayscale opacity-60'
                }`}
              >
                <div className="relative h-40 overflow-hidden bg-muted">
                    <AppImage
                      src={coverSrc}
                      alt={r.imageAlt}
                      fill
                      fallbackSrc={PLACEHOLDER_IMAGE}
                      className={`object-cover transition-transform duration-300 ${
                        selectable ? 'group-hover:scale-105' : ''
                      }`}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                    {logoSrc ? (
                      <div className="absolute bottom-2 left-2 h-10 w-10 overflow-hidden rounded-lg border border-white/80 bg-card shadow-sm">
                        <AppImage
                          src={logoSrc}
                          alt={`${r.name} logo`}
                          fill
                          fallbackSrc={PLACEHOLDER_IMAGE}
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                    ) : null}
                  {typeof r.distanceKm === 'number' && (
                    <div className="absolute right-2 top-2 rounded-lg bg-card/95 px-2 py-1 text-xs font-bold text-foreground shadow-sm backdrop-blur-sm">
                      {r.distanceKm.toFixed(1)} km
                    </div>
                  )}
                  {r.discount && selectable && (
                    <div className="absolute left-2 top-2 rounded-lg bg-customer px-2 py-1 text-xs font-bold text-white">
                      {r.discount}
                    </div>
                  )}
                  {badge.show && (
                    <div className="absolute inset-0 flex items-center justify-center bg-foreground/55">
                      <span className="rounded-full bg-card px-3 py-1.5 text-xs font-bold text-foreground shadow-sm">
                        {badge.label}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3.5">
                  <div className="mb-0.5 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-foreground">{r.name}</h3>
                    {badge.show && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {r.storeStatus === 'BUSY' ? 'Busy' : 'Closed'}
                      </span>
                    )}
                  </div>
                  <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{r.cuisine}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <Star className="h-3 w-3 fill-warning text-warning" />
                      {formatRating(r.rating)}
                      {r.reviews > 0 && (
                        <span className="font-normal text-muted-foreground">
                          ({r.reviews.toLocaleString()})
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {r.deliveryTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bike className="h-3 w-3" />
                      {r.deliveryFee === 0 ? 'Free' : formatMMK(r.deliveryFee)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
