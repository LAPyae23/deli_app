'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard, ClipboardList, UtensilsCrossed, ChartColumn,
  Settings, LogOut, ChevronLeft, ChevronRight, Bell, Store,
  TriangleAlert,
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import AppImage from '@/components/ui/AppImage';
import StoreStatusSwitcher from './StoreStatusSwitcher';
import OrderQueue from './OrderQueue';
import MenuManagement from './MenuManagement';
import RevenueKPIs from './RevenueKPIs';

type RestaurantTab = 'dashboard' | 'orders' | 'menu' | 'analytics';

const NAV_ITEMS: { key: string; tab: RestaurantTab; icon: React.ElementType; label: string; badge: string | null }[] = [
  { key: 'rnav-dashboard', tab: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', badge: null },
  { key: 'rnav-orders', tab: 'orders', icon: ClipboardList, label: 'Orders', badge: '4' },
  { key: 'rnav-menu', tab: 'menu', icon: UtensilsCrossed, label: 'Menu', badge: null },
  { key: 'rnav-analytics', tab: 'analytics', icon: ChartColumn, label: 'Analytics', badge: null },
];

function RestaurantTabContent({ activeTab }: { activeTab: RestaurantTab }) {
  switch (activeTab) {
    case 'dashboard':
      return (
        <div className="p-6 xl:p-8 space-y-6 max-w-screen-2xl mx-auto">
          <RevenueKPIs />
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-2"><OrderQueue /></div>
            <div className="xl:col-span-3"><MenuManagement /></div>
          </div>
        </div>
      );
    case 'orders':
      return (
        <div className="p-6 xl:p-8 max-w-screen-2xl mx-auto">
          <OrderQueue />
        </div>
      );
    case 'menu':
      return (
        <div className="p-6 xl:p-8 max-w-screen-2xl mx-auto">
          <MenuManagement />
        </div>
      );
    case 'analytics':
      return (
        <div className="p-6 xl:p-8 max-w-screen-2xl mx-auto">
          <RevenueKPIs />
        </div>
      );
    default:
      return null;
  }
}

export default function RestaurantLayout() {
  const [activeTab, setActiveTab] = useState<RestaurantTab>('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={`flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-60'} min-h-screen relative flex-shrink-0`}>
        <div className={`flex items-center border-b border-border h-16 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <AppLogo size={28} />
              <div>
                <p className="font-bold text-sm leading-tight">Burger Bliss</p>
                <p className="text-xs text-muted-foreground">Restaurant Portal</p>
              </div>
            </div>
          )}
          {collapsed && <AppLogo size={28} />}
          <button
            onClick={() => setCollapsed(p => !p)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="px-3 py-3 border-b border-border">
            <StoreStatusSwitcher collapsed={false} />
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
          {!collapsed && <p className="section-label px-3 mb-2 mt-1">Operations</p>}
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.tab)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive ? 'nav-item-active bg-teal-50 text-restaurant' : 'nav-item'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className="min-w-[20px] h-5 flex items-center justify-center bg-restaurant text-white text-xs font-bold rounded-full px-1.5">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium nav-item ${collapsed ? 'justify-center px-0' : ''}`}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Settings</span>}
          </button>
          <a
            href="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium nav-item ${collapsed ? 'justify-center px-0' : ''}`}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </a>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center px-6 gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-2 text-sm">
            <Store className="w-4 h-4 text-restaurant" />
            <span className="font-bold text-foreground">Burger Bliss</span>
            <span className="text-muted-foreground">· 145 Broadway Ave, Manhattan</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-warning/10 text-warning rounded-lg text-xs font-semibold">
              <TriangleAlert className="w-3.5 h-3.5" />
              4 new orders
            </div>
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
            </button>
            <div className="flex items-center gap-2">
              <AppImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=restaurant" alt="Restaurant owner avatar" width={32} height={32} className="rounded-full bg-muted" />
              <div className="hidden md:block">
                <p className="text-sm font-semibold leading-tight">James Park</p>
                <p className="text-xs text-muted-foreground leading-tight">Owner</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <RestaurantTabContent activeTab={activeTab} />
        </main>
      </div>
    </div>
  );
}