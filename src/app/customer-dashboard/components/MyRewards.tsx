'use client';

import { useEffect, useState } from 'react';
import { Gift, Copy, TicketPercent } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { formatKyat } from '@/lib/currency';

type Loyalty = {
  balance: number;
  lifetime: number;
  rules: { ksPerPointEarned: number; ksPerPointValue: number; minimum: number };
  history: Array<{
    _id: string;
    orderNumber: string;
    restaurantName?: string;
    pointsEarned?: number;
    pointsRedeemed?: number;
    pointsRefunded?: boolean;
    createdAt: string;
  }>;
  promos: Array<{
    code: string;
    description: string;
    label: string;
    minSubtotal: number;
    firstOrderOnly: boolean;
    expiresAt: string | null;
    usesLeft: number;
  }>;
};

/** Customer's loyalty points, recent point activity and promo codes they can still use. */
export default function MyRewards() {
  const { tx } = useT();
  const [data, setData] = useState<Loyalty | null>(null);

  useEffect(() => {
    fetch('/api/customer/loyalty')
      .then((r) => r.json())
      .then((d) => d?.success && setData(d as Loyalty))
      .catch(() => {});
  }, []);

  if (!data) return <div className="h-32 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Gift className="h-4 w-4 text-customer" /> {tx('My points & codes')}
      </p>
      <div className="rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 p-4 text-white">
        <p className="text-xs opacity-80">Points balance</p>
        <p className="text-3xl font-bold">{data.balance.toLocaleString()}</p>
        <p className="text-xs opacity-90">
          Worth {formatKyat(data.balance * data.rules.ksPerPointValue)} · {data.lifetime.toLocaleString()} earned all-time
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Earn 1 point per {data.rules.ksPerPointEarned.toLocaleString()} Ks when an order is delivered. Spend from{' '}
        {data.rules.minimum} points at checkout (1 point = {data.rules.ksPerPointValue} Ks, up to 30% of the food).
      </p>

      {data.history.length > 0 && (
        <ul className="space-y-1.5 text-xs">
          {data.history.slice(0, 5).map((h) => (
            <li key={h._id} className="flex justify-between">
              <span className="truncate text-muted-foreground">
                {h.orderNumber} · {h.restaurantName}
              </span>
              <span className="font-semibold">
                {h.pointsEarned ? <span className="text-emerald-600">+{h.pointsEarned}</span> : null}
                {h.pointsRedeemed ? (
                  <span className="ml-1 text-danger">
                    −{h.pointsRedeemed}
                    {h.pointsRefunded ? ' (refunded)' : ''}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
          <TicketPercent className="h-3.5 w-3.5" /> Codes you can use
        </p>
        {data.promos.length === 0 ? (
          <p className="text-xs text-muted-foreground">No codes right now.</p>
        ) : (
          data.promos.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(p.code);
                toast.success(`${p.code} copied. Paste it at checkout.`);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-customer/40 bg-orange-50/50 px-3 py-2 text-left dark:bg-orange-950/20"
            >
              <span className="min-w-0">
                <span className="block font-mono text-sm font-bold text-customer">{p.code}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {p.label}
                  {p.minSubtotal ? ` · min ${p.minSubtotal.toLocaleString()} Ks` : ''}
                  {p.firstOrderOnly ? ' · first order' : ''}
                  {p.usesLeft > 1 ? ` · ${p.usesLeft} uses left` : ''}
                </span>
              </span>
              <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
