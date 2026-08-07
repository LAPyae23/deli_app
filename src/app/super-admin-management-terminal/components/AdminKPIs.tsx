'use client';

import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Bike, Percent, Clock, TriangleAlert } from 'lucide-react';

const KPIS = [
  {
    id: 'kpi-gmv',
    label: "Today\'s GMV",
    value: '$84,247',
    subValue: 'Gross Merchandise Value',
    trend: '+18.3%',
    trendUp: true,
    icon: DollarSign,
    iconColor: 'text-success',
    iconBg: 'bg-success/10',
    featured: true,
  },
  {
    id: 'kpi-active-orders',
    label: 'Active Orders',
    value: '142',
    subValue: '23 awaiting rider',
    trend: '+12',
    trendUp: true,
    icon: ShoppingBag,
    iconColor: 'text-admin',
    iconBg: 'bg-admin/10',
    featured: false,
    alert: true,
  },
  {
    id: 'kpi-riders',
    label: 'Active Riders',
    value: '87',
    subValue: '34 on delivery · 53 available',
    trend: '-6 vs yesterday',
    trendUp: false,
    icon: Bike,
    iconColor: 'text-rider',
    iconBg: 'bg-rider/10',
    featured: false,
    alert: false,
  },
  {
    id: 'kpi-commission',
    label: 'Commission Revenue',
    value: '$15,164',
    subValue: '18% avg rate today',
    trend: '+21.1%',
    trendUp: true,
    icon: Percent,
    iconColor: 'text-customer',
    iconBg: 'bg-customer/10',
    featured: false,
  },
  {
    id: 'kpi-cancel',
    label: 'Cancellation Rate',
    value: '4.2%',
    subValue: '67 cancelled orders',
    trend: '+0.8%',
    trendUp: false,
    icon: TriangleAlert,
    iconColor: 'text-danger',
    iconBg: 'bg-danger/10',
    featured: false,
    alert: true,
  },
  {
    id: 'kpi-delivery-time',
    label: 'Avg Delivery Time',
    value: '31 min',
    subValue: 'Target: 35 min ✓',
    trend: '-4 min',
    trendUp: true,
    icon: Clock,
    iconColor: 'text-warning',
    iconBg: 'bg-warning/10',
    featured: false,
  },
];

export default function AdminKPIs() {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h1 className="text-lg sm:text-xl font-bold text-white">Platform Overview</h1>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success status-pulse" />
          <span className="text-xs text-zinc-400 font-medium">Live · Updated 16:13:54</span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {KPIS?.map((kpi) => (
          <div
            key={kpi?.id}
            className={`rounded-xl p-3.5 sm:p-4 border transition-all min-w-0 ${
              kpi?.alert
                ? 'bg-danger/5 border-danger/20'
                : kpi?.featured
                ? 'bg-success/5 border-success/20' :'bg-zinc-900 border-zinc-800'
            }`}
          >
            <div className="flex items-start justify-between mb-3 gap-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${kpi?.iconBg}`}>
                <kpi.icon className={`w-4 h-4 ${kpi?.iconColor}`} />
              </div>
              <span className={`flex items-center gap-0.5 text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${kpi?.trendUp ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                {kpi?.trendUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {kpi?.trend}
              </span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-white font-tabular leading-tight mb-0.5">{kpi?.value}</p>
            <p className="text-xs font-semibold text-zinc-400 mb-0.5">{kpi?.label}</p>
            <p className="text-xs text-zinc-600 leading-tight line-clamp-2">{kpi?.subValue}</p>
          </div>
        ))}
      </div>
    </div>
  );
}