'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Crown,
  Loader2,
  MoonStar,
  Users,
  Sparkles,
  TicketPercent,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatKyat } from '@/lib/currency';

type RfmSegment = 'Top VIP' | 'Sleeping Beauty' | 'New/Normal';
type ActiveTab = 'VIP' | 'SLEEPING' | 'NORMAL';

type SegmentSlice = {
  name: RfmSegment;
  value: number;
  percentage: number;
};

type RfmCustomer = {
  customerId: string;
  customerName: string;
  recencyDays: number;
  frequency: number;
  monetary: number;
  lastOrderAt: string;
  segment: RfmSegment;
};

type RfmResponse = {
  success: boolean;
  summary?: {
    totalCustomers: number;
    segments: SegmentSlice[];
  };
  topVips?: RfmCustomer[];
  sleepingBeauties?: RfmCustomer[];
  newNormals?: RfmCustomer[];
  message?: string;
};

const SEGMENT_COLORS: Record<RfmSegment, string> = {
  'Top VIP': '#f59e0b',
  'Sleeping Beauty': '#a78bfa',
  'New/Normal': '#34d399',
};

const TABS: { key: ActiveTab; label: string; segment: RfmSegment }[] = [
  { key: 'VIP', label: 'VIP', segment: 'Top VIP' },
  { key: 'SLEEPING', label: 'Sleeping', segment: 'Sleeping Beauty' },
  { key: 'NORMAL', label: 'Normal', segment: 'New/Normal' },
];

function formatMoney(amount: number) {
  return formatKyat(amount);
}

export default function RFMDashboard() {
  const [segments, setSegments] = useState<SegmentSlice[]>([]);
  const [topVips, setTopVips] = useState<RfmCustomer[]>([]);
  const [sleepingBeauties, setSleepingBeauties] = useState<RfmCustomer[]>([]);
  const [newNormals, setNewNormals] = useState<RfmCustomer[]>([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('VIP');
  const [grantedIds, setGrantedIds] = useState<Set<string>>(new Set());
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState<RfmCustomer | null>(null);
  const [discountValue, setDiscountValue] = useState('20');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/rfm-analysis');
        const data = (await res.json()) as RfmResponse;
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to load RFM analysis');
        }
        if (!cancelled) {
          setSegments(Array.isArray(data.summary?.segments) ? data.summary!.segments : []);
          setTopVips(Array.isArray(data.topVips) ? data.topVips : []);
          setSleepingBeauties(
            Array.isArray(data.sleepingBeauties) ? data.sleepingBeauties : []
          );
          setNewNormals(Array.isArray(data.newNormals) ? data.newNormals : []);
          setTotalCustomers(Number(data.summary?.totalCustomers) || 0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setSegments([]);
          setTopVips([]);
          setSleepingBeauties([]);
          setNewNormals([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData = useMemo(
    () =>
      segments
        .filter((s) => s.value > 0)
        .map((s) => ({
          name: s.name,
          value: s.value,
          percentage: s.percentage,
          color: SEGMENT_COLORS[s.name],
        })),
    [segments]
  );

  const list = useMemo(() => {
    if (activeTab === 'VIP') return topVips;
    if (activeTab === 'SLEEPING') return sleepingBeauties;
    return newNormals;
  }, [activeTab, topVips, sleepingBeauties, newNormals]);

  const tabMeta = TABS.find((t) => t.key === activeTab) || TABS[0];

  function handlePromoClick(customer: RfmCustomer) {
    setActiveCustomer(customer);
    setDiscountValue('20');
    setIsPromoModalOpen(true);
  }

  function closePromoModal() {
    setIsPromoModalOpen(false);
    setActiveCustomer(null);
  }

  async function grantPromo() {
    const customer = activeCustomer;
    if (!customer) return;

    const percentRaw = discountValue;
    const discountPercent = Number(percentRaw);
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      toast.error('Enter a percentage between 1 and 100');
      return;
    }

    const promoCode = `COMEBACK${Math.round(discountPercent)}`;

    setGrantingId(customer.customerId);
    try {
      const res = await fetch('/api/admin/grant-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.customerId,
          discountPercent,
          promoCode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to grant promo');
      }
      setGrantedIds((prev) => new Set(prev).add(customer.customerId));
      toast.success(
        `Granted ${promoCode} (${discountPercent}% off) to ${customer.customerName}`
      );
      setIsPromoModalOpen(false);
      setActiveCustomer(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to grant promo');
    } finally {
      setGrantingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-admin" />
        <p className="text-sm font-medium">Scoring customers with RFM…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/10 px-6 py-8 text-center">
        <p className="text-sm font-semibold text-danger">{error}</p>
      </div>
    );
  }

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-400" />
            <h2 className="text-xl font-bold text-foreground">RFM Customer Segmentation</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Recency · Frequency · Monetary across {totalCustomers.toLocaleString()} customers
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {segments.map((s) => (
            <div
              key={s.name}
              className="rounded-lg border border-border bg-background/70 px-3 py-1.5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {s.name}
              </p>
              <p className="text-sm font-bold text-foreground font-tabular">
                {s.value}{' '}
                <span className="text-xs font-medium text-muted-foreground">({s.percentage}%)</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="rounded-xl border border-border bg-background/50 p-4 xl:col-span-2">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-admin" />
            <h3 className="text-sm font-bold text-foreground">Segment Mix</h3>
          </div>
          <div className="h-72 w-full">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No customer segments yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="48%"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={3}
                    stroke="var(--card)"
                    strokeWidth={2}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      color: 'var(--foreground)',
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string, props) => {
                      const pct = props?.payload?.percentage ?? 0;
                      return [`${value} customers (${pct}%)`, name];
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => (
                      <span className="text-xs text-muted-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="xl:col-span-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-xl border border-border bg-muted/50 p-1">
              {TABS.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? 'bg-admin text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Grant a one-time promo to this segment
            </p>
          </div>

          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-14 text-center">
              <Users className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No {tabMeta.segment} customers in this window.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="max-h-[22rem] overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-3 py-3 font-semibold">R (days)</th>
                      <th className="px-3 py-3 font-semibold">F</th>
                      <th className="px-3 py-3 font-semibold">M</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background/40">
                    {list.map((c) => {
                      const granted = grantedIds.has(c.customerId);
                      const busy = grantingId === c.customerId;
                      return (
                        <tr
                          key={c.customerId}
                          className="transition-colors hover:bg-muted/40"
                        >
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground">{c.customerName}</p>
                            <p className="truncate text-[11px] text-muted-foreground font-tabular">
                              {c.customerId}
                            </p>
                          </td>
                          <td className="px-3 py-3 font-tabular text-violet-300">
                            {c.recencyDays}
                          </td>
                          <td className="px-3 py-3 font-tabular text-foreground">
                            {c.frequency}
                          </td>
                          <td className="px-3 py-3 font-tabular text-foreground">
                            {formatMoney(c.monetary)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              disabled={granted || busy}
                              onClick={() => handlePromoClick(c)}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                granted
                                  ? 'cursor-default bg-emerald-500/15 text-emerald-400'
                                  : 'bg-admin/20 text-admin hover:bg-admin/30'
                              }`}
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : granted ? (
                                <Crown className="h-3.5 w-3.5" />
                              ) : activeTab === 'SLEEPING' ? (
                                <MoonStar className="h-3.5 w-3.5" />
                              ) : (
                                <TicketPercent className="h-3.5 w-3.5" />
                              )}
                              {granted ? 'Promo Granted' : 'Grant Promo Code'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {isPromoModalOpen && activeCustomer ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          onClick={closePromoModal}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rfm-promo-title"
          >
            <div className="border-b border-border px-5 py-4">
              <p id="rfm-promo-title" className="text-sm font-bold text-foreground">
                Grant promo code
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                One-time discount for {activeCustomer.customerName}
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <label className="block text-xs font-semibold text-muted-foreground" htmlFor="rfm-discount">
                Discount percentage
              </label>
              <input
                id="rfm-discount"
                type="number"
                min={1}
                max={100}
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
                className="input-field h-10 w-full text-sm font-semibold"
              />
              <p className="text-[11px] text-muted-foreground">
                Code will be COMEBACK{Math.round(Number(discountValue) || 20)}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={closePromoModal}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={grantingId === activeCustomer.customerId}
                onClick={() => void grantPromo()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-admin px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {grantingId === activeCustomer.customerId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <TicketPercent className="h-3.5 w-3.5" />
                )}
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
