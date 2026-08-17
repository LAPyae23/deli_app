'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CloudRain,
  Flame,
  Loader2,
  Sparkles,
  Sun,
} from 'lucide-react';
import AIRecommendations, { type AiLane } from '../components/AIRecommendations';
import FoodieWrapped from '../components/FoodieWrapped';

const LANES: AiLane[] = ['recommended', 'weather', 'trending'];

function parseLane(raw: string | null): AiLane {
  if (raw && LANES.includes(raw as AiLane)) return raw as AiLane;
  return 'recommended';
}

export default function AiPicksClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [lane, setLane] = useState<AiLane>('recommended');
  const [weather, setWeather] = useState<'Rainy' | 'Sunny'>('Rainy');

  useEffect(() => {
    const role = localStorage.getItem('fooddash_session_role');
    if (role !== 'CUSTOMER') {
      window.location.href = '/';
      return;
    }
    setLane(parseLane(searchParams.get('lane')));
    const w = searchParams.get('weather');
    if (w === 'Sunny' || w === 'Rainy') setWeather(w);
    setReady(true);
  }, [searchParams]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Loading AI picks…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => router.push('/customer-dashboard')}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Discover
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">AI Picks</p>
            <p className="text-[11px] text-muted-foreground">
              Recommend · Perfect Weather · Trending
            </p>
          </div>
          <div className="flex shrink-0 rounded-full border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setWeather('Rainy')}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                weather === 'Rainy'
                  ? 'bg-sky-500 text-white'
                  : 'text-muted-foreground'
              }`}
            >
              <CloudRain className="h-3 w-3" />
              Rainy
            </button>
            <button
              type="button"
              onClick={() => setWeather('Sunny')}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                weather === 'Sunny'
                  ? 'bg-amber-400 text-white'
                  : 'text-muted-foreground'
              }`}
            >
              <Sun className="h-3 w-3" />
              Sunny
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-customer/10 text-customer">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Recommend</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              သင့်အရင် order တွေကိုကြည့်ပြီး spicy / မကြာခဏစားတဲ့ဟာတွေကို ပြန်အကြံပေးတယ်။
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10 text-sky-600">
              <CloudRain className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Perfect Weather</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              မိုးရွာရင် Mohinga / soup။ နေပူရင် Cola / Shwe Yin Aye လို အအေးတွေ။
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
              <Flame className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Trending</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              ဒီနေ့ Hlaing township မှာ အများဆုံး order ဝင်တဲ့ menu ကို ပြတယ်။
            </p>
          </article>
        </section>

        <FoodieWrapped />
        <AIRecommendations initialLane={lane} weather={weather} />
      </main>
    </div>
  );
}
