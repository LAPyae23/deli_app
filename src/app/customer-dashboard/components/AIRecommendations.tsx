'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CloudRain,
  Cloud,
  CloudLightning,
  Flame,
  Sparkles,
  Info,
  UtensilsCrossed,
  Sun,
} from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import { formatMMK } from '@/lib/currency';
import { getDishImage, AI_PICKS_FALLBACK_ITEMS } from '@/lib/dishImages';

function weatherIcon(kind?: string) {
  const w = String(kind || 'Sunny');
  if (w === 'Rainy') return CloudRain;
  if (w === 'Stormy') return CloudLightning;
  if (w === 'Cloudy') return Cloud;
  return Sun;
}

type RecItem = {
  id?: string;
  name: string;
  category: string;
  price: number;
  score?: number;
  restaurantName?: string;
  restaurantId?: string;
  image?: string;
  imageAlt?: string;
  orderCount?: number;
};

type RecSection = {
  label: string;
  reason: string;
  weather?: string;
  items: RecItem[];
};

type FeaturedPick = {
  title: string;
  reason: string;
  weather?: string;
  item: RecItem | null;
};

type RecommendationsPayload = {
  success: boolean;
  weather?: string;
  favoriteCategory?: string;
  featured?: {
    weather?: FeaturedPick;
    trending?: FeaturedPick;
    recommended?: FeaturedPick;
  };
  personalized?: RecSection;
  weatherBased?: RecSection;
  trending?: RecSection;
  message?: string;
};

function recFromFallback(tag: string): RecItem[] {
  return AI_PICKS_FALLBACK_ITEMS.filter((row) => {
    if (tag === 'rain') return row.reasonTag === 'rain' || row.category === 'Burmese';
    if (tag === 'Sunny') return row.reasonTag === 'Sunny';
    if (tag === 'spicy') return row.reasonTag === 'spicy';
    if (tag === 'hlaing') return row.reasonTag === 'hlaing' || row.name === 'Shan Noodles';
    return true;
  }).map((row) => ({
    name: row.name,
    category: row.category,
    price: row.price,
    image: row.image,
    imageAlt: row.name,
    restaurantName: 'Hlaing Township Shan Noodle',
    orderCount: tag === 'hlaing' ? 52 : undefined,
  }));
}

function demoPayload(weatherLabel = 'Rainy'): RecommendationsPayload {
  const weatherItems = weatherLabel === 'Sunny' ? recFromFallback('Sunny') : recFromFallback('rain');
  const recommended = recFromFallback('spicy');
  const trending = recFromFallback('hlaing');
  const weatherReason =
    weatherLabel === 'Sunny'
      ? 'Drinks and ice cream for a sunny day'
      : 'Mohinga and hot soup for the rain';

  return {
    success: true,
    weather: weatherLabel,
    featured: {
      weather: {
        title: 'Perfect Weather Match',
        reason: weatherReason,
        weather: weatherLabel,
        item: weatherItems[0] || null,
      },
      trending: {
        title: 'Trending in Hlaing',
        reason: 'Ordered 50+ times today',
        item: trending[0] || null,
      },
      recommended: {
        title: 'Recommended for You',
        reason: 'Because you ordered Spicy Food recently',
        item: recommended[0] || null,
      },
    },
    personalized: {
      label: 'Based on your past orders',
      reason: 'Because you ordered Spicy Food recently',
      items: recommended,
    },
    weatherBased: {
      label: `Perfect for a ${weatherLabel} day`,
      reason: weatherReason,
      weather: weatherLabel,
      items: weatherItems,
    },
    trending: {
      label: 'Trending in Hlaing',
      reason: 'Ordered 50+ times today',
      items: trending,
    },
  };
}

function FeaturedCard({
  title,
  reason,
  item,
  weather,
  accent,
  icon,
  onClick,
}: {
  title: string;
  reason: string;
  item: RecItem | null | undefined;
  weather?: string;
  accent: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const WeatherIcon = weatherIcon(weather);
  if (!item) return null;
  const photo = item.image || getDishImage(item.name);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-[240px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-[260px]"
    >
      <div className="relative h-32 bg-muted">
        {photo ? (
          <AppImage
            src={photo}
            alt={item.imageAlt || item.name}
            fill
            fallbackSrc="/assets/images/no_image.png"
            className="object-cover"
            sizes="260px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <UtensilsCrossed className="h-8 w-8" />
          </div>
        )}
        <div
          className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ${accent}`}
        >
          {weather ? <WeatherIcon className="h-3 w-3" /> : icon}
          {title}
        </div>
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-1 text-sm font-bold text-foreground">{item.name}</p>
        {item.restaurantName && (
          <p className="truncate text-[11px] text-muted-foreground">{item.restaurantName}</p>
        )}
        <p className="text-[11px] font-medium leading-snug text-muted-foreground">{reason}</p>
        <p className="text-sm font-bold text-customer font-tabular">{formatMMK(item.price)}</p>
      </div>
    </button>
  );
}

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
  const photo = item.image || getDishImage(item.name);
  return (
    <article className="w-[158px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:w-[172px]">
      <div className="relative h-24 bg-gradient-to-br from-primary/10 to-accent/10">
        {photo ? (
          <AppImage
            src={photo}
            alt={item.name}
            fill
            fallbackSrc="/assets/images/no_image.png"
            className="object-cover"
            sizes="172px"
          />
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
        <p className="text-sm font-bold text-primary font-tabular">{formatMMK(item.price)}</p>
      </div>
    </article>
  );
}

export default function AIRecommendations({
  initialLane = 'recommended',
  compactEntry = false,
  onOpenLane,
  weather,
}: {
  initialLane?: AiLane;
  compactEntry?: boolean;
  onOpenLane?: (lane: AiLane) => void;
  weather?: string;
}) {
  const [data, setData] = useState<RecommendationsPayload>(() =>
    demoPayload(weather || 'Rainy')
  );
  const [active, setActive] = useState<AiLane>(initialLane);

  useEffect(() => {
    setActive(initialLane);
  }, [initialLane]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const customerId = localStorage.getItem('fooddash_session_id') || '';
        const params = new URLSearchParams();
        if (customerId) params.set('customerId', customerId);
        if (weather) params.set('weather', weather);
        const res = await fetch(`/api/customer/recommendations?${params.toString()}`);
        const json = (await res.json()) as RecommendationsPayload;
        if (!res.ok || !json.success) return;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(demoPayload(weather || 'Rainy'));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [weather]);

  const weatherData = data.weatherBased?.weather || data.weather || 'Sunny';

  const lanes: LaneDef[] = useMemo(() => {
    return [
      {
        key: 'recommended',
        title: 'Recommended for You',
        short: 'Recommend',
        icon: <Sparkles className="h-4 w-4" />,
        accent: 'bg-primary text-white',
        activeClass: 'bg-primary text-white shadow-md shadow-primary/25',
        items: data.personalized?.items || [],
        reason: data.personalized?.reason || 'Because you ordered Spicy Food recently',
      },
      {
        key: 'weather',
        title: 'Perfect Weather Match',
        short: 'Perfect Weather',
        icon: <CloudRain className="h-4 w-4" />,
        accent: 'bg-accent text-white',
        activeClass: 'bg-accent text-white shadow-md shadow-accent/25',
        items: data.weatherBased?.items || [],
        reason:
          data.weatherBased?.reason ||
          (weatherData === 'Sunny'
            ? 'Drinks and ice cream for a sunny day'
            : 'Mohinga and hot soup for the rain'),
      },
      {
        key: 'trending',
        title: 'Trending in Hlaing',
        short: 'Trending',
        icon: <Flame className="h-4 w-4" />,
        accent: 'bg-orange-500 text-white',
        activeClass: 'bg-orange-500 text-white shadow-md shadow-orange-500/25',
        items: data.trending?.items || [],
        reason: data.trending?.reason || 'Ordered 50+ times today',
      },
    ];
  }, [data, weatherData]);

  const activeLane = lanes.find((l) => l.key === active) || lanes[0];

  if (compactEntry) {
    const featured = data.featured;
    const weatherPick = featured?.weather?.item || data.weatherBased?.items?.[0];
    const trendingPick = featured?.trending?.item || data.trending?.items?.[0];
    const recommendedPick = featured?.recommended?.item || data.personalized?.items?.[0];
    const weatherLabel = featured?.weather?.weather || weatherData;

    return (
      <div className="mb-5 animate-fade-in">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-customer" />
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
              AI Picks
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground">Recommend · Weather · Trending</p>
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide snap-x snap-mandatory">
          <FeaturedCard
            title="Perfect Weather Match"
            reason={
              featured?.weather?.reason ||
              (weatherLabel === 'Sunny'
                ? 'Drinks and ice cream for a sunny day'
                : 'Mohinga and hot soup for the rain')
            }
            item={weatherPick}
            weather={weatherLabel}
            accent="bg-sky-500"
            icon={<CloudRain className="h-3 w-3" />}
            onClick={() => onOpenLane?.('weather')}
          />
          <FeaturedCard
            title="Trending in Hlaing"
            reason={featured?.trending?.reason || 'Ordered 50+ times today'}
            item={trendingPick}
            accent="bg-orange-500"
            icon={<Flame className="h-3 w-3" />}
            onClick={() => onOpenLane?.('trending')}
          />
          <FeaturedCard
            title="Recommended for You"
            reason={
              featured?.recommended?.reason || 'Because you ordered Spicy Food recently'
            }
            item={recommendedPick}
            accent="bg-customer"
            icon={<Sparkles className="h-3 w-3" />}
            onClick={() => onOpenLane?.('recommended')}
          />
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
          <p className="text-xs text-muted-foreground">History · weather · market trends</p>
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
