'use client';

import { useEffect, useState } from 'react';
import { BarChart3, CloudRain, Repeat, Star, Flame, TrendingUp } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { formatKyat } from '@/lib/currency';

type Analytics = {
  days: number;
  totalOrders: number;
  topDishes: Array<{ name: string; qty: number; revenue: number }>;
  heatmap: number[][];
  busiest: Array<{ day: number; hour: number; orders: number }>;
  customers: { total: number; repeat: number; repeatRate: number };
  rating: { average: number | null; count: number; distribution: number[] };
  weather: {
    wetDays: number;
    dryDays: number;
    wetAvgOrders: number;
    dryAvgOrders: number;
    changePct: number | null;
    topWetDishes: Array<{ name: string; qty: number }>;
  };
  daily: Array<{ day: string; revenue: number; orders: number }>;
  cancelRate: number;
};

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
        <Icon className="h-4 w-4 text-restaurant" /> {title}
      </p>
      {children}
    </div>
  );
}

/** 30-day analytics for restaurant owners: dishes, hours, customers, ratings and weather. */
export default function ShopAnalytics() {
  const { tx } = useT();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/restaurant/analytics')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.success) setData(d as Analytics);
        else setError(d?.message || 'Could not load analytics');
      })
      .catch(() => !cancelled && setError('Could not load analytics'));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="mt-6 text-sm text-muted-foreground">{error}</p>;
  if (!data) {
    return <div className="mt-6 h-40 animate-pulse rounded-2xl bg-muted" />;
  }

  const maxHeat = Math.max(1, ...data.heatmap.flat());
  const maxDish = Math.max(1, ...data.topDishes.map((d) => d.qty));
  const maxRevenue = Math.max(1, ...data.daily.map((d) => d.revenue));
  const maxStars = Math.max(1, ...data.rating.distribution);

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">{tx('Shop analytics')}</h2>
          <p className="text-xs text-muted-foreground">
            Last {data.days} days · {data.totalOrders} orders · {Math.round(data.cancelRate * 100)}% cancelled or rejected
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card title={tx('Top dishes')} icon={Flame}>
          {data.topDishes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.topDishes.map((d) => (
                <li key={d.name}>
                  <div className="flex justify-between text-xs">
                    <span className="truncate font-medium text-foreground">{d.name}</span>
                    <span className="text-muted-foreground">
                      {d.qty} sold · {formatKyat(d.revenue)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-restaurant" style={{ width: `${(d.qty / maxDish) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={tx('Busiest hours')} icon={BarChart3}>
          <div className="overflow-x-auto">
            <div className="min-w-[420px]">
              {data.heatmap.map((row, d) => (
                <div key={DAY_SHORT[d]} className="flex items-center gap-1">
                  <span className="w-8 text-[10px] text-muted-foreground">{DAY_SHORT[d]}</span>
                  {row.slice(6, 24).map((n, i) => (
                    <div
                      key={i}
                      title={`${DAY_SHORT[d]} ${hourLabel(i + 6)}: ${n} orders`}
                      className="m-[1px] h-4 flex-1 rounded-sm"
                      style={{ background: n ? `rgba(234, 88, 12, ${0.15 + 0.85 * (n / maxHeat)})` : 'hsl(var(--muted))' }}
                    />
                  ))}
                </div>
              ))}
              <div className="ml-9 mt-1 flex justify-between text-[9px] text-muted-foreground">
                <span>6am</span>
                <span>12pm</span>
                <span>6pm</span>
                <span>11pm</span>
              </div>
            </div>
          </div>
          {data.busiest.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Peak:{' '}
              {data.busiest.map((b) => `${DAY_SHORT[b.day]} ${hourLabel(b.hour)}`).join(', ')}. Have extra staff and stock ready.
            </p>
          )}
        </Card>

        <Card title={tx('Weather effect')} icon={CloudRain}>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-sky-500/10 p-3">
              <p className="text-2xl font-bold text-sky-600">{data.weather.wetAvgOrders}</p>
              <p className="text-[11px] text-muted-foreground">orders/day · {tx('Rainy days')} ({data.weather.wetDays})</p>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-3">
              <p className="text-2xl font-bold text-amber-600">{data.weather.dryAvgOrders}</p>
              <p className="text-[11px] text-muted-foreground">orders/day · {tx('Dry days')} ({data.weather.dryDays})</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {data.weather.changePct == null
              ? 'Not enough days of each weather yet.'
              : data.weather.changePct >= 0
                ? `Rain brings ${data.weather.changePct}% more orders.`
                : `Rain brings ${Math.abs(data.weather.changePct)}% fewer orders.`}
            {data.weather.topWetDishes.length > 0 &&
              ` On rainy days people order: ${data.weather.topWetDishes.map((d) => d.name).join(', ')}.`}
          </p>
        </Card>

        <Card title={tx('Repeat customers')} icon={Repeat}>
          <p className="text-3xl font-bold text-foreground">{Math.round(data.customers.repeatRate * 100)}%</p>
          <p className="text-xs text-muted-foreground">
            {data.customers.repeat} of {data.customers.total} customers ordered more than once.
          </p>
        </Card>

        <Card title={tx('Average rating')} icon={Star}>
          <p className="text-3xl font-bold text-foreground">
            {data.rating.average ?? '–'} <span className="text-base text-amber-500">★</span>
          </p>
          <p className="mb-2 text-xs text-muted-foreground">{data.rating.count} ratings</p>
          {[5, 4, 3, 2, 1].map((star) => (
            <div key={star} className="flex items-center gap-2 text-[11px]">
              <span className="w-3 text-muted-foreground">{star}</span>
              <div className="h-1.5 flex-1 rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-amber-500"
                  style={{ width: `${(data.rating.distribution[star - 1] / maxStars) * 100}%` }}
                />
              </div>
              <span className="w-6 text-right text-muted-foreground">{data.rating.distribution[star - 1]}</span>
            </div>
          ))}
        </Card>

        <Card title="Revenue, last 14 days" icon={TrendingUp}>
          {data.daily.length === 0 ? (
            <p className="text-xs text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="flex h-28 items-end gap-1">
              {data.daily.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${formatKyat(d.revenue)} · ${d.orders} orders`}>
                  <div className="w-full rounded-t bg-restaurant/80" style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 100)}%` }} />
                  <span className="text-[8px] text-muted-foreground">{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
