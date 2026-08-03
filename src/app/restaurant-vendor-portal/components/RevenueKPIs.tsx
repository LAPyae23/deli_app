'use client';

import React from 'react';
import { TrendingUp, TrendingDown, ShoppingBag, DollarSign, Percent, Clock } from 'lucide-react';

const KPIS = [
  {
    id: 'kpi-revenue',
    label: "Today\'s Revenue",
    value: '$2,847',
    subValue: 'Net: $2,334 after 18% commission',
    trend: '+12.4%',
    trendUp: true,
    icon: DollarSign,
    iconBg: 'bg-teal-50',
    iconColor: 'text-restaurant',
  },
  {
    id: 'kpi-orders',
    label: 'Orders Completed',
    value: '47',
    subValue: '3 cancelled today',
    trend: '+8.2%',
    trendUp: true,
    icon: ShoppingBag,
    iconBg: 'bg-blue-50',
    iconColor: 'text-info',
  },
  {
    id: 'kpi-acceptance',
    label: 'Acceptance Rate',
    value: '94.3%',
    subValue: '3 rejected orders',
    trend: '-1.2%',
    trendUp: false,
    icon: Percent,
    iconBg: 'bg-orange-50',
    iconColor: 'text-customer',
  },
  {
    id: 'kpi-preptime',
    label: 'Avg Prep Time',
    value: '22 min',
    subValue: 'Target: 25 min',
    trend: '-3 min',
    trendUp: true,
    icon: Clock,
    iconBg: 'bg-violet-50',
    iconColor: 'text-admin',
  },
];

export default function RevenueKPIs() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">07/29/2026 · Updated just now</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS?.map((kpi) => (
          <div key={kpi?.id} className="metric-card">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi?.iconBg}`}>
                <kpi.icon className={`w-5 h-5 ${kpi?.iconColor}`} />
              </div>
              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${kpi?.trendUp ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                {kpi?.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {kpi?.trend}
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground font-tabular mb-0.5">{kpi?.value}</p>
            <p className="section-label mb-0.5">{kpi?.label}</p>
            <p className="text-xs text-muted-foreground">{kpi?.subValue}</p>
          </div>
        ))}
      </div>
    </div>
  );
}