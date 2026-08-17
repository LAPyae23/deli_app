'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, ShoppingBag, DollarSign, Percent, Clock } from 'lucide-react';
import { formatKyat } from '@/lib/currency';
import {
  dashboardPeriodLabel,
  dashboardSummaryTitle,
  type DashboardRange,
} from '@/lib/dashboardRange';
import DashboardRangeToggle from '@/components/DashboardRangeToggle';

export default function RevenueKPIs() {
  const [stats, setStats] = useState<any>(null);
  const [updatedAt, setUpdatedAt] = useState('');
  const [statsRange, setStatsRange] = useState<DashboardRange>('7d');
  const periodLabel = dashboardPeriodLabel(statsRange);
  const summaryTitle = dashboardSummaryTitle(statsRange);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const restaurantName = localStorage.getItem('fooddash_session_name') || '';
        const restaurantId = localStorage.getItem('fooddash_session_id') || '';

        if (!restaurantName && !restaurantId) return;

        const params = new URLSearchParams();
        if (restaurantName) params.set('restaurantName', restaurantName);
        if (restaurantId) params.set('restaurantId', restaurantId);
        params.set('range', statsRange);

        const res = await fetch(`/api/restaurant/stats?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load');
        if (!cancelled) {
          setStats(data.weeklyStats || data.stats);
          setUpdatedAt(new Date().toLocaleTimeString());
        }
      } catch (error) {
        console.error('Failed to load restaurant stats', error);
      }
    }

    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [statsRange]);

  const kpis = useMemo(() => {
    const revenue = Number(stats?.revenue) || 0;
    const periodLower = periodLabel.toLowerCase();

    return [
      {
        id: 'kpi-revenue',
        label: `Net Revenue ${periodLabel}`,
        value: formatKyat(revenue),
        subValue: 'After commission deducted',
        trend: revenue > 0 ? 'Live' : '—',
        trendUp: revenue > 0,
        icon: DollarSign,
        iconBg: 'bg-teal-50',
        iconColor: 'text-restaurant',
      },
      {
        id: 'kpi-orders',
        label: `Orders ${periodLabel}`,
        value: String(stats?.completedOrders || 0),
        subValue: `${stats?.totalOrders || 0} total ${periodLower}`,
        trend: (stats?.completedOrders || 0) > 0 ? 'Live' : '—',
        trendUp: (stats?.completedOrders || 0) > 0,
        icon: ShoppingBag,
        iconBg: 'bg-blue-50',
        iconColor: 'text-info',
      },
      {
        id: 'kpi-acceptance',
        label: 'Acceptance Rate',
        value: `${stats?.acceptanceRate ?? 100}%`,
        subValue: `${stats?.rejectedOrders || 0} rejected orders`,
        trend: (stats?.rejectedOrders || 0) === 0 ? 'Good' : 'Watch',
        trendUp: (stats?.rejectedOrders || 0) === 0,
        icon: Percent,
        iconBg: 'bg-orange-50',
        iconColor: 'text-customer',
      },
      {
        id: 'kpi-preptime',
        label: 'Avg Prep Time',
        value: `${stats?.avgPrepTime || 0} min`,
        subValue: 'Target: 25 min',
        trend:
          (stats?.avgPrepTime || 0) > 0 && (stats?.avgPrepTime || 0) <= 25 ? 'On target' : '—',
        trendUp: (stats?.avgPrepTime || 0) > 0 && (stats?.avgPrepTime || 0) <= 25,
        icon: Clock,
        iconBg: 'bg-violet-50',
        iconColor: 'text-admin',
      },
    ];
  }, [stats, periodLabel]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">{summaryTitle}</h1>
        <div className="flex items-center gap-3">
          <DashboardRangeToggle value={statsRange} onChange={setStatsRange} />
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            {updatedAt ? `Updated ${updatedAt}` : 'Loading…'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.id} className="metric-card">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
                <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
              </div>
              <span
                className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                  kpi.trendUp ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                }`}
              >
                {kpi.trendUp ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {kpi.trend}
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground font-tabular mb-0.5">{kpi.value}</p>
            <p className="section-label mb-0.5">{kpi.label}</p>
            <p className="text-xs text-muted-foreground">{kpi.subValue}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
