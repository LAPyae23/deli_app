'use client';

import React, { useEffect, useState } from 'react';
import {
  Radar,
  MapPin,
  Loader2,
  Sparkles,
  Bike,
  ShoppingBag,
  Zap,
  Navigation,
} from 'lucide-react';

type HotspotStatus = 'Very High' | 'High' | 'Moderate' | 'Low';

type Hotspot = {
  locationName: string;
  township?: string;
  demandScore: number;
  status: HotspotStatus;
  orderCount?: number;
  activeOrders?: number;
  riderCount?: number;
  onlineRiders?: number;
  availableRiders?: number;
  ordersPerRider?: number;
  demandRatio?: number;
  imbalance?: boolean;
  surgeActive?: boolean;
  surgeMultiplier?: number;
  earningsHint?: string;
  lat: number;
  lng: number;
};

type HeatmapResponse = {
  success: boolean;
  hotspots?: Hotspot[];
  insight?: string;
  message?: string;
  imbalanceThreshold?: number;
};

function scoreStyles(spot: Hotspot) {
  if (spot.imbalance || spot.status === 'Very High') {
    return {
      card: 'border-red-400/60 bg-red-50 ring-red-500/25',
      bar: 'bg-red-500',
      badge: 'bg-red-600 text-white border-red-700/30',
      dot: 'bg-red-500',
      score: 'text-red-600',
      cta: 'bg-red-600 text-white',
    };
  }
  if (spot.status === 'High') {
    return {
      card: 'border-orange-300/70 bg-orange-50/80 ring-orange-400/20',
      bar: 'bg-orange-500',
      badge: 'bg-orange-500/15 text-orange-700 border-orange-500/25',
      dot: 'bg-orange-500',
      score: 'text-orange-600',
      cta: 'bg-orange-500 text-white',
    };
  }
  if (spot.status === 'Moderate') {
    return {
      card: 'border-slate-200 bg-slate-50/80 ring-amber-400/15',
      bar: 'bg-amber-400',
      badge: 'bg-amber-400/15 text-amber-700 border-amber-400/30',
      dot: 'bg-amber-400',
      score: 'text-slate-800',
      cta: 'bg-slate-700 text-white',
    };
  }
  return {
    card: 'border-slate-200 bg-slate-50/80 ring-emerald-400/15',
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25',
    dot: 'bg-emerald-500',
    score: 'text-slate-800',
    cta: 'bg-slate-700 text-white',
  };
}

export default function PredictiveHeatmap() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [insight, setInsight] = useState(
    '💡 AI Alert: Severe rider shortage zones light up in red — ride there for surge pay.'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(2);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/rider/heatmap');
        const data = (await res.json()) as HeatmapResponse;
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to load heatmap');
        }
        if (!cancelled) {
          setHotspots(Array.isArray(data.hotspots) ? data.hotspots : []);
          if (data.insight) setInsight(data.insight);
          if (data.imbalanceThreshold) setThreshold(data.imbalanceThreshold);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setHotspots([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 45_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const imbalanceZones = hotspots.filter((h) => h.imbalance);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-200/60">
      <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-rose-700 via-red-600 to-orange-500 px-5 py-4 sm:px-6">
        <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 left-1/3 h-20 w-40 rounded-full bg-yellow-200/20 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Radar className="h-4 w-4 text-white/90" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                Supply / Demand Radar
              </p>
            </div>
            <h3 className="text-lg font-bold text-white">Predictive Demand Heatmap</h3>
            <p className="mt-0.5 text-xs text-white/80">
              Red zones = orders &gt; {threshold}× riders · surge earnings live
            </p>
          </div>
          <div className="relative flex h-12 w-12 items-center justify-center">
            <span className="absolute inline-flex h-10 w-10 animate-ping rounded-full bg-white/30" />
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
              <MapPin className="h-4 w-4 text-white" />
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <p className="text-xs font-medium leading-relaxed text-rose-900/90">{insight}</p>
        </div>

        {imbalanceZones.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-600/5 px-3 py-2 text-[11px] font-semibold text-red-700">
            <Zap className="h-3.5 w-3.5" />
            {imbalanceZones.length} imbalance zone
            {imbalanceZones.length === 1 ? '' : 's'} — ride there for higher surge pay
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-rider" />
            Scanning Yangon demand zones…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-6 text-center text-sm text-danger">
            {error}
          </div>
        ) : hotspots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            No hotspot data yet. Seed orders to train the radar.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {hotspots.slice(0, 8).map((spot, index) => {
              const styles = scoreStyles(spot);
              const isImbalance = Boolean(spot.imbalance);

              return (
                <li
                  key={`${spot.locationName}-${spot.lat}-${index}`}
                  className={`rounded-xl border px-3.5 py-3 transition-colors ring-1 ${styles.card}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                      {isImbalance && (
                        <span
                          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${styles.dot}`}
                          aria-hidden
                        />
                      )}
                      <span
                        className={`relative flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white ${styles.dot}`}
                      >
                        {index + 1}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`truncate text-sm font-semibold ${
                            isImbalance ? 'text-red-800' : 'text-slate-900'
                          }`}
                        >
                          {spot.locationName}
                          {isImbalance ? ' 🔥' : ''}
                        </p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles.badge}`}
                        >
                          {isImbalance ? 'Imbalance' : spot.status}
                        </span>
                        {spot.surgeActive && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            <Zap className="h-3 w-3" />
                            {(spot.surgeMultiplier || 1).toFixed(1)}× surge
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                        <span className="inline-flex items-center gap-1 font-tabular">
                          <ShoppingBag className="h-3 w-3" />
                          {spot.activeOrders ?? spot.orderCount ?? 0} active orders
                        </span>
                        <span className="inline-flex items-center gap-1 font-tabular">
                          <Bike className="h-3 w-3" />
                          {spot.availableRiders ?? spot.onlineRiders ?? spot.riderCount ?? 0}{' '}
                          riders
                        </span>
                        {spot.demandRatio != null && (
                          <span
                            className={`font-tabular font-semibold ${
                              isImbalance ? 'text-red-600' : 'text-slate-500'
                            }`}
                          >
                            {spot.demandRatio.toFixed(1)}× demand
                          </span>
                        )}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                        <div
                          className={`h-full rounded-full transition-all ${styles.bar}`}
                          style={{ width: `${Math.min(100, spot.demandScore)}%` }}
                        />
                      </div>
                      {isImbalance && (
                        <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-red-700">
                          <Navigation className="h-3 w-3" />
                          {spot.earningsHint ||
                            `Head here for ${(spot.surgeMultiplier || 1.5).toFixed(1)}× surge earnings`}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className={`text-lg font-bold font-tabular ${styles.score}`}>
                        {spot.demandScore}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Score
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
