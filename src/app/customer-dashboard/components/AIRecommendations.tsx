'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CloudRain,
  Flame,
  Sparkles,
  Info,
  Loader2,
  UtensilsCrossed,
} from 'lucide-react';
import { formatKyat } from '@/lib/currency';

type RecItem = {
  name: string;
  category: string;
  price: number;
  score?: number;
  restaurantName?: string;
  image?: string;
};

type RecSection = {
  label: string;
  reason: string;
  weather?: string;
  items: RecItem[];
};

type RecommendationsPayload = {
  success: boolean;
  weather?: string;
  favoriteCategory?: string;
  personalized?: RecSection;
  weatherBased?: RecSection;
  trending?: RecSection;
  message?: string;
};

export type AiLane = 'recommended' | 'weather' | 'trending';

type LaneDef = {
  key: AiLane;
  title: string;
  short: string;
  icon: React.ReactNode;
  accent: string;
  activeClass: string;
  items: RecItem[];
  reason: string;
};

function ItemCard({ item }: { item: RecItem }) {
  return (
    <article className="w-[158px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:w-[172px]">
      <div className="relative h-24 bg-gradient-to-br from-primary/10 to-accent/10">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-primary/70">
            <UtensilsCrossed className="h-7 w-7" />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary shadow-sm">
          {item.category}
        </span>
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold text-foreground">{item.name}</p>
        {item.restaurantName && (
          <p className="truncate text-[11px] text-muted-foreground">{item.restaurantName}</p>
        )}
        <p className="text-sm font-bold text-primary font-tabular">
          {formatKyat(item.price)}
        </p>
      </div>
    </article>
  );
}

export default function AIRecommendations({
  initialLane = 'recommended',
  compactEntry = false,
  onOpenLane,
}: {
  initialLane?: AiLane;
  /** Discover page: show only athletic entry chips that call onOpenLane */
  compactEntry?: boolean;
  onOpenLane?: (lane: AiLane) => void;
}) {
  const [data, setData] = useState<RecommendationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<AiLane>(initialLane);

  useEffect(() => {
    setActive(initialLane);
  }, [initialLane]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const customerId =
          typeof window !== 'undefined'
            ? localStorage.getItem('fooddash_session_id') || ''
            : '';
        const params = new URLSearchParams();
        if (customerId) params.set('customerId', customerId);

        const res = await fetch(`/api/customer/recommendations?${params.toString()}`);
        const json = (await res.json()) as RecommendationsPayload;
        if (!res.ok || !json.success) {
          throw new Error(json.message || 'Failed to load recommendations');
        }
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const weather = data?.weatherBased?.weather || data?.weather || 'Sunny';
  const weatherTitle =
    weather === 'Rainy'
      ? 'Rainy Weather'
      : weather === 'Stormy'
        ? 'Stormy Weather'
        : weather === 'Cloudy'
          ? 'Cloudy Weather'
          : 'Sunny Weather';

  const lanes: LaneDef[] = useMemo(() => {
    if (!data) return [];
    return [
      {
        key: 'recommended',
        title: 'Recommended for You',
        short: 'Recommend',
        icon: <Sparkles className="h-4 w-4" />,
        accent: 'bg-primary text-white',
        activeClass: 'bg-primary text-white shadow-md shadow-primary/25',
        items: data.personalized?.items || [],
        reason:
          data.personalized?.reason ||
          `Because you frequently buy ${data.favoriteCategory || 'Fast Food'}`,
      },
      {
        key: 'weather',
        title: `Perfect for ${weatherTitle}`,
        short: 'Perfect Weather',
        icon: <CloudRain className="h-4 w-4" />,
        accent: 'bg-accent text-white',
        activeClass: 'bg-accent text-white shadow-md shadow-accent/25',
        items: data.weatherBased?.items || [],
        reason:
          data.weatherBased?.reason || `Most popular when weather is ${weather}`,
      },
      {
        key: 'trending',
        title: 'Trending Near You',
        short: 'Trending',
        icon: <Flame className="h-4 w-4" />,
        accent: 'bg-orange-500 text-white',
        activeClass: 'bg-orange-500 text-white shadow-md shadow-orange-500/25',
        items: data.trending?.items || [],
        reason:
          data.trending?.reason || 'Top most frequently bought items on FoodDash',
      },
    ];
  }, [data, weather, weatherTitle]);

  const activeLane = lanes.find((l) => l.key === active) || lanes[0];

  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading AI picks…</p>
      </div>
    );
  }

  if (error || !data || lanes.length === 0) return null;

  if (compactEntry) {
    return (
      <div className="mb-4 animate-fade-in">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
              AI Picks
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground">Open a lane</p>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
          {lanes.map((lane) => (
            <button
              key={lane.key}
              type="button"
              onClick={() => onOpenLane?.(lane.key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition hover:-translate-y-0.5 active:scale-[0.98] ${lane.accent}`}
            >
              {lane.icon}
              {lane.short}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-bold text-foreground">AI Picks for You</h2>
          <p className="text-xs text-muted-foreground">
            History · weather · market trends
          </p>
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
        {lanes.map((lane) => {
          const selected = lane.key === active;
          return (
            <button
              key={lane.key}
              type="button"
              onClick={() => setActive(lane.key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                selected
                  ? lane.activeClass
                  : 'border border-border bg-card text-foreground hover:bg-muted'
              }`}
            >
              {lane.icon}
              {lane.short}
            </button>
          );
        })}
      </div>

      {activeLane && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-foreground">{activeLane.title}</h3>
              <div className="mt-1.5 inline-flex max-w-full items-start gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1">
                <Info className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <p className="text-[11px] font-medium leading-snug text-muted-foreground">
                  {activeLane.reason}
                </p>
              </div>
            </div>
          </div>

          {activeLane.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No picks in this lane yet.
            </div>
          ) : (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide snap-x snap-mandatory">
              {activeLane.items.map((item, index) => (
                <ItemCard key={`${activeLane.key}-${item.name}-${index}`} item={item} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
