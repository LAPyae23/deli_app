'use client';

import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAdminTheme } from './AdminThemeContext';

const HOURLY_DATA = [
  { hour: '06:00', orders: 12, gmv: 420 },
  { hour: '07:00', orders: 28, gmv: 980 },
  { hour: '08:00', orders: 45, gmv: 1575 },
  { hour: '09:00', orders: 31, gmv: 1085 },
  { hour: '10:00', orders: 22, gmv: 770 },
  { hour: '11:00', orders: 38, gmv: 1330 },
  { hour: '12:00', orders: 124, gmv: 4340 },
  { hour: '13:00', orders: 147, gmv: 5145 },
  { hour: '14:00', orders: 89, gmv: 3115 },
  { hour: '15:00', orders: 63, gmv: 2205 },
  { hour: '16:00', orders: 71, gmv: 2485 },
  { hour: '17:00', orders: 98, gmv: 3430 },
  { hour: '18:00', orders: 156, gmv: 5460 },
  { hour: '19:00', orders: 142, gmv: 4970 },
  { hour: '20:00', orders: 118, gmv: 4130 },
  { hour: '21:00', orders: 84, gmv: 2940 },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 card-shadow-md">
      <p className="text-xs text-zinc-400 font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <div key={`tp-${p.dataKey}`} className="flex items-center gap-2">
          <span className="text-sm font-bold text-white font-tabular">
            {p.dataKey === 'orders' ? `${p.value} orders` : `$${p.value.toLocaleString()}`}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function OrderVolumeChart() {
  const [metric, setMetric] = useState<'orders' | 'gmv'>('orders');
  const { isLight } = useAdminTheme();
  const axisFill = isLight ? '#71717a' : '#52525B';
  const gridStroke = isLight ? 'rgba(24,24,27,0.08)' : 'rgba(255,255,255,0.04)';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-base text-white">Order Volume</h2>
          <p className="text-xs text-zinc-500">Hourly breakdown — today, 07/29/2026</p>
        </div>
        <div className="flex bg-zinc-800 rounded-lg p-1 gap-1">
          {(['orders', 'gmv'] as const).map((m) => (
            <button
              key={`metric-${m}`}
              onClick={() => setMetric(m)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${metric === m ? 'bg-admin text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              {m === 'orders' ? 'Orders' : 'GMV ($)'}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={HOURLY_DATA} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="adminGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--admin)" stopOpacity={isLight ? 0.25 : 0.35} />
                <stop offset="100%" stopColor="var(--admin)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="hour"
              axisLine={false}
              tickLine={false}
              tick={{ fill: axisFill, fontSize: 10, fontWeight: 500 }}
              interval={2}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: axisFill, fontSize: 10 }}
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
      </div>
    </div>
  );
}
