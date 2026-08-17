'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Loader2,
  MapPin,
  ShoppingBag,
  Store,
  Trophy,
  Wallet,
  X,
} from 'lucide-react';
import { formatKyat } from '@/lib/currency';
import {
  mockRestaurantStats,
  type RestaurantDemoItem,
} from '@/lib/restaurantDemoStats';

export type PerformanceRestaurant = {
  id: string;
  name: string;
  township?: string;
  address?: string;
  storeStatus?: string;
};

type StatsPayload = {
  success: boolean;
  restaurant?: {
    name?: string;
    township?: string;
    address?: string;
    location?: string;
    storeStatus?: string;
    isActive?: boolean;
  };
  kpis?: {
    totalRevenue?: number;
    totalOrdersCompleted?: number;
    averageOrderValue?: number;
  };
  topItems?: RestaurantDemoItem[];
  source?: 'live' | 'mock';
  message?: string;
};

function isActiveStatus(storeStatus?: string, isActive?: boolean) {
  if (typeof isActive === 'boolean') return isActive;
  return String(storeStatus || 'OPEN').toUpperCase() !== 'CLOSED';
}

export default function RestaurantPerformancePanel({
  restaurant,
  onClose,
}: {
  restaurant: PerformanceRestaurant;
  onClose: () => void;
}) {
  const fallback = mockRestaurantStats(restaurant.id);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'live' | 'mock'>('mock');
  const [name, setName] = useState(restaurant.name);
  const [location, setLocation] = useState(
    [restaurant.township, restaurant.address].filter(Boolean).join(' · ') ||
      restaurant.township ||
      'Yangon'
  );
  const [active, setActive] = useState(
    isActiveStatus(restaurant.storeStatus)
  );
  const [revenue, setRevenue] = useState(fallback.totalRevenue);
  const [orders, setOrders] = useState(fallback.totalOrdersCompleted);
  const [aov, setAov] = useState(fallback.averageOrderValue);
  const [topItems, setTopItems] = useState<RestaurantDemoItem[]>(fallback.topItems);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const demo = mockRestaurantStats(restaurant.id);

    setName(restaurant.name);
    setLocation(
      [restaurant.township, restaurant.address].filter(Boolean).join(' · ') ||
        restaurant.township ||
        'Yangon'
    );
    setActive(isActiveStatus(restaurant.storeStatus));
    setRevenue(demo.totalRevenue);
    setOrders(demo.totalOrdersCompleted);
    setAov(demo.averageOrderValue);
    setTopItems(demo.topItems);
    setSource('mock');
    setLoading(true);

    async function load() {
      try {
        const res = await fetch(
          `/api/admin/restaurants/${encodeURIComponent(restaurant.id)}/stats`
        );
        const data = (await res.json()) as StatsPayload;
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
        if (cancelled) return;

        setSource(data.source === 'live' ? 'live' : 'mock');
        setName(data.restaurant?.name || restaurant.name);
        setLocation(
          data.restaurant?.location ||
            [data.restaurant?.township, data.restaurant?.address]
              .filter(Boolean)
              .join(' · ') ||
            restaurant.township ||
            'Yangon'
        );
        setActive(
          isActiveStatus(data.restaurant?.storeStatus, data.restaurant?.isActive)
        );
        setRevenue(Number(data.kpis?.totalRevenue) || demo.totalRevenue);
        setOrders(
          Number(data.kpis?.totalOrdersCompleted) || demo.totalOrdersCompleted
        );
        setAov(Number(data.kpis?.averageOrderValue) || demo.averageOrderValue);
        setTopItems(
          Array.isArray(data.topItems) && data.topItems.length
            ? data.topItems
            : demo.topItems
        );
      } catch {
        if (!cancelled) setSource('mock');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [
    restaurant.id,
    restaurant.name,
    restaurant.township,
    restaurant.address,
    restaurant.storeStatus,
  ]);

  const maxQty = Math.max(...topItems.map((i) => i.quantity), 1);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close restaurant performance"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card shadow-2xl animate-slide-in-right">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-gradient-to-br from-admin/20 via-card to-card px-5 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-admin">
              Analytics
            </p>
            <h2 className="mt-1 text-xl font-bold text-foreground">
              Restaurant Performance
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {source === 'live' ? 'Live delivered-order totals' : 'Demo figures for this vendor'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <section className="rounded-2xl border border-border bg-background/70 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-restaurant/15 text-restaurant">
                <Store className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-bold text-foreground">{name}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      active
                        ? 'bg-success/15 text-success'
                        : 'bg-danger/15 text-danger'
                    }`}
                  >
                    {active ? 'Active' : 'Closed'}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{location}</span>
                </p>
              </div>
            </div>
          </section>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-admin" />
              Loading performance…
            </div>
          ) : (
            <>
              <section className="grid grid-cols-1 gap-3">
                <div className="rounded-2xl border border-admin/20 bg-gradient-to-br from-admin/15 to-transparent p-4">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5 text-admin" />
                    Net Revenue
                  </div>
                  <p className="text-2xl font-bold font-tabular text-foreground">
                    {formatKyat(revenue)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    After commission deducted
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border bg-background/70 p-4">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <ShoppingBag className="h-3.5 w-3.5 text-restaurant" />
                      Orders Completed
                    </div>
                    <p className="text-xl font-bold font-tabular text-foreground">
                      {orders.toLocaleString('en-US')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/70 p-4">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <BarChart3 className="h-3.5 w-3.5 text-customer" />
                      Avg Order Value
                    </div>
                    <p className="text-xl font-bold font-tabular text-foreground">
                      {formatKyat(aov)}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-background/70 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <h4 className="text-sm font-bold text-foreground">Top 3 Selling Items</h4>
                </div>
                <ul className="space-y-3">
                  {topItems.map((item, index) => (
                    <li key={item.name}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                              index === 0
                                ? 'bg-amber-400/20 text-amber-500'
                                : index === 1
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-orange-500/15 text-orange-400'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <span className="truncate text-sm font-semibold text-foreground">
                            {item.name}
                          </span>
                        </div>
                        <span className="shrink-0 text-xs font-semibold font-tabular text-muted-foreground">
                          {item.quantity.toLocaleString('en-US')} sold
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-admin to-customer"
                          style={{ width: `${Math.round((item.quantity / maxQty) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
