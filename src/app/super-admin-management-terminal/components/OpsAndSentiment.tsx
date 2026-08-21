'use client';

import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Clock, MessageSquareQuote } from 'lucide-react';

export type OpsTownship = {
  township: string;
  prep: number;
  wait: number;
  travel: number;
};

export type SentimentMix = {
  positive: number;
  neutral: number;
  negative: number;
};

export type ReviewKeyword = {
  word: string;
  count: number;
};

const PREP_FILL = 'var(--warning)';
const WAIT_FILL = 'var(--danger)';
const TRAVEL_FILL = 'var(--rider)';

const SENTIMENT_META = [
  { key: 'positive' as const, name: 'Positive', color: 'var(--success)' },
  { key: 'neutral' as const, name: 'Neutral', color: 'var(--warning)' },
  { key: 'negative' as const, name: 'Negative', color: 'var(--danger)' },
];

function truncateName(name: string, max = 14) {
  const value = String(name || 'Unknown').trim() || 'Unknown';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
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

function OpsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const township = String(
    (payload[0] as { payload?: { township?: string } })?.payload?.township || ''
  );
  return (
    <div className="rounded-xl border border-border bg-muted px-4 py-3 card-shadow-md">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{township}</p>
      {payload.map((row) => (
        <p key={row.name} className="text-xs font-semibold text-foreground">
          <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: row.color }} />
          {row.name}:{' '}
          <span className="font-tabular">{Number(row.value || 0).toFixed(1)} min</span>
        </p>
      ))}
    </div>
  );
}

function SentimentTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
}) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-xl border border-border bg-muted px-4 py-3 card-shadow-md">
      <p className="text-xs font-semibold text-muted-foreground">{payload[0].name}</p>
      <p className="text-sm font-bold font-tabular text-foreground">
        {Number(payload[0].value || 0).toLocaleString()} reviews
      </p>
    </div>
  );
}

export default function OpsAndSentiment({
  opsBreakdown,
  sentimentMix,
  topKeywords,
  loading = false,
}: {
  opsBreakdown: OpsTownship[];
  sentimentMix: SentimentMix;
  topKeywords: ReviewKeyword[];
  loading?: boolean;
}) {
  const opsChart = opsBreakdown.map((row) => ({
    ...row,
    label: truncateName(row.township),
  }));

  const sentimentSlices = SENTIMENT_META.map((item) => ({
    name: item.name,
    value: Math.max(0, Number(sentimentMix[item.key]) || 0),
    color: item.color,
  }));
  const sentimentTotal = sentimentSlices.reduce((sum, row) => sum + row.value, 0);
  const pieSlices = sentimentSlices.filter((row) => row.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title="Operational Bottlenecks"
          subtitle="Avg prep vs wait vs travel by township (minutes)"
          icon={Clock}
        >
          {loading && opsChart.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              Loading bottleneck times…
            </div>
          ) : opsChart.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              No operational timing data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={opsChart}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 4, bottom: 8 }}
                barSize={16}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  unit="m"
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={110}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 600 }}
                />
                <Tooltip content={<OpsTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.45 }} />
                <Legend
                  verticalAlign="bottom"
                  height={28}
                  formatter={(value) => (
                    <span className="text-xs text-foreground/80">{value}</span>
                  )}
                />
                <Bar dataKey="prep" stackId="ops" name="Prep Time" fill={PREP_FILL} />
                <Bar dataKey="wait" stackId="ops" name="Wait Time" fill={WAIT_FILL} />
                <Bar
                  dataKey="travel"
                  stackId="ops"
                  name="Travel Time"
                  fill={TRAVEL_FILL}
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Review Sentiment Analysis"
          subtitle="Positive (4–5) · Neutral (3) · Negative (1–2)"
          icon={MessageSquareQuote}
        >
          {loading && sentimentTotal === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              Loading review sentiment…
            </div>
          ) : sentimentTotal === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              No rated reviews yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieSlices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="46%"
                  innerRadius={52}
                  outerRadius={84}
                  paddingAngle={3}
                >
                  {pieSlices.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip content={<SentimentTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => (
                    <span className="text-xs text-foreground/80">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Top review keywords</h3>
            <p className="text-xs text-muted-foreground">
              Most frequent words in customer reviews (stop words excluded)
            </p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-admin/10">
            <MessageSquareQuote className="h-4 w-4 text-admin" />
          </span>
        </div>
        <div className="p-5">
          {loading && topKeywords.length === 0 ? (
            <p className="text-sm text-muted-foreground">Scanning review text…</p>
          ) : topKeywords.length === 0 ? (
            <p className="text-sm text-muted-foreground">No review keywords yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topKeywords.map((item) => (
                <span
                  key={item.word}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground"
                >
                  {item.word}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 font-tabular text-[10px] text-muted-foreground">
                    {item.count}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
