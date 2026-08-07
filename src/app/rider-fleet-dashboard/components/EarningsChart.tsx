'use client';

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

const WEEKLY_DATA = [
  { day: 'Mon', earnings: 68.40 },
  { day: 'Tue', earnings: 82.10 },
  { day: 'Wed', earnings: 54.90 },
  { day: 'Thu', earnings: 91.30 },
  { day: 'Fri', earnings: 118.60 },
  { day: 'Sat', earnings: 134.20 },
  { day: 'Sun', earnings: 47.80 },
];

const TODAY_INDEX = 6;
const WEEKLY_TOTAL = WEEKLY_DATA.reduce((s, d) => s + d.earnings, 0);

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
        ${payload[0].value.toFixed(2)}
      </p>
    </div>
  );
}

export default function EarningsChart() {
  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-900">Weekly Earnings</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Last 7 days</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold leading-none text-success font-tabular sm:text-xl">
            ${WEEKLY_TOTAL.toFixed(2)}
          </p>
          <p className="mt-1 text-[10px] font-medium text-slate-400">Total</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={WEEKLY_DATA} barSize={24} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
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
            {WEEKLY_DATA.map((_, index) => (
              <Cell
                key={`cell-earn-${index}`}
                fill={index === TODAY_INDEX ? 'var(--rider)' : 'rgba(99,102,241,0.18)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
