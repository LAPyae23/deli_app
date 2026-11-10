'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, ChevronDown, Clock, Store, Wallet, Receipt, UtensilsCrossed } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import { formatMMK } from '@/lib/currency';
import { getDishImage } from '@/lib/dishImages';
import type { Restaurant } from '../types';
import { mapProfileToRestaurant, type RestaurantProfileDoc } from './RestaurantGrid';

type ComponentKey = 'collaborative' | 'category' | 'repeat' | 'popularity' | 'price';

type Recommendation = {
  dish: string;
  category: string;
  score: number;
  components: Record<ComponentKey, number>;
  contributions: Record<ComponentKey, number>;
  reasons: string[];
  item: {
    _id: string;
    name: string;
    price: number;
    image: string;
    imageAlt: string;
    restaurantId: string;
    restaurantName: string;
  };
  restaurant: RestaurantProfileDoc | null;
};

type TasteProfile = {
  orderCount: number;
  categories: Array<{ category: string; share: number }>;
  avgItemPrice: number;
  avgOrderValue: number;
  favoriteHour: number;
  topRestaurant: { name: string; count: number } | null;
  topDishes: Array<{ name: string; count: number }>;
};

type ForYouPayload = {
  success: boolean;
  coldStart: boolean;
  tasteProfile: TasteProfile | null;
  recommendations: Recommendation[];
  weights: Record<ComponentKey, number>;
  model: { orders: number; customers: number; dishes: number };
};

const SIGNAL_LABELS: Record<ComponentKey, string> = {
  collaborative: 'Similar customers',
  category: 'Your favourite category',
  repeat: 'You order it often',
  popularity: 'Popular right now',
  price: 'Fits your budget',
};

/** Fixed category → color mapping (validated categorical slots 1–4, light/dark). */
const CATEGORY_COLORS: Record<string, string> = {
  'Fast Food': 'bg-[#2a78d6] dark:bg-[#3987e5]',
  Burmese: 'bg-[#eb6834] dark:bg-[#d95926]',
  Drinks: 'bg-[#1baf7a] dark:bg-[#199e70]',
  Dessert: 'bg-[#eda100] dark:bg-[#c98500]',
};
const OTHER_COLOR = 'bg-muted-foreground/40';

function timeOfDay(hour: number) {
  const label = `${String(hour).padStart(2, '0')}:00`;
  if (hour >= 5 && hour < 11) return `Breakfast · ~${label}`;
  if (hour >= 11 && hour < 15) return `Lunch · ~${label}`;
  if (hour >= 15 && hour < 18) return `Afternoon · ~${label}`;
  if (hour >= 18 && hour < 22) return `Dinner · ~${label}`;
  return `Late night · ~${label}`;
}

function TasteProfileCard({ profile }: { profile: TasteProfile }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground">Your taste profile</h3>
        <span className="text-[11px] text-muted-foreground">
          From your {profile.orderCount} orders
        </span>
      </div>

      {/* Part-to-whole: one segmented bar + labelled legend (identity never by color alone). */}
      <div
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={profile.categories
          .map((c) => `${c.category} ${Math.round(c.share * 100)}%`)
          .join(', ')}
      >
        {profile.categories.map((c) => (
          <div
            key={c.category}
            className={`h-full first:rounded-l-full last:rounded-r-full ${CATEGORY_COLORS[c.category] || OTHER_COLOR}`}
            style={{ width: `${c.share * 100}%` }}
            title={`${c.category}: ${Math.round(c.share * 100)}%`}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {profile.categories.map((c) => (
          <li key={c.category} className="flex items-center gap-1.5 text-xs text-foreground">
            <span
              aria-hidden
              className={`inline-block h-2.5 w-2.5 rounded-full ${CATEGORY_COLORS[c.category] || OTHER_COLOR}`}
            />
            {c.category}
            <span className="font-semibold font-tabular">{Math.round(c.share * 100)}%</span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-start gap-2">
          <Receipt className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <div>
            <dt className="text-muted-foreground">Average order</dt>
            <dd className="font-bold text-foreground font-tabular">{formatMMK(profile.avgOrderValue)}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Wallet className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <div>
            <dt className="text-muted-foreground">Usual dish price</dt>
            <dd className="font-bold text-foreground font-tabular">{formatMMK(profile.avgItemPrice)}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <div>
            <dt className="text-muted-foreground">You usually order</dt>
            <dd className="font-bold text-foreground">{timeOfDay(profile.favoriteHour)}</dd>
          </div>
        </div>
        {profile.topRestaurant && (
          <div className="flex items-start gap-2">
            <Store className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <dt className="text-muted-foreground">Favourite restaurant</dt>
              <dd className="truncate font-bold text-foreground">{profile.topRestaurant.name}</dd>
            </div>
          </div>
        )}
      </dl>

      {profile.topDishes.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Most ordered:{' '}
          {profile.topDishes.map((d, i) => (
            <span key={d.name} className="text-foreground">
              {i > 0 && ', '}
              {d.name} <span className="font-tabular">×{d.count}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function WhyBreakdown({ rec, weights }: { rec: Recommendation; weights: Record<ComponentKey, number> }) {
  const keys = (Object.keys(SIGNAL_LABELS) as ComponentKey[]).filter((k) => weights[k] > 0);
  const total = keys.reduce((s, k) => s + rec.contributions[k], 0) || 1;
  return (
    <div className="mt-2 space-y-1.5 border-t border-border pt-2">
      {keys
        .sort((a, b) => rec.contributions[b] - rec.contributions[a])
        .map((k) => {
          const share = rec.contributions[k] / total;
          return (
            <div key={k} title={`${SIGNAL_LABELS[k]}: signal ${Math.round(rec.components[k] * 100)}% × weight ${Math.round(weights[k] * 100)}%`}>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{SIGNAL_LABELS[k]}</span>
                <span className="font-tabular text-foreground">{Math.round(share * 100)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-customer"
                  style={{ width: `${Math.max(share * 100, share > 0 ? 3 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}

function RecommendationCard({
  rec,
  weights,
  coldStart,
  onOpen,
}: {
  rec: Recommendation;
  weights: Record<ComponentKey, number>;
  coldStart: boolean;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const photo = rec.item.image || getDishImage(rec.item.name);
  return (
    <div className="w-[230px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:w-[250px]">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative h-28 bg-muted">
          {photo ? (
            <AppImage
              src={photo}
              alt={rec.item.imageAlt}
              fill
              fallbackSrc="/assets/images/no_image.png"
              className="object-cover"
              sizes="250px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <UtensilsCrossed className="h-8 w-8" />
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white font-tabular">
            {coldStart ? 'Popular' : `${Math.round(rec.score * 100)}% match`}
          </span>
        </div>
        <div className="space-y-1 px-3 pt-3">
          <p className="line-clamp-1 text-sm font-bold text-foreground">{rec.item.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{rec.item.restaurantName}</p>
          <ul className="space-y-0.5">
            {rec.reasons.map((r) => (
              <li key={r} className="line-clamp-2 text-[11px] leading-snug text-foreground/80">
                • {r}
              </li>
            ))}
          </ul>
          <p className="text-sm font-bold text-customer font-tabular">{formatMMK(rec.item.price)}</p>
        </div>
      </button>
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          Why this?
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open &&
          (coldStart ? (
            <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
              Ranked by recent orders from all customers. Personal signals start after your first orders.
            </p>
          ) : (
            <WhyBreakdown rec={rec} weights={weights} />
          ))}
      </div>
    </div>
  );
}

export default function ForYou({
  onSelectRestaurant,
}: {
  onSelectRestaurant?: (restaurant: Restaurant) => void;
}) {
  const [data, setData] = useState<ForYouPayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/customer/for-you')
      .then((r) => r.json())
      .then((json: ForYouPayload) => {
        if (cancelled) return;
        if (!json.success) throw new Error('failed');
        setData(json);
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'error') return null;

  return (
    <section className="mb-6 space-y-3" aria-labelledby="for-you-heading">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 id="for-you-heading" className="flex items-center gap-1.5 text-base font-bold text-foreground">
            <Sparkles className="h-4 w-4 text-customer" aria-hidden />
            For You
          </h2>
          <p className="text-xs text-muted-foreground">
            {data
              ? data.coldStart
                ? 'Order a few times and these picks will learn your taste. For now: most popular dishes.'
                : `Learned from your orders and ${data.model.orders.toLocaleString()} orders by ${data.model.customers.toLocaleString()} customers`
              : 'Analysing your orders…'}
          </p>
        </div>
      </div>

      {status === 'loading' && (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-60 w-[230px] shrink-0 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
          {data.tasteProfile && <TasteProfileCard profile={data.tasteProfile} />}
          <div
            className={`flex snap-x gap-3 overflow-x-auto pb-2 ${data.tasteProfile ? '' : 'xl:col-span-2'}`}
          >
            {data.recommendations.map((rec) => (
              <RecommendationCard
                key={`${rec.dish}-${rec.item._id}`}
                rec={rec}
                weights={data.weights}
                coldStart={data.coldStart}
                onOpen={
                  rec.restaurant && onSelectRestaurant
                    ? () => onSelectRestaurant(mapProfileToRestaurant(rec.restaurant!))
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
