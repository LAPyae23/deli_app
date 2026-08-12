'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Bike, Percent, Clock, TriangleAlert } from 'lucide-react';
import { formatKyat } from '@/lib/currency';

export type AdminKpiData = {
  totalGMV?: number;
  totalOrders?: number;
  cancelledOrders?: number;
  avgPrepTime?: number;
  activeRiders?: number;
};

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return formatKyat(0);
  return formatKyat(value);
}

function buildKpis(data?: AdminKpiData | null) {
  const totalGMV = Number(data?.totalGMV) || 0;
  const totalOrders = Number(data?.totalOrders) || 0;
  const cancelledOrders = Number(data?.cancelledOrders) || 0;
  const avgPrepTime = Number(data?.avgPrepTime) || 0;
  const activeRiders = Number(data?.activeRiders) || 0;
  const cancelRate =
    totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 1000) / 10 : 0;

  return [
    {
      id: 'kpi-gmv',
      label: "Today's GMV",
      value: formatCurrency(totalGMV),
      subValue: 'Gross Merchandise Value',
      trend: totalOrders > 0 ? `${totalOrders} orders` : 'No sales yet',
      trendUp: totalGMV > 0,
      icon: DollarSign,
      iconColor: 'text-success',
      iconBg: 'bg-success/10',
      featured: true,
    },
    {
      id: 'kpi-active-orders',
      label: "Today's Orders",
      value: String(totalOrders),
      subValue: 'Orders created today',
      trend: totalOrders > 0 ? 'Live' : '—',
      trendUp: totalOrders > 0,
      icon: ShoppingBag,
      iconColor: 'text-admin',
      iconBg: 'bg-admin/10',
      featured: false,
      alert: false,
    },
    {
      id: 'kpi-riders',
      label: 'Active Riders',
      value: String(activeRiders),
      subValue: 'Total registered riders',
      trend: activeRiders > 0 ? 'Active' : 'None',
      trendUp: activeRiders > 0,
      icon: Bike,
      iconColor: 'text-rider',
      iconBg: 'bg-rider/10',
      featured: false,
      alert: false,
    },
    {
      id: 'kpi-commission',
      label: 'Commission Revenue',
      value: formatCurrency(totalGMV * 0.18),
      subValue: '18% estimated of GMV',
      trend: totalGMV > 0 ? 'Est.' : '—',
      trendUp: totalGMV > 0,
      icon: Percent,
      iconColor: 'text-customer',
      iconBg: 'bg-customer/10',
      featured: false,
    },
    {
      id: 'kpi-cancel',
      label: 'Cancellation Rate',
      value: `${cancelRate}%`,
      subValue: `${cancelledOrders} cancelled / rejected`,
      trend: cancelledOrders > 0 ? `${cancelledOrders}` : '0',
      trendUp: cancelledOrders === 0,
      icon: TriangleAlert,
      iconColor: 'text-danger',
      iconBg: 'bg-danger/10',
      featured: false,
      alert: cancelledOrders > 0,
    },
    {
      id: 'kpi-delivery-time',
      label: 'Avg Prep Time',
      value: avgPrepTime > 0 ? `${avgPrepTime} min` : '—',
      subValue: 'From today’s orders',
      trend: avgPrepTime > 0 ? 'Live' : '—',
      trendUp: avgPrepTime > 0 && avgPrepTime <= 35,
      icon: Clock,
      iconColor: 'text-warning',
      iconBg: 'bg-warning/10',
      featured: false,
    },
  ];
}

export default function AdminKPIs({ data }: { data?: AdminKpiData | null }) {
  const kpis = buildKpis(data);
  const [mounted, setMounted] = useState(false);
  const [updatedAt, setUpdatedAt] = useState('');

  useEffect(() => {
    setMounted(true);
    setUpdatedAt(new Date().toLocaleTimeString());
    const interval = setInterval(() => {
      setUpdatedAt(new Date().toLocaleTimeString());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-foreground">Platform Overview</h1>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success status-pulse" />
          <span className="text-xs text-muted-foreground font-medium">
            Live{mounted && updatedAt ? ` · Updated ${updatedAt}` : ''}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6 2xl:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.id}
            className={`rounded-xl p-4 border transition-all ${
              kpi.alert
                ? 'bg-danger/5 border-danger/20'
                : kpi.featured
                  ? 'bg-success/5 border-success/20'
                  : 'bg-card border-border'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
                <kpi.icon className={`w-4 h-4 ${kpi.iconColor}`} />
              </div>
              <span
                className={`flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  kpi.trendUp ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                }`}
              >
                {kpi.trendUp ? (
                  <TrendingUp className="w-2.5 h-2.5" />
                ) : (
                  <TrendingDown className="w-2.5 h-2.5" />
                )}
                {kpi.trend}
              </span>
            </div>
            <p className="text-xl font-bold text-foreground font-tabular leading-tight mb-0.5">
              {kpi.value}
            </p>
            <p className="text-xs font-semibold text-muted-foreground mb-0.5">{kpi.label}</p>
            <p className="text-xs text-muted-foreground leading-tight">{kpi.subValue}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
