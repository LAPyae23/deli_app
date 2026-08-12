'use client';

import React, { useEffect, useState } from 'react';
import {
  CloudRain,
  TriangleAlert,
  Loader2,
  Sparkles,
  Clock3,
  Utensils,
} from 'lucide-react';

type InsightsPayload = {
  bottleneck?: {
    day?: string | null;
    avgPrepMins?: number;
    overallAvgPrepMins?: number;
    prepIncreaseMins?: number;
    alert?: string;
  };
  forecast?: {
    topItem?: string | null;
    quantitySold?: number;
    suggestedPrepQty?: number;
    alert?: string;
  };
};

type InsightsResponse = {
  success: boolean;
  insights?: InsightsPayload;
  message?: string;
};

export default function KitchenInsights() {
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const restaurantName = localStorage.getItem('fooddash_session_name') || '';
        const restaurantId = localStorage.getItem('fooddash_session_id') || '';
        if (!restaurantName && !restaurantId) {
          throw new Error('Missing restaurant session. Please sign in again.');
        }

        const params = new URLSearchParams();
        if (restaurantId) params.set('restaurantId', restaurantId);
        if (restaurantName) params.set('restaurantName', restaurantName);

        const res = await fetch(`/api/restaurant/insights?${params.toString()}`);
        const data = (await res.json()) as InsightsResponse;
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to load kitchen insights');
        }
        if (!cancelled) setInsights(data.insights || null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setInsights(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const forecastAlert =
    insights?.forecast?.alert ||
    '🌧️ Rainy day expected tomorrow. Prepare 30+ bowls of Mohinga based on past data.';
  const bottleneckAlert =
    insights?.bottleneck?.alert ||
    '⚠️ Your prep time increases by 15 mins on Friday evenings. Riders are waiting. Consider adding kitchen staff.';

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-restaurant" />
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
          Kitchen Bottleneck & Demand Forecasting
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-14 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-restaurant" />
          Analyzing kitchen patterns…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-8 text-center text-sm text-danger">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Column 1 — Demand Forecast */}
          <article className="overflow-hidden rounded-2xl border border-sky-200/80 bg-white shadow-md shadow-sky-100/60">
            <div className="relative overflow-hidden bg-gradient-to-br from-sky-600 via-cyan-600 to-teal-500 px-5 py-4">
              <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <CloudRain className="h-5 w-5 text-white" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                    Weather Forecast Alert
                  </p>
                  <h3 className="text-base font-bold text-white">Demand Forecast</h3>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <p className="text-sm leading-relaxed text-slate-700">{forecastAlert}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3.5 py-3">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-sky-700/80">
                    <Utensils className="h-3.5 w-3.5" />
                    Top rainy seller
                  </div>
                  <p className="truncate text-sm font-bold text-slate-900">
                    {insights?.forecast?.topItem || 'Mohinga'}
                  </p>
                </div>
                <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3.5 py-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700/80">
                    Prep suggestion
                  </div>
                  <p className="text-sm font-bold text-slate-900 font-tabular">
                    {insights?.forecast?.suggestedPrepQty ?? 30}+ portions
                  </p>
                </div>
              </div>

              {insights?.forecast?.quantitySold != null &&
                insights.forecast.quantitySold > 0 && (
                  <p className="text-[11px] text-slate-500">
                    Based on {insights.forecast.quantitySold} units sold on Rainy days
                    historically.
                  </p>
                )}
            </div>
          </article>

          {/* Column 2 — Bottleneck Alert */}
          <article className="overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-md shadow-amber-100/60">
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 px-5 py-4">
              <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <TriangleAlert className="h-5 w-5 text-white" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                    Operations Alert
                  </p>
                  <h3 className="text-base font-bold text-white">Kitchen Bottleneck</h3>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <p className="text-sm leading-relaxed text-slate-700">{bottleneckAlert}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-3.5 py-3">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800/80">
                    <Clock3 className="h-3.5 w-3.5" />
                    Peak day
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {insights?.bottleneck?.day || 'Friday'}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-3.5 py-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800/80">
                    Extra prep time
                  </div>
                  <p className="text-sm font-bold text-slate-900 font-tabular">
                    +{insights?.bottleneck?.prepIncreaseMins ?? 15} mins
                  </p>
                </div>
              </div>

              {insights?.bottleneck?.avgPrepMins != null &&
                insights.bottleneck.avgPrepMins > 0 && (
                  <p className="text-[11px] text-slate-500">
                    Peak avg prep {insights.bottleneck.avgPrepMins} mins vs overall{' '}
                    {insights.bottleneck.overallAvgPrepMins ?? '—'} mins.
                  </p>
                )}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
