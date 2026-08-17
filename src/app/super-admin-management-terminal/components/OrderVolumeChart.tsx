'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatKyat } from '@/lib/currency';

export type HourlyDataPoint = {
  hour: string;
  orders: number;
  gmv: number;
};

type VolumePoint = {
  label: string;
  orders: number;
  gmv: number;
};

type VolumeRange = 'today' | '7d' | '30d' | '90d' | 'all';

const VOLUME_RANGE_OPTIONS: { key: VolumeRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
  { key: 'all', label: 'All Time' },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-muted border border-border rounded-xl px-4 py-3 card-shadow-md">
      <p className="text-xs text-muted-foreground font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <div key={`tp-${p.dataKey}`} className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground font-tabular">
            {p.dataKey === 'orders' ? `${p.value} orders` : formatKyat(Number(p.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

function hourlyFromProp(data?: HourlyDataPoint[] | null): VolumePoint[] {
  if (!Array.isArray(data) || data.length === 0) return [];
  return data.map((d) => ({
    label: d.hour,
    orders: Number(d.orders) || 0,
    gmv: Number(d.gmv) || 0,
  }));
}

export default function OrderVolumeChart({ data }: { data?: HourlyDataPoint[] | null }) {
  const [metric, setMetric] = useState<'orders' | 'gmv'>('orders');
  const [mounted, setMounted] = useState(false);
  const [todayLabel, setTodayLabel] = useState('');
  const [range, setRange] = useState<VolumeRange>('30d');
  const [points, setPoints] = useState<VolumePoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTodayLabel(
      new Date().toLocaleDateString(undefined, {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      })
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadVolume() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/order-volume?range=${encodeURIComponent(range)}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || 'Failed to load order volume');
        }
        if (!cancelled) {
          const next = Array.isArray(json.points) ? (json.points as VolumePoint[]) : [];
          setPoints(
            next.map((p) => ({
              label: String(p.label),
              orders: Number(p.orders) || 0,
              gmv: Number(p.gmv) || 0,
            }))
          );
        }
      } catch (error) {
        console.warn('Order volume load failed', error);
        if (!cancelled) {
          setPoints(range === 'today' ? hourlyFromProp(data) : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadVolume();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const chartData = useMemo(() => {
    if (points.length > 0) return points;
    if (range === 'today') return hourlyFromProp(data);
    return [];
  }, [range, data, points]);

  const subtitle = useMemo(() => {
    if (range === 'today') {
      return `Hourly breakdown — today${mounted && todayLabel ? `, ${todayLabel}` : ''}`;
    }
    if (range === '7d') return 'Daily breakdown — last 7 days';
    if (range === '30d') return 'Daily breakdown — last 30 days';
    if (range === '90d') return 'Monthly breakdown — last 90 days';
    return 'Monthly breakdown — all time';
  }, [range, mounted, todayLabel]);

  const emptyCopy =
    range === 'today'
      ? 'No order volume data for today yet'
      : range === 'all'
        ? 'No orders yet'
        : `No orders in the last ${range === '7d' ? '7' : range === '30d' ? '30' : '90'} days`;

  const xInterval = range === 'today' || range === '30d' ? 2 : 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-base text-foreground">Order Volume</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="order-volume-range">
            Date range
          </label>
          <select
            id="order-volume-range"
            value={range}
            onChange={(e) => setRange(e.target.value as VolumeRange)}
            className="input-field h-8 min-w-[8.5rem] py-1 text-xs font-semibold"
          >
            {VOLUME_RANGE_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            {(['orders', 'gmv'] as const).map((m) => (
              <button
                key={`metric-${m}`}
                type="button"
                onClick={() => setMetric(m)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${
                  metric === m ? 'bg-admin text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'orders' ? 'Orders' : 'GMV (Ks)'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-5">
        {loading && chartData.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            Loading historical volume…
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            {emptyCopy}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="adminGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--admin)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--admin)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 500 }}
                interval={xInterval}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                width={40}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey={metric}
                stroke="var(--admin)"
                strokeWidth={2}
                fill="url(#adminGradient)"
                dot={false}
                activeDot={{ r: 4, fill: 'var(--admin)', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
