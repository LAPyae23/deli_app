'use client';

import React, { useEffect, useState } from 'react';
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

export default function OrderVolumeChart({ data }: { data?: HourlyDataPoint[] | null }) {
  const [metric, setMetric] = useState<'orders' | 'gmv'>('orders');
  const [mounted, setMounted] = useState(false);
  const [todayLabel, setTodayLabel] = useState('');
  const chartData = Array.isArray(data) && data.length > 0 ? data : [];

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

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-base text-foreground">Order Volume</h2>
          <p className="text-xs text-muted-foreground">
            Hourly breakdown — today{mounted && todayLabel ? `, ${todayLabel}` : ''}
          </p>
        </div>
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
      <div className="p-5">
        {chartData.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No order volume data for today yet
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
                dataKey="hour"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 500 }}
                interval={2}
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
