'use client';

import React from 'react';
import {
  DASHBOARD_RANGES,
  type DashboardRange,
} from '@/lib/dashboardRange';

export default function DashboardRangeToggle({
  value,
  onChange,
  className = '',
}: {
  value: DashboardRange;
  onChange: (range: DashboardRange) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex rounded-lg border border-border bg-muted/60 p-0.5 ${className}`}
      role="group"
      aria-label="Date range"
    >
      {DASHBOARD_RANGES.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={selected}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
              selected
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
