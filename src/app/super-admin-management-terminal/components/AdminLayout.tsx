'use client';

import React, { Suspense, useEffect, useState } from 'react';
import {
  LayoutDashboard, ShoppingBag, Store, Bike, ChartColumn,
  Settings, LogOut, ChevronLeft, ChevronRight,
  ShieldCheck, SlidersVertical, MapPin, User, Menu, X,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import AdminKPIs from './AdminKPIs';
import OrderVolumeChart from './OrderVolumeChart';
import ApprovalQueue from './ApprovalQueue';
import CustomerList from './CustomerList';
import SystemConfig from './SystemConfig';
import AdminNotificationBell from './AdminNotificationBell';
import AdminThemeToggle from './AdminThemeToggle';
import AdminProfileMenu from './AdminProfileMenu';
import { AdminThemeProvider, useAdminTheme } from './AdminThemeContext';
import { clearSession } from '@/lib/session';

type AdminTab = 'overview' | 'orders' | 'zones' | 'customers' | 'vendors' | 'riders' | 'analytics' | 'config';

const VALID_TABS: AdminTab[] = [
  'overview', 'orders', 'zones', 'customers', 'vendors', 'riders', 'analytics', 'config',
];

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
      { key: 'anav-customers', tab: 'customers', icon: User, label: 'Customers', badge: null },
      { key: 'anav-vendors', tab: 'vendors', icon: Store, label: 'Vendors', badge: null },
      { key: 'anav-riders', tab: 'riders', icon: Bike, label: 'Riders', badge: null },
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

function pagePad(className = '') {
  return `p-4 sm:p-6 xl:p-8 max-w-screen-2xl mx-auto ${className}`.trim();
}

function AdminTabContent({ activeTab }: { activeTab: AdminTab }) {
  switch (activeTab) {
    case 'overview':
      return (
        <div className={pagePad('space-y-4 sm:space-y-6')}>
          <AdminKPIs />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
            <div className="xl:col-span-2 space-y-4 sm:space-y-6 min-w-0">
              <OrderVolumeChart />
              <ApprovalQueue />
            </div>
            <div className="xl:col-span-1 min-w-0">
              <SystemConfig />
            </div>
          </div>
        </div>
      );
    case 'orders':
      return (
        <div className={pagePad('space-y-4 sm:space-y-6')}>
          <AdminKPIs />
          <OrderVolumeChart />
        </div>
      );
    case 'zones':
      return (
        <div className={pagePad()}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 text-center">
            <MapPin className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Service Zones</h3>
            <p className="text-zinc-500 text-sm">Geofencing and service zone management.</p>
          </div>
        </div>
      );
    case 'customers':
      return (
        <div className={pagePad()}>
          <CustomerList />
        </div>
      );
    case 'vendors':
      return (
        <div className={pagePad()}>
          <ApprovalQueue typeFilter="VENDOR" />
        </div>
      );
    case 'riders':
      return (
        <div className={pagePad()}>
          <ApprovalQueue typeFilter="RIDER" />
        </div>
      );
    case 'analytics':
      return (
        <div className={pagePad('space-y-4 sm:space-y-6')}>
          <AdminKPIs />
          <OrderVolumeChart />
        </div>
      );
    case 'config':
      return (
        <div className={pagePad()}>
          <SystemConfig />
        </div>
      );
    default:
      return null;
  }
}

function AdminLayoutShell({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { isLight } = useAdminTheme();
  const [themeReady, setThemeReady] = useState(false);
  const isProfileRoute = pathname?.includes('/profile') ?? false;
  const showLabels = mobileNavOpen || !collapsed;

  useEffect(() => {
    setThemeReady(true);
  }, []);

  // Apply saved light theme only after this shell has mounted (avoids hydration mismatch).
  const shellIsLight = themeReady && isLight;

  useEffect(() => {
    const tab = searchParams.get('tab') as AdminTab | null;
    if (tab && VALID_TABS.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileNavOpen]);

  const goToTab = (tab: AdminTab) => {
    setMobileNavOpen(false);
    if (isProfileRoute) {
      router.push(`/super-admin-management-terminal?tab=${tab}`);
      return;
    }
    setActiveTab(tab);
  };

  const handleSignOut = () => {
    setMobileNavOpen(false);
    clearSession();
    router.push('/');
  };

  return (
    <div
      className={`flex min-h-screen bg-zinc-950 admin-shell ${shellIsLight ? 'admin-theme-light' : 'admin-theme-dark'}`}
    >
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] lg:hidden"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          flex flex-col bg-zinc-900 border-r border-zinc-800
          transition-all duration-300 ease-in-out
          w-72 max-w-[85vw]
          ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:max-w-none
          ${collapsed ? 'lg:w-16' : 'lg:w-64'}
          min-h-screen flex-shrink-0
        `}
      >
        <div className={`flex items-center border-b border-zinc-800 h-14 sm:h-16 px-4 ${showLabels ? 'justify-between' : 'justify-center'}`}>
          {showLabels && (
            <div className="flex items-center gap-2 min-w-0">
              <AppLogo size={28} />
              <div className="min-w-0">
                <p className="font-bold text-sm leading-tight text-white">FoodDash</p>
                <p className="text-xs text-zinc-500">Admin Terminal</p>
              </div>
            </div>
          )}
          {!showLabels && <AppLogo size={28} />}

          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors lg:hidden"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setCollapsed((p) => !p)}
            className="hidden lg:inline-flex p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto scrollbar-hide">
          {NAV_GROUPS.map((group) => (
            <div key={group.key}>
              {showLabels && (
                <p className="text-xs font-bold tracking-widest uppercase text-zinc-600 px-3 mb-1.5">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = !isProfileRoute && activeTab === item.tab;
                  return (
                    <button
                      key={item.key}
                      onClick={() => goToTab(item.tab)}
                      title={!showLabels ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-admin/15 text-admin'
                          : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
                      } ${!showLabels ? 'justify-center px-0' : ''}`}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {showLabels && (
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
            type="button"
            onClick={() => goToTab('config')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${!showLabels ? 'justify-center px-0' : ''}`}
            title={!showLabels ? 'Settings' : undefined}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            {showLabels && <span>Settings</span>}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ${!showLabels ? 'justify-center px-0' : ''}`}
            title={!showLabels ? 'Sign Out' : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {showLabels && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 w-full">
        <header className="h-14 sm:h-16 bg-zinc-900 border-b border-zinc-800 flex items-center px-3 sm:px-6 gap-2 sm:gap-4 sticky top-0 z-30">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-admin/40"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-admin flex-shrink-0" />
            <span className="text-sm font-bold text-white truncate">
              {isProfileRoute ? 'My Profile' : (
                <>
                  <span className="sm:hidden">Admin</span>
                  <span className="hidden sm:inline">Super Admin Terminal</span>
                </>
              )}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-3 min-w-0">
            <AdminThemeToggle />
            <p className="hidden md:block text-xs text-zinc-500 font-medium whitespace-nowrap">
              07/29/2026 · 16:13 UTC
            </p>
            <AdminNotificationBell />
            <AdminProfileMenu />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children ?? <AdminTabContent activeTab={activeTab} />}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children?: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
          Loading admin terminal...
        </div>
      }
    >
      <AdminThemeProvider>
        <AdminLayoutShell>{children}</AdminLayoutShell>
      </AdminThemeProvider>
    </Suspense>
  );
}
