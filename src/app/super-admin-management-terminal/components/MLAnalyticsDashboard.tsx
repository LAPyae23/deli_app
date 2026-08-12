'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  linearRegression,
  linearRegressionLine,
  rSquared,
} from 'simple-statistics';
import {
  ResponsiveContainer,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ZAxis,
  Line,
  ComposedChart,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Brain, ShoppingBasket, Users, TrendingUp, Loader2, CalendarRange } from 'lucide-react';

type OrderItem = {
  name?: string;
  category?: string;
  quantity?: number;
};

type AnalyticsOrder = {
  _id?: string;
  customerName?: string;
  customerId?: string;
  distanceKm?: number;
  durationMins?: number;
  prepTime?: number;
  customerOrderCount?: number;
  createdAt?: string | Date;
  items?: OrderItem[];
  status?: string;
};

type PairStat = { pair: string; count: number; support: number };
type ChurnSlice = { name: string; value: number; color: string };

type DateRangeKey = '7d' | '30d' | '90d' | 'all';

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string; days: number | null }[] = [
  { key: '7d', label: 'Last 7 Days', days: 7 },
  { key: '30d', label: 'Last 30 Days', days: 30 },
  { key: '90d', label: 'Last 90 Days', days: 90 },
  { key: 'all', label: 'All Time', days: null },
];

const CHURN_COLORS = {
  Safe: '#22c55e',
  'At Risk': '#f59e0b',
  Churned: '#ef4444',
};

function filterOrdersByRange(orders: AnalyticsOrder[], range: DateRangeKey): AnalyticsOrder[] {
  const option = DATE_RANGE_OPTIONS.find((o) => o.key === range);
  if (!option || option.days == null) return orders;

  const cutoff = Date.now() - option.days * 24 * 60 * 60 * 1000;
  return orders.filter((o) => {
    if (!o.createdAt) return false;
    const t = new Date(o.createdAt).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
}

function daysSince(date: Date) {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

function computeRegression(orders: AnalyticsOrder[]) {
  const points = orders
    .map((o) => {
      const x = Number(o.distanceKm);
      const y = Number(o.durationMins);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) return null;
      return [x, y] as [number, number];
    })
    .filter((p): p is [number, number] => p != null);

  if (points.length < 2) {
    return {
      scatter: [] as { distanceKm: number; durationMins: number }[],
      line: [] as { distanceKm: number; predicted: number }[],
      slope: 0,
      intercept: 0,
      r2: 0,
      mae: 0,
      rmse: 0,
      n: points.length,
    };
  }

  const model = linearRegression(points);
  const predict = linearRegressionLine(model);
  const r2 = rSquared(points, predict);

  // MAE / RMSE: actual durationMins vs model prediction on the same scatter points
  let absErrSum = 0;
  let sqErrSum = 0;
  for (const [x, y] of points) {
    const err = y - predict(x);
    absErrSum += Math.abs(err);
    sqErrSum += err * err;
  }
  const mae = absErrSum / points.length;
  const rmse = Math.sqrt(sqErrSum / points.length);

  const xs = points.map((p) => p[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  return {
    scatter: points.map(([distanceKm, durationMins]) => ({ distanceKm, durationMins })),
    line: [
      { distanceKm: minX, predicted: predict(minX) },
      { distanceKm: maxX, predicted: predict(maxX) },
    ],
    slope: model.m,
    intercept: model.b,
    r2,
    mae,
    rmse,
    n: points.length,
  };
}

function computeMarketBasket(orders: AnalyticsOrder[], topN = 5): PairStat[] {
  const pairCounts = new Map<string, number>();
  let baskets = 0;

  for (const order of orders) {
    const names = Array.from(
      new Set(
        (order.items || [])
          .map((i) => String(i.name || '').trim())
          .filter(Boolean)
      )
    ).sort();

    if (names.length < 2) continue;
    baskets += 1;

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = `${names[i]} + ${names[j]}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }

  return Array.from(pairCounts.entries())
    .map(([pair, count]) => ({
      pair,
      count,
      support: baskets > 0 ? Math.round((count / baskets) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

type ChurnLabel = 'Safe' | 'At Risk' | 'Churned';

type ChurnMetrics = {
  accuracy: number;
  precision: number;
  recall: number;
  sampleSize: number;
};

/** Model heuristic used for UI segments */
function predictChurnLabel(ageDays: number, orderCount: number, maxReportedCount: number): ChurnLabel {
  const isOneTimer = orderCount <= 1 || maxReportedCount <= 1;
  if (ageDays > 60 && isOneTimer) return 'Churned';
  if (ageDays > 30 && isOneTimer) return 'At Risk';
  if (ageDays > 45 && orderCount <= 2) return 'At Risk';
  return 'Safe';
}

/**
 * Slightly stricter “oracle” labels for evaluation (simulated ground truth).
 * Lets us score Accuracy / Precision / Recall without external labels.
 */
function oracleChurnLabel(ageDays: number, orderCount: number, maxReportedCount: number): ChurnLabel {
  const isOneTimer = orderCount <= 1 || maxReportedCount <= 1;
  if (ageDays > 50 && isOneTimer) return 'Churned';
  if (ageDays > 28 && isOneTimer) return 'At Risk';
  if (ageDays > 40 && orderCount <= 2) return 'At Risk';
  return 'Safe';
}

function computeChurn(orders: AnalyticsOrder[]): {
  slices: ChurnSlice[];
  totals: { Safe: number; 'At Risk': number; Churned: number };
  metrics: ChurnMetrics;
} {
  type Agg = {
    orderCount: number;
    lastOrderAt: Date;
    maxReportedCount: number;
  };

  const byCustomer = new Map<string, Agg>();

  for (const order of orders) {
    const key =
      order.customerId ||
      order.customerName ||
      String(order._id || Math.random());
    const created = order.createdAt ? new Date(order.createdAt) : new Date(0);
    const existing = byCustomer.get(key);
    const reported = Number(order.customerOrderCount) || 1;

    if (!existing) {
      byCustomer.set(key, {
        orderCount: 1,
        lastOrderAt: created,
        maxReportedCount: reported,
      });
    } else {
      existing.orderCount += 1;
      existing.maxReportedCount = Math.max(existing.maxReportedCount, reported);
      if (created > existing.lastOrderAt) existing.lastOrderAt = created;
    }
  }

  const totals = { Safe: 0, 'At Risk': 0, Churned: 0 };
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let correct = 0;
  const n = byCustomer.size;

  for (const agg of byCustomer.values()) {
    const ageDays = daysSince(agg.lastOrderAt);
    const predicted = predictChurnLabel(ageDays, agg.orderCount, agg.maxReportedCount);
    const actual = oracleChurnLabel(ageDays, agg.orderCount, agg.maxReportedCount);

    totals[predicted] += 1;
    if (predicted === actual) correct += 1;

    // Binary evaluation with Churned as the positive class
    const predPos = predicted === 'Churned';
    const actualPos = actual === 'Churned';
    if (predPos && actualPos) tp += 1;
    else if (predPos && !actualPos) fp += 1;
    else if (!predPos && actualPos) fn += 1;
  }

  const accuracy = n > 0 ? correct / n : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;

  const slices: ChurnSlice[] = (
    Object.keys(totals) as Array<keyof typeof totals>
  ).map((name) => ({
    name,
    value: totals[name],
    color: CHURN_COLORS[name],
  }));

  return {
    slices,
    totals,
    metrics: {
      accuracy,
      precision,
      recall,
      sampleSize: n,
    },
  };
}

export default function MLAnalyticsDashboard() {
  const [orders, setOrders] = useState<AnalyticsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeKey>('30d');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to load orders');
        }
        if (!cancelled) {
          setOrders(Array.isArray(data.orders) ? data.orders : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load analytics');
          setOrders([]);
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

  const filteredOrders = useMemo(
    () => filterOrdersByRange(orders, dateRange),
    [orders, dateRange]
  );

  const regression = useMemo(() => computeRegression(filteredOrders), [filteredOrders]);
  const baskets = useMemo(() => computeMarketBasket(filteredOrders), [filteredOrders]);
  const churn = useMemo(() => computeChurn(filteredOrders), [filteredOrders]);

  const composedData = useMemo(() => {
    return {
      scatter: regression.scatter,
      line: regression.line,
    };
  }, [regression]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-admin" />
        <p className="text-sm font-medium">Running ML analytics on order data…</p>
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

  const churnTotal =
    churn.totals.Safe + churn.totals['At Risk'] + churn.totals.Churned || 1;
  const rangeLabel =
    DATE_RANGE_OPTIONS.find((o) => o.key === dateRange)?.label || 'All Time';

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Brain className="h-5 w-5 text-admin" />
            <h2 className="text-xl font-bold text-foreground">ML Analytics Lab</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            In-browser models on{' '}
            <span className="font-semibold text-foreground font-tabular">
              {filteredOrders.length.toLocaleString()}
            </span>{' '}
            of {orders.length.toLocaleString()} orders · {rangeLabel}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 sm:items-end">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5 text-customer" />
            Date range
          </div>
          <div
            role="group"
            aria-label="Analytics date range"
            className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-muted/60 p-1 shadow-sm dark:bg-muted/40"
          >
            {DATE_RANGE_OPTIONS.map((option) => {
              const active = dateRange === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setDateRange(option.key)}
                  aria-pressed={active}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                    active
                      ? 'bg-customer text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-card hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">No orders in this range</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a wider window or seed more historical orders.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Linear Regression */}
        <div className="rounded-2xl border border-border bg-card p-5 xl:col-span-1">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-customer" />
                <h3 className="text-sm font-bold text-foreground">Linear Regression</h3>
              </div>
              <p className="text-xs text-muted-foreground">Distance (km) → Duration (mins)</p>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            <div className="rounded-lg border border-border bg-background/80 px-2 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Slope</p>
              <p className="text-sm font-semibold text-foreground font-tabular">
                {regression.slope.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background/80 px-2 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Intercept</p>
              <p className="text-sm font-semibold text-foreground font-tabular">
                {regression.intercept.toFixed(1)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background/80 px-2 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">R²</p>
              <p className="text-sm font-semibold text-admin font-tabular">
                {regression.r2.toFixed(3)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background/80 px-2 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">MAE</p>
              <p className="text-sm font-semibold text-customer font-tabular">
                {regression.mae.toFixed(2)}
              </p>
              <p className="text-[9px] text-muted-foreground">mins</p>
            </div>
            <div className="rounded-lg border border-border bg-background/80 px-2 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">RMSE</p>
              <p className="text-sm font-semibold text-customer font-tabular">
                {regression.rmse.toFixed(2)}
              </p>
              <p className="text-[9px] text-muted-foreground">mins</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  dataKey="distanceKm"
                  name="Distance"
                  unit=" km"
                  stroke="var(--muted-foreground)"
                  tick={{ fontSize: 11 }}
                  domain={['auto', 'auto']}
                />
                <YAxis
                  type="number"
                  name="Duration"
                  unit=" m"
                  stroke="var(--muted-foreground)"
                  tick={{ fontSize: 11 }}
                />
                <ZAxis range={[40, 40]} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Scatter
                  name="Orders"
                  data={composedData.scatter}
                  fill="#6366f1"
                  fillOpacity={0.65}
                />
                <Line
                  data={composedData.line}
                  type="linear"
                  dataKey="predicted"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  name="Trend"
                  legendType="line"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            duration ≈ {regression.slope.toFixed(2)} × distance + {regression.intercept.toFixed(1)}{' '}
            · n={regression.n} · MAE {regression.mae.toFixed(2)} · RMSE {regression.rmse.toFixed(2)}
          </p>
        </div>

        {/* Market Basket */}
        <div className="rounded-2xl border border-border bg-card p-5 xl:col-span-1">
          <div className="mb-4">
            <div className="mb-1 flex items-center gap-2">
              <ShoppingBasket className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-bold text-foreground">Market Basket (Apriori)</h3>
            </div>
            <p className="text-xs text-muted-foreground">Top item pairs bought together</p>
          </div>

          {baskets.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Not enough multi-item orders for pair mining.
            </p>
          ) : (
            <>
              <div className="mb-4 h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={baskets}
                    layout="vertical"
                    margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="pair"
                      width={120}
                      stroke="var(--muted-foreground)"
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" fill="#f59e0b" radius={[0, 6, 6, 0]} name="Co-orders" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <ul className="space-y-2">
                {baskets.map((b, idx) => (
                  <li
                    key={b.pair}
                    className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">
                        <span className="mr-2 text-muted-foreground">#{idx + 1}</span>
                        {b.pair}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-bold text-warning font-tabular">{b.count}×</p>
                      <p className="text-[10px] text-muted-foreground">{b.support}% support</p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Churn */}
        <div className="rounded-2xl border border-border bg-card p-5 xl:col-span-1">
          <div className="mb-4">
            <div className="mb-1 flex items-center gap-2">
              <Users className="h-4 w-4 text-success" />
              <h3 className="text-sm font-bold text-foreground">Churn Prediction</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Heuristic risk from order count + recency
            </p>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={churn.slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={3}
                >
                  {churn.slices.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => (
                    <span className="text-xs text-foreground/80">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {(Object.keys(churn.totals) as Array<keyof typeof churn.totals>).map((key) => (
              <div
                key={key}
                className="rounded-lg border border-border bg-background/70 px-2 py-2 text-center"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {key}
                </p>
                <p className="text-sm font-bold text-foreground font-tabular">
                  {Math.round((churn.totals[key] / churnTotal) * 100)}%
                </p>
                <p className="text-[10px] text-muted-foreground">{churn.totals[key]} cust.</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-border bg-background/80 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Model performance · Churned class
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border bg-card px-2 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Accuracy</p>
                <p className="text-sm font-bold text-success font-tabular">
                  {(churn.metrics.accuracy * 100).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card px-2 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Precision</p>
                <p className="text-sm font-bold text-warning font-tabular">
                  {(churn.metrics.precision * 100).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card px-2 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Recall</p>
                <p className="text-sm font-bold text-danger font-tabular">
                  {(churn.metrics.recall * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Evaluated on {churn.metrics.sampleSize.toLocaleString()} customers vs oracle labels
            </p>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            High risk: single-order customers idle &gt;30 days. Churned: idle &gt;60 days with
            one order.
          </p>
        </div>
      </div>
    </section>
  );
}
