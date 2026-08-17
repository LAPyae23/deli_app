'use client';

import React, { useEffect, useState } from 'react';
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

type DateRangeKey = '7d' | '30d' | '90d' | 'all';
type ChurnLabel = 'Safe' | 'At Risk' | 'Churned';

type PairStat = {
  pair: string;
  count: number;
  support: number;
  confidence: number;
  lift: number;
};

type RegressionResult = {
  scatter: { distanceKm: number; durationMins: number }[];
  line: { distanceKm: number; predicted: number }[];
  slope: number;
  intercept: number;
  r2: number;
  mae: number;
  rmse: number;
  n: number;
};

type ChurnResult = {
  slices: { name: ChurnLabel; value: number; color: string }[];
  totals: Record<ChurnLabel, number>;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    sampleSize: number;
  };
  confusion?: Record<ChurnLabel, Record<ChurnLabel, number>>;
};

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
  { key: 'all', label: 'All Time' },
];

type AnalyticsPayload = {
  success: boolean;
  range?: DateRangeKey;
  rangeLabel?: string;
  orderCount?: number;
  regression?: RegressionResult;
  baskets?: PairStat[];
  churn?: ChurnResult;
  message?: string;
};

const EMPTY_REGRESSION: RegressionResult = {
  scatter: [],
  line: [],
  slope: 0,
  intercept: 0,
  r2: 0,
  mae: 0,
  rmse: 0,
  n: 0,
};

const EMPTY_CHURN: ChurnResult = {
  slices: [],
  totals: { Safe: 0, 'At Risk': 0, Churned: 0 },
  metrics: { accuracy: 0, precision: 0, recall: 0, f1: 0, sampleSize: 0 },
  confusion: {
    Safe: { Safe: 0, 'At Risk': 0, Churned: 0 },
    'At Risk': { Safe: 0, 'At Risk': 0, Churned: 0 },
    Churned: { Safe: 0, 'At Risk': 0, Churned: 0 },
  },
};

export default function MLAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<DateRangeKey>('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const [rangeLabel, setRangeLabel] = useState('Last 30 Days');
  const [regression, setRegression] = useState<RegressionResult>(EMPTY_REGRESSION);
  const [baskets, setBaskets] = useState<PairStat[]>([]);
  const [churn, setChurn] = useState<ChurnResult>(EMPTY_CHURN);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/ml-analytics?range=${dateRange}`);
        const data = (await res.json()) as AnalyticsPayload;
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to load analytics');
        }
        if (cancelled) return;
        setOrderCount(Number(data.orderCount) || 0);
        setRangeLabel(data.rangeLabel || 'All Time');
        setRegression(data.regression || EMPTY_REGRESSION);
        setBaskets(Array.isArray(data.baskets) ? data.baskets : []);
        setChurn(data.churn || EMPTY_CHURN);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load analytics');
          setOrderCount(0);
          setRegression(EMPTY_REGRESSION);
          setBaskets([]);
          setChurn(EMPTY_CHURN);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-admin" />
        <p className="text-sm font-medium">Running ML analytics on full order dataset…</p>
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

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Brain className="h-5 w-5 text-admin" />
            <h2 className="text-xl font-bold text-foreground">ML Analytics Lab</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Server models on{' '}
            <span className="font-semibold text-foreground font-tabular">
              {orderCount.toLocaleString()}
            </span>{' '}
            orders · {rangeLabel}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 sm:items-end">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5 text-customer" />
            Range
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

      {orderCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">No orders in this range</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try another window, All Time, or seed more historical orders.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
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
                  data={regression.scatter}
                  fill="#6366f1"
                  fillOpacity={0.65}
                />
                <Line
                  data={regression.line}
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
            · n={regression.n.toLocaleString()} · chart shows a sample of points
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 xl:col-span-1">
          <div className="mb-4">
            <div className="mb-1 flex items-center gap-2">
              <ShoppingBasket className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-bold text-foreground">Market Basket (Apriori)</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Top pairs · support · confidence · lift
            </p>
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

              <div className="mb-1 grid grid-cols-[1fr_auto] gap-2 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <span>Rule</span>
                <span className="text-right">S · C · Lift</span>
              </div>
              <ul className="space-y-2">
                {baskets.map((b, idx) => (
                  <li
                    key={b.pair}
                    className="rounded-lg border border-border bg-background/60 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-xs font-semibold text-foreground">
                        <span className="mr-2 text-muted-foreground">#{idx + 1}</span>
                        {b.pair}
                      </p>
                      <p className="shrink-0 text-xs font-bold text-warning font-tabular">
                        {b.count}×
                      </p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground font-tabular">
                        S {b.support}%
                      </span>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground font-tabular">
                        C {b.confidence}%
                      </span>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground font-tabular">
                        Lift {b.lift.toFixed(2)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

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
              Hold-out · last 30 days return vs predicted Churned
            </p>
            <div className="grid grid-cols-4 gap-2">
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
              <div className="rounded-lg border border-border bg-card px-2 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">F1</p>
                <p className="text-sm font-bold text-foreground font-tabular">
                  {(churn.metrics.f1 * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            {churn.confusion ? (
              <div className="mt-3 overflow-x-auto">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Confusion matrix · actual \\ predicted
                </p>
                <table className="w-full text-center text-[10px]">
                  <thead>
                    <tr>
                      <th className="px-1 py-1 text-muted-foreground" />
                      {(['Safe', 'At Risk', 'Churned'] as ChurnLabel[]).map((col) => (
                        <th key={col} className="px-1 py-1 font-semibold text-muted-foreground">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(['Safe', 'At Risk', 'Churned'] as ChurnLabel[]).map((row) => (
                      <tr key={row}>
                        <td className="px-1 py-1 text-left font-semibold text-muted-foreground">
                          {row}
                        </td>
                        {(['Safe', 'At Risk', 'Churned'] as ChurnLabel[]).map((col) => (
                          <td
                            key={col}
                            className={`px-1 py-1 font-tabular ${
                              row === col ? 'font-bold text-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            {churn.confusion?.[row]?.[col] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <p className="mt-2 text-[10px] text-muted-foreground">
              Evaluated on {churn.metrics.sampleSize.toLocaleString()} customers with history
              before the last 30 days. Actual = whether they ordered again in that window.
            </p>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            High risk: customers with ≤1 order idle &gt;30 days. Churned: idle &gt;60 days with
            ≤1 order (uses the higher of live count and stored customerOrderCount).
          </p>
        </div>
      </div>
    </section>
  );
}
