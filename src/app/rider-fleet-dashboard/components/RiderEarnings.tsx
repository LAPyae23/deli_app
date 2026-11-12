'use client';

import { useEffect, useState } from 'react';
import { Clock, Star, Wallet } from 'lucide-react';
import { formatKyat } from '@/lib/currency';

type Totals = { food: number; tips: number; parcels: number; total: number; trips: number; km: number; perTrip: number };
type Earnings = {
  today: Totals;
  week: Totals;
  month: Totals;
  series: Array<{ day: string; food: number; tips: number; parcels: number }>;
  rating: { average: number; count: number } | null;
  bestHours: Array<{ hour: number; perTrip: number; trips: number }>;
  wallet: { balance: number; isBlocked: boolean };
};

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: '7 days' },
  { key: 'month', label: '30 days' },
] as const;

const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;

/** Earnings breakdown for riders: fees, tips and parcels, a 14-day chart, rating and best hours. */
export default function RiderEarnings() {
  const [data, setData] = useState<Earnings | null>(null);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('week');

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch('/api/rider/earnings')
        .then((r) => r.json())
        .then((d) => !cancelled && d?.success && setData(d as Earnings))
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!data) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  const t = data[period];
  const max = Math.max(1, ...data.series.map((d) => d.food + d.tips + d.parcels));

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-foreground">Earnings breakdown</h3>
        <div className="flex rounded-lg bg-muted p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                period === p.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-3xl font-bold text-foreground">{formatKyat(t.total)}</p>
      <p className="text-xs text-muted-foreground">
        {t.trips} trips · {t.km} km · {formatKyat(t.perTrip)} per trip
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Delivery fees', value: t.food, color: 'bg-emerald-500' },
          { label: 'Tips', value: t.tips, color: 'bg-amber-500' },
          { label: 'Parcels', value: t.parcels, color: 'bg-sky-500' },
        ].map((x) => (
          <div key={x.label} className="rounded-xl bg-muted/50 p-2">
            <span className={`mx-auto mb-1 block h-1.5 w-6 rounded-full ${x.color}`} />
            <p className="text-sm font-bold text-foreground">{formatKyat(x.value)}</p>
            <p className="text-[10px] text-muted-foreground">{x.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex h-28 items-end gap-1">
        {data.series.map((d) => {
          const total = d.food + d.tips + d.parcels;
          return (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${formatKyat(total)}`}>
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-t" style={{ height: `${Math.max(3, (total / max) * 100)}%` }}>
                <div className="bg-emerald-500" style={{ flex: d.food || 0.0001 }} />
                <div className="bg-amber-500" style={{ flex: d.tips || 0.0001 }} />
                <div className="bg-sky-500" style={{ flex: d.parcels || 0.0001 }} />
              </div>
              <span className="text-[8px] text-muted-foreground">{d.day.split(' ')[0]}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-2.5">
          <Star className="h-4 w-4 text-amber-500" />
          <span className="text-xs text-foreground">
            {data.rating ? `${data.rating.average} ★ from ${data.rating.count} ratings` : 'No ratings yet'}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-2.5">
          <Clock className="h-4 w-4 text-emerald-600" />
          <span className="text-xs text-foreground">
            {data.bestHours.length
              ? `Best hours: ${data.bestHours.map((h) => hourLabel(h.hour)).join(', ')}`
              : 'Ride more to see your best hours'}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-2.5">
          <Wallet className={`h-4 w-4 ${data.wallet.balance < 0 ? 'text-danger' : 'text-emerald-600'}`} />
          <span className="text-xs text-foreground">
            COD wallet {formatKyat(data.wallet.balance)}
            {data.wallet.isBlocked ? ' · blocked, please remit' : ''}
          </span>
        </div>
      </div>
    </section>
  );
}
