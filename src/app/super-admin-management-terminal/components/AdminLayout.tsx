'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard, ShoppingBag, Store, Bike, ChartColumn,
  Settings, LogOut, ChevronLeft, ChevronRight, Bell,
  ShieldCheck, SlidersVertical, MapPin, TriangleAlert,
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import AppImage from '@/components/ui/AppImage';
import AdminKPIs from './AdminKPIs';
import OrderVolumeChart from './OrderVolumeChart';
import ApprovalQueue from './ApprovalQueue';
import SystemConfig from './SystemConfig';

type AdminTab = 'overview' | 'orders' | 'zones' | 'vendors' | 'riders' | 'analytics' | 'config';

const NAV_GROUPS: {
  key: string;
  label: string;
  items: { key: string; tab: AdminTab; icon: React.ElementType; label: string; badge: string | null }[];
}[] = [
  {
    key: 'navg-ops',
    label: 'Operations',
    items: [
      { key: 'anav-dashboard', tab: 'overview', icon: LayoutDashboard, label: 'Overview', badge: null },
      { key: 'anav-orders', tab: 'orders', icon: ShoppingBag, label: 'Orders', badge: '142' },
      { key: 'anav-zones', tab: 'zones', icon: MapPin, label: 'Service Zones', badge: null },
    ],
  },
  {
    key: 'navg-people',
    label: 'People',
    items: [
      { key: 'anav-vendors', tab: 'vendors', icon: Store, label: 'Vendors', badge: '7' },
      { key: 'anav-riders', tab: 'riders', icon: Bike, label: 'Riders', badge: '3' },
    ],
  },
  {
    key: 'navg-system',
    label: 'System',
    items: [
      { key: 'anav-analytics', tab: 'analytics', icon: ChartColumn, label: 'Analytics', badge: null },
      { key: 'anav-config', tab: 'config', icon: SlidersVertical, label: 'Configuration', badge: null },
    ],
  },
];

function AdminTabContent({ activeTab }: { activeTab: AdminTab }) {
  switch (activeTab) {
    case 'overview':
      return (
        <div className="p-6 xl:p-8 space-y-6 max-w-screen-2xl mx-auto">
          <AdminKPIs />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <OrderVolumeChart />
              <ApprovalQueue />
            </div>
            <div className="xl:col-span-1">
              <SystemConfig />
            </div>
          </div>
        </div>
      );
    case 'orders':
      return (
        <div className="p-6 xl:p-8 max-w-screen-2xl mx-auto space-y-6">
          <AdminKPIs />
          <OrderVolumeChart />
        </div>
      );
    case 'zones':
      return (
        <div className="p-6 xl:p-8 max-w-screen-2xl mx-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <MapPin className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Service Zones</h3>
            <p className="text-zinc-500 text-sm">Geofencing and service zone management.</p>
          </div>
        </div>
      );
    case 'vendors':
      return (
        <div className="p-6 xl:p-8 max-w-screen-2xl mx-auto">
          <ApprovalQueue />
        </div>
      );
    case 'riders':
      return (
        <div className="p-6 xl:p-8 max-w-screen-2xl mx-auto">
          <ApprovalQueue />
        </div>
      );
    case 'analytics':
      return (
        <div className="p-6 xl:p-8 max-w-screen-2xl mx-auto space-y-6">
          <AdminKPIs />
          <OrderVolumeChart />
        </div>
      );
    case 'config':
      return (
        <div className="p-6 xl:p-8 max-w-screen-2xl mx-auto">
          <SystemConfig />
        </div>
      );
    default:
      return null;
  }
}

export default function AdminLayout() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <aside className={`flex flex-col bg-zinc-900 border-r border-zinc-800 transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'} min-h-screen flex-shrink-0`}>
        <div className={`flex items-center border-b border-zinc-800 h-16 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <AppLogo size={28} />
              <div>
                <p className="font-bold text-sm leading-tight text-white">FoodDash</p>
                <p className="text-xs text-zinc-500">Admin Terminal</p>
              </div>
            </div>
          )}
          {collapsed && <AppLogo size={28} />}
          <button
            onClick={() => setCollapsed(p => !p)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto scrollbar-hide">
          {NAV_GROUPS.map((group) => (
            <div key={group.key}>
              {!collapsed && (
                <p className="text-xs font-bold tracking-widest uppercase text-zinc-600 px-3 mb-1.5">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeTab === item.tab;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveTab(item.tab)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-admin/15 text-admin' :'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
                      } ${collapsed ? 'justify-center px-0' : ''}`}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <span className="min-w-[20px] h-5 flex items-center justify-center bg-admin/20 text-admin text-xs font-bold rounded-full px-1.5">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-zinc-800 space-y-0.5">
          <button
            onClick={() => setActiveTab('config')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${collapsed ? 'justify-center px-0' : ''}`}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Settings</span>}
          </button>
          <a
            href="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${collapsed ? 'justify-center px-0' : ''}`}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </a>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center px-6 gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-admin" />
            <span className="text-sm font-bold text-white">Super Admin Terminal</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-danger/10 border border-danger/20 rounded-lg">
            <TriangleAlert className="w-3.5 h-3.5 text-danger" />
            <span className="text-xs font-semibold text-danger">10 pending approvals</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <p className="text-xs text-zinc-500 font-medium">07/29/2026 · 16:13 UTC</p>
            <button className="relative p-2 rounded-lg hover:bg-zinc-800 transition-colors">
              <Bell className="w-5 h-5 text-zinc-400" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
            </button>
            <div className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800 rounded-lg px-2 py-1.5 transition-colors">
              <AppImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin" alt="Admin user avatar illustration" width={32} height={32} className="rounded-full bg-zinc-700" />
              <div className="hidden md:block">
                <p className="text-sm font-semibold leading-tight text-white">Ops Admin</p>
                <p className="text-xs text-zinc-500 leading-tight">Super Admin</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <AdminTabContent activeTab={activeTab} />
        </main>
      </div>
    </div>
  );
}