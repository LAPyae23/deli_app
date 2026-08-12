'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    const role = localStorage.getItem('fooddash_session_role');
    if (role !== 'CUSTOMER') {
      window.location.href = '/';
      return;
    }
    setLane(parseLane(searchParams.get('lane')));
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
          <div>
            <p className="text-sm font-bold text-foreground">AI Picks</p>
            <p className="text-[11px] text-muted-foreground">
              Recommend · Perfect Weather · Trending
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <FoodieWrapped />
        <AIRecommendations initialLane={lane} />
      </main>
    </div>
  );
}
