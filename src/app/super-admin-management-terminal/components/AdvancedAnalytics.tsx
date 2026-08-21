'use client';

import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, PieChart } from 'lucide-react';
import { formatKyat } from '@/lib/currency';
import OpsAndSentiment, {
  type OpsTownship,
  type ReviewKeyword,
  type SentimentMix,
} from './OpsAndSentiment';

type TopRestaurant = {
  restaurantName: string;
  revenue: number;
};

type StatusSlice = {
  status: string;
  count: number;
};

const STATUS_FILL: Record<string, string> = {
  PENDING: 'var(--warning)',
  PREPARING: 'var(--admin)',
  READY: 'var(--success)',
  OUT_FOR_DELIVERY: 'var(--rider)',
  DELIVERED: '#0F766E',
  REJECTED: 'var(--danger)',
  CANCELLED: '#94A3B8',
};

const STATUS_TICK: Record<string, string> = {
  PENDING: 'Pending',
  PREPARING: 'Prep',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out',
  DELIVERED: 'Done',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancel',
};

function compactKyat(value: number) {
  const n = Math.max(0, Math.round(Number(value) || 0));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function truncateName(name: string, max = 18) {
  const value = String(name || 'Unknown').trim() || 'Unknown';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function RevenueTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: TopRestaurant }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-muted px-4 py-3 card-shadow-md">
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{row.restaurantName}</p>
      <p className="text-sm font-bold font-tabular text-foreground">{formatKyat(row.revenue)}</p>
    </div>
  );
}

function StatusTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: StatusSlice }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-muted px-4 py-3 card-shadow-md">
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{formatStatus(row.status)}</p>
      <p className="text-sm font-bold font-tabular text-foreground">
        {row.count.toLocaleString()} orders
      </p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-admin/10">
          <Icon className="h-4 w-4 text-admin" />
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

const EMPTY_SENTIMENT: SentimentMix = { positive: 0, neutral: 0, negative: 0 };

export default function AdvancedAnalytics() {
  const [topRestaurants, setTopRestaurants] = useState<TopRestaurant[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusSlice[]>([]);
  const [opsBreakdown, setOpsBreakdown] = useState<OpsTownship[]>([]);
  const [sentimentMix, setSentimentMix] = useState<SentimentMix>(EMPTY_SENTIMENT);
  const [topKeywords, setTopKeywords] = useState<ReviewKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/advanced-analytics', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || 'Failed to load analytics');
        }
        if (cancelled) return;
        setTopRestaurants(
          (Array.isArray(json.topRestaurants) ? json.topRestaurants : []).map(
            (row: TopRestaurant) => ({
              restaurantName: String(row.restaurantName || 'Unknown'),
              revenue: Math.max(0, Number(row.revenue) || 0),
            })
          )
        );
        setStatusDistribution(
          (Array.isArray(json.statusDistribution) ? json.statusDistribution : []).map(
            (row: StatusSlice) => ({
              status: String(row.status || 'UNKNOWN').toUpperCase(),
              count: Math.max(0, Number(row.count) || 0),
            })
          )
        );
        setOpsBreakdown(
          (Array.isArray(json.opsBreakdown) ? json.opsBreakdown : []).map(
            (row: OpsTownship) => ({
              township: String(row.township || 'Unknown'),
              prep: Math.max(0, Number(row.prep) || 0),
              wait: Math.max(0, Number(row.wait) || 0),
              travel: Math.max(0, Number(row.travel) || 0),
            })
          )
        );
        const mix = json.sentimentMix || {};
        setSentimentMix({
          positive: Math.max(0, Number(mix.positive) || 0),
          neutral: Math.max(0, Number(mix.neutral) || 0),
          negative: Math.max(0, Number(mix.negative) || 0),
        });
        setTopKeywords(
          (Array.isArray(json.topKeywords) ? json.topKeywords : []).map(
            (row: ReviewKeyword) => ({
              word: String(row.word || '').toLowerCase(),
              count: Math.max(0, Number(row.count) || 0),
            })
          ).filter((row: ReviewKeyword) => row.word)
        );
        setError('');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load analytics');
          setTopRestaurants([]);
          setStatusDistribution([]);
          setOpsBreakdown([]);
          setSentimentMix(EMPTY_SENTIMENT);
          setTopKeywords([]);
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

  const restaurantChart = topRestaurants.map((row) => ({
    ...row,
    label: truncateName(row.restaurantName),
  }));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Advanced Analytics</h2>
          <p className="text-xs text-muted-foreground">
            Revenue, status mix, operational bottlenecks, and review sentiment
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-danger/20 bg-danger/5 px-5 py-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title="Top Restaurants by Revenue"
          subtitle="Highest GMV · cancelled & rejected excluded"
          icon={BarChart3}
        >
          {loading && restaurantChart.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              Loading restaurant rankings…
            </div>
          ) : restaurantChart.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              No restaurant revenue yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={restaurantChart}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                barSize={18}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  tickFormatter={compactKyat}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={118}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 600 }}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.45 }} />
                <Bar dataKey="revenue" fill="var(--admin)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Order Status Distribution"
          subtitle="All-time order counts by kitchen / delivery status"
          icon={PieChart}
        >
          {loading && statusDistribution.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              Loading status mix…
            </div>
          ) : statusDistribution.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              No orders to chart yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={statusDistribution}
                margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                barSize={28}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="status"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 600 }}
                  tickFormatter={(value) =>
                    STATUS_TICK[String(value)] || formatStatus(String(value))
                  }
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  allowDecimals={false}
                />
                <Tooltip content={<StatusTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.45 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {statusDistribution.map((row) => (
                    <Cell
                      key={row.status}
                      fill={STATUS_FILL[row.status] || 'var(--admin)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <OpsAndSentiment
        opsBreakdown={opsBreakdown}
        sentimentMix={sentimentMix}
        topKeywords={topKeywords}
        loading={loading}
      />
    </section>
  );
}
