'use client';

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { formatKyat } from '@/lib/currency';

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900 font-tabular">
        {formatKyat(Number(payload[0].value))}
      </p>
    </div>
  );
}

export default function EarningsChart({
  data,
  total,
  title = 'Weekly Earnings',
  subtitle = 'Last 7 days',
}: {
  data: { day: string; earnings: number }[];
  total: number;
  title?: string;
  subtitle?: string;
}) {
  const todayIndex = (new Date().getDay() + 6) % 7;
  const highlightIndex = data.length === 7 ? todayIndex : data.length - 1;
  const barSize = data.length > 10 ? 12 : data.length > 7 ? 18 : 24;

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-900">{title}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold leading-none text-success font-tabular sm:text-xl">
            {formatKyat(total)}
          </p>
          <p className="mt-1 text-[10px] font-medium text-slate-400">Total</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barSize={barSize} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="4 4" />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }}
            dy={6}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
          <Bar dataKey="earnings" radius={[8, 8, 4, 4]}>
            {data.map((_, index) => (
              <Cell
                key={`cell-earn-${index}`}
                fill={index === highlightIndex ? 'var(--rider)' : 'rgba(99,102,241,0.18)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
