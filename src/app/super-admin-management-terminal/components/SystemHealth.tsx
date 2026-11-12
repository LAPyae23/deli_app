'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Brain, Database, HardDrive, Map, RefreshCw } from 'lucide-react';

type Health = {
  database: { ok: boolean; latencyMs: number };
  weather: { source: string; now?: string };
  cache: { backend: string; l1Hits: number; l2Hits: number; misses: number; l2Errors: number };
  routing: { osrm: string; nominatim: string };
  eta: {
    ready: boolean;
    samples: number;
    coefficients: number[];
    maeMinutes: number | null;
    ruleMaeMinutes: number | null;
    features: string[];
    trainedAt: string;
  } | null;
  ordersLastHour: number;
  errors24h: Record<string, number>;
  recentErrors: Array<{ _id: string; source: string; route: string; method?: string; message: string; createdAt: string }>;
  runtime: { region: string; commit: string | null; uptimeSec: number };
};

function Tile({ icon: Icon, title, value, sub, warn = false }: { icon: React.ElementType; title: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Icon className={`h-4 w-4 ${warn ? 'text-danger' : 'text-admin'}`} /> {title}
      </p>
      <p className={`mt-1 text-xl font-bold ${warn ? 'text-danger' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="mt-0.5 break-all text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Admin monitoring: database, weather feed, cache, routing servers, ETA model and recent errors. */
export default function SystemHealth() {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/health', { cache: 'no-store' });
      const d = await res.json();
      if (d?.success) setData(d as Health);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;
  const serverErrors = data.errors24h.server || 0;
  const clientErrors = data.errors24h.client || 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Activity className="h-5 w-5 text-admin" /> System health
          </h2>
          <p className="text-sm text-muted-foreground">
            Region {data.runtime.region} · build {data.runtime.commit || 'local'} · public uptime check at /api/health
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={Database} title="Database" value={`${data.database.latencyMs} ms`} sub="MongoDB ping" warn={data.database.latencyMs > 800} />
        <Tile icon={AlertTriangle} title="Errors (24 h)" value={`${serverErrors + clientErrors}`} sub={`${serverErrors} server · ${clientErrors} browser`} warn={serverErrors > 20} />
        <Tile icon={HardDrive} title="Cache" value={data.cache.backend} sub={`${data.cache.l1Hits} memory hits · ${data.cache.l2Hits} shared hits · ${data.cache.misses} misses`} />
        <Tile icon={Activity} title="Orders, last hour" value={String(data.ordersLastHour)} sub={`Weather feed: ${data.weather.source}${data.weather.now ? ` (${data.weather.now})` : ''}`} warn={data.weather.source !== 'open-meteo'} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <Brain className="h-4 w-4 text-admin" /> Learned ETA model
          </p>
          {data.eta?.ready ? (
            <>
              <p className="text-sm text-foreground">
                Trained on <b>{data.eta.samples}</b> delivered orders. Average error <b>{data.eta.maeMinutes} min</b>
                {data.eta.ruleMaeMinutes != null && <> (old rule: {data.eta.ruleMaeMinutes} min)</>}.
              </p>
              <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px]">
                {data.eta.features.map((f, i) => (
                  <div key={f} className="rounded-lg bg-muted/60 p-1.5">
                    <p className="font-mono font-bold text-foreground">{data.eta!.coefficients[i]}</p>
                    <p className="text-muted-foreground">{f}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">minutes = intercept + roadKm·b1 + items·b2 + peakHour·b3 + rain·b4 · refit hourly</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Waiting for data: {data.eta?.samples ?? 0} of 30 delivered orders needed. Until then ETAs use prep + travel time.
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <Map className="h-4 w-4 text-admin" /> Map services
          </p>
          <p className="text-xs text-muted-foreground">Routing (OSRM): {data.routing.osrm}</p>
          <p className="text-xs text-muted-foreground">Addresses (Nominatim): {data.routing.nominatim}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Set NEXT_PUBLIC_OSRM_URL and NEXT_PUBLIC_NOMINATIM_URL to use your own servers (see docker-compose.maps.yml).
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <p className="border-b border-border px-4 py-2 text-sm font-bold text-foreground">Recent errors</p>
        {data.recentErrors.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No errors recorded. 🎉</p>
        ) : (
          <table className="w-full text-xs">
            <tbody>
              {data.recentErrors.map((e) => (
                <tr key={e._id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-2 py-2">
                    <span className={`rounded px-1.5 py-0.5 font-bold ${e.source === 'server' ? 'bg-danger/10 text-danger' : 'bg-amber-500/10 text-amber-600'}`}>{e.source}</span>
                  </td>
                  <td className="px-2 py-2 font-mono">{e.method} {e.route}</td>
                  <td className="px-4 py-2 text-foreground">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
