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

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2">
      <p className="text-xs text-zinc-400 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-white font-tabular">${payload[0].value.toFixed(2)}</p>
    </div>
  );
}

export default function EarningsChart() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-white">Weekly Earnings</p>
        <p className="text-sm font-bold text-success font-tabular">
          ${WEEKLY_DATA.reduce((s, d) => s + d.earnings, 0).toFixed(2)}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={WEEKLY_DATA} barSize={24}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 11, fontWeight: 500 }} />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="earnings" radius={[6, 6, 0, 0]}>
            {WEEKLY_DATA.map((_, index) => (
              <Cell
                key={`cell-earn-${index}`}
                fill={index === TODAY_INDEX ? 'var(--rider)' : 'rgba(99,102,241,0.3)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}