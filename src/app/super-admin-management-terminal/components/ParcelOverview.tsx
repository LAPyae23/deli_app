'use client';

import React, { useEffect, useState } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { formatKyat } from '@/lib/currency';

type Payload = {
  success: boolean;
  status: Record<string, number>;
  today: { parcels: number; gmv: number; platformRevenue: number; avgRoadKm: number; avgDeliveryMins: number | null };
  latest: Array<{
    _id: string;
    code: string;
    status: string;
    senderName?: string;
    recipientName?: string;
    pickup?: { address?: string };
    dropoff?: { address?: string };
    price?: { total?: number; roadKm?: number };
    riderName?: string;
    createdAt: string;
  }>;
};

const STATUS_ORDER = ['REQUESTED', 'ACCEPTED', 'PICKED_UP', 'DELIVERED', 'CANCELLED'];
const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Waiting for rider',
  ACCEPTED: 'Rider assigned',
  PICKED_UP: 'In transit',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** FoodDash Express (person-to-person parcels) at a glance. */
export default function ParcelOverview() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch('/api/admin/parcels')
        .then((r) => r.json())
        .then((j: Payload) => (j.success ? setData(j) : setError(true)))
        .catch(() => setError(true));
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Package className="h-4 w-4 text-admin" />
        <h3 className="text-sm font-bold text-foreground">FoodDash Express — parcels</h3>
      </div>
      {error && <p className="text-sm text-muted-foreground">Could not load parcels.</p>}
      {!data && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-admin" /> Loading…
        </div>
      )}
      {data && (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ['Parcels today', String(data.today.parcels)],
              ['Fares today', formatKyat(data.today.gmv)],
              ['Platform revenue', formatKyat(data.today.platformRevenue)],
              ['Avg distance', `${data.today.avgRoadKm} km`],
              ['Avg delivery time', data.today.avgDeliveryMins != null ? `${data.today.avgDeliveryMins} min` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border p-3">
                <dt className="text-[11px] text-muted-foreground">{k}</dt>
                <dd className="text-sm font-bold text-foreground font-tabular">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            {STATUS_ORDER.map((s) => (
              <span key={s} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground">
                {STATUS_LABEL[s]} <span className="font-bold font-tabular">{data.status[s] || 0}</span>
              </span>
            ))}
          </div>
          {data.latest.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1.5 pr-3 font-semibold">Code</th>
                    <th className="py-1.5 pr-3 font-semibold">Status</th>
                    <th className="py-1.5 pr-3 font-semibold">From → To</th>
                    <th className="py-1.5 pr-3 font-semibold">Rider</th>
                    <th className="py-1.5 text-right font-semibold">Fare</th>
                  </tr>
                </thead>
                <tbody>
                  {data.latest.map((p) => (
                    <tr key={p._id} className="border-t border-border">
                      <td className="py-1.5 pr-3 font-semibold text-foreground">{p.code}</td>
                      <td className="py-1.5 pr-3 text-foreground">{STATUS_LABEL[p.status] || p.status}</td>
                      <td className="max-w-[320px] truncate py-1.5 pr-3 text-muted-foreground">
                        {p.senderName || 'Sender'} → {p.recipientName} · {p.price?.roadKm} km
                      </td>
                      <td className="py-1.5 pr-3 text-foreground">{p.riderName || '—'}</td>
                      <td className="py-1.5 text-right font-tabular text-foreground">{formatKyat(p.price?.total || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No parcels yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
