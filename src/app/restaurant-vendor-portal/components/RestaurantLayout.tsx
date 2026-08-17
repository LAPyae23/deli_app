'use client';

import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard, ClipboardList, UtensilsCrossed,
  Settings, LogOut, ChevronLeft, ChevronRight, Store,
  TriangleAlert,
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationBell, { type BellNotificationItem } from '@/components/NotificationBell';
import StoreStatusSwitcher from './StoreStatusSwitcher';
import OrderQueue from './OrderQueue';
import MenuManagement from './MenuManagement';
import RevenueKPIs from './RevenueKPIs';
import KitchenInsights from './KitchenInsights';
import RestaurantProfile from './RestaurantProfile';

type RestaurantTab = 'dashboard' | 'orders' | 'menu' | 'profile';

const BASE_NAV_ITEMS: {
  key: string;
  tab: RestaurantTab;
  icon: React.ElementType;
  label: string;
}[] = [
  { key: 'rnav-dashboard', tab: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { key: 'rnav-orders', tab: 'orders', icon: ClipboardList, label: 'Orders' },
  { key: 'rnav-menu', tab: 'menu', icon: UtensilsCrossed, label: 'Menu' },
  { key: 'rnav-profile', tab: 'profile', icon: Store, label: 'Profile' },
];

type HeaderProfile = {
  restaurantName: string;
  address: string;
  logoImage: string;
};

const DEFAULT_HEADER: HeaderProfile = {
  restaurantName: '',
  address: '',
  logoImage: '',
};

const FALLBACK_LOGO = '/assets/images/no_image.png';

function SafeLogoImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className: string;
}) {
  const safeSrc =
    typeof src === 'string' && src.trim() ? src.trim() : FALLBACK_LOGO;
  const isData = safeSrc.startsWith('data:');

  if (!src?.trim()) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={isData ? safeSrc.slice(0, 64) : safeSrc}
      src={safeSrc}
      alt={alt || 'Restaurant logo'}
      className={className}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = FALLBACK_LOGO;
      }}
    />
  );
}

function RestaurantTabContent({ activeTab }: { activeTab: RestaurantTab }) {
  switch (activeTab) {
    case 'dashboard':
      return (
        <div className="mx-auto max-w-screen-2xl p-6 xl:p-8">
          <RevenueKPIs />
          <KitchenInsights />
        </div>
      );
    case 'orders':
      return (
        <div className="mx-auto max-w-screen-2xl p-6 xl:p-8">
          <OrderQueue />
        </div>
      );
    case 'menu':
      return (
        <div className="mx-auto max-w-screen-2xl p-6 xl:p-8">
          <MenuManagement />
        </div>
      );
    case 'profile':
      return (
        <div className="p-6 xl:p-8">
          <RestaurantProfile />
        </div>
      );
    default:
      return null;
  }
}

export default function RestaurantLayout() {
  const [activeTab, setActiveTab] = useState<RestaurantTab>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [headerProfile, setHeaderProfile] = useState<HeaderProfile>(DEFAULT_HEADER);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  const [orderNotifications, setOrderNotifications] = useState<BellNotificationItem[]>([]);

  useEffect(() => {
    const role = localStorage.getItem('fooddash_session_role');
    if (role !== 'RESTAURANT') {
      window.location.href = '/';
    }
  }, []);

  useEffect(() => {
    function onProfileUpdated(event: Event) {
      const detail = (event as CustomEvent<Partial<HeaderProfile>>).detail || {};
      setHeaderProfile((prev) => ({
        restaurantName: detail.restaurantName?.trim() || prev.restaurantName,
        address: detail.address ?? prev.address,
        logoImage: detail.logoImage ?? prev.logoImage,
      }));
    }

    window.addEventListener('fooddash:restaurant-profile-updated', onProfileUpdated);
    return () => {
      window.removeEventListener('fooddash:restaurant-profile-updated', onProfileUpdated);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPendingOrders() {
      try {
        const restaurantId = localStorage.getItem('fooddash_session_id') || '';
        const restaurantName =
          localStorage.getItem('fooddash_session_name') ||
          headerProfile.restaurantName ||
          '';

        const params = new URLSearchParams();
        if (restaurantId) params.set('restaurantId', restaurantId);
        else if (restaurantName) params.set('restaurantName', restaurantName);
        else return;
        params.set('status', 'PENDING');
        params.set('limit', '20');

        const res = await fetch(`/api/orders?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || !data.success || cancelled) return;
        const orders = Array.isArray(data.orders) ? data.orders : [];
        const pending = orders.filter(
          (o: { status?: string }) => String(o.status || '').toUpperCase() === 'PENDING'
        );
        setPendingOrderCount(pending.length);
        setOrderNotifications(
          pending.slice(0, 8).map(
            (o: {
              _id?: string;
              id?: string;
              orderNumber?: string;
              customerName?: string;
              items?: unknown[];
            }) => ({
              id: String(o._id || o.id || o.orderNumber),
              title: `New order ${o.orderNumber || ''}`.trim(),
              body: o.customerName
                ? `${o.customerName}${Array.isArray(o.items) ? ` · ${o.items.length} items` : ''}`
                : 'Incoming order awaiting acceptance',
              onClick: () => setActiveTab('orders'),
            })
          )
        );
      } catch (error) {
        console.warn('Failed to load pending order count', error);
      }
    }

    loadPendingOrders();
    const interval = setInterval(loadPendingOrders, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [headerProfile.restaurantName]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const restaurantId = localStorage.getItem('fooddash_session_id') || '';
        const sessionName = localStorage.getItem('fooddash_session_name') || '';
        const sessionEmail = localStorage.getItem('fooddash_session_email') || '';

        if (!restaurantId) {
          if (!cancelled) {
            setHeaderProfile({
              restaurantName: sessionName || sessionEmail || 'Your Restaurant',
              address: '',
              logoImage: '',
            });
          }
          return;
        }

        const res = await fetch(
          `/api/restaurant/profile?restaurantId=${encodeURIComponent(restaurantId)}`
        );
        const data = await res.json();
        if (!res.ok || !data.success || cancelled) return;

        if (data.profile) {
          const p = data.profile;
          const name = p.restaurantName || sessionName || sessionEmail || 'Your Restaurant';
          setHeaderProfile({
            restaurantName: name,
            address: p.address || '',
            logoImage: p.logoImage || '',
          });
          if (p.restaurantName) {
            localStorage.setItem('fooddash_session_name', p.restaurantName);
          }
        } else {
          setHeaderProfile({
            restaurantName: sessionName || sessionEmail || 'Your Restaurant',
            address: '',
            logoImage: '',
          });
        }
      } catch (error) {
        console.warn('Failed to load restaurant profile for header', error);
      }
    }

    loadProfile();

    // Refresh header when returning to portal tabs after profile edits
    const onFocus = () => loadProfile();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [activeTab]);

  const navItems = BASE_NAV_ITEMS.map((item) => ({
    ...item,
    badge:
      item.tab === 'orders' && pendingOrderCount > 0 ? String(pendingOrderCount) : null,
  }));

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={`relative flex min-h-screen flex-shrink-0 flex-col border-r border-border bg-card transition-all duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div
          className={`flex h-16 items-center border-b border-border px-4 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {!collapsed && (
            <div className="flex min-w-0 items-center gap-2">
              {headerProfile.logoImage?.trim() ? (
                <SafeLogoImage
                  src={headerProfile.logoImage}
                  alt={headerProfile.restaurantName || 'Restaurant'}
                  className="h-7 w-7 flex-shrink-0 rounded-lg object-cover"
                />
              ) : (
                <AppLogo size={28} />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-tight">{headerProfile.restaurantName}</p>
                <p className="text-xs text-muted-foreground">Restaurant Portal</p>
              </div>
            </div>
          )}
          {collapsed &&
            (headerProfile.logoImage?.trim() ? (
              <SafeLogoImage
                src={headerProfile.logoImage}
                alt={headerProfile.restaurantName || 'Restaurant'}
                className="h-7 w-7 rounded-lg object-cover"
              />
            ) : (
              <AppLogo size={28} />
            ))}
          <button
            type="button"
            onClick={() => setCollapsed((p) => !p)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="border-b border-border px-3 py-3">
            <StoreStatusSwitcher collapsed={false} />
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-hide">
          {!collapsed && <p className="section-label mb-2 mt-1 px-3">Operations</p>}
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.tab)}
                title={collapsed ? item.label : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive ? 'nav-item-active bg-teal-50 text-restaurant' : 'nav-item'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-restaurant px-1.5 text-xs font-bold text-white">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-border p-3">
          <ThemeToggle collapsed={collapsed} showLabel />
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium nav-item ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Settings</span>}
          </button>
          <a
            href="/"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium nav-item ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card px-6">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Store className="h-4 w-4 flex-shrink-0 text-restaurant" />
            <span className="truncate font-bold text-foreground">{headerProfile.restaurantName}</span>
            {headerProfile.address && (
              <span className="hidden truncate text-muted-foreground sm:inline">
                · {headerProfile.address}
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            {pendingOrderCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning">
                <TriangleAlert className="h-3.5 w-3.5" />
                {pendingOrderCount} new order{pendingOrderCount === 1 ? '' : 's'}
              </div>
            )}
            <ThemeToggle className="relative rounded-lg p-2 transition-colors hover:bg-muted" />
            <NotificationBell
              showDot={pendingOrderCount > 0}
              items={orderNotifications}
              emptyLabel="No incoming orders"
            />
            <div className="hidden items-center gap-2 md:flex">
              <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-restaurant/10 text-restaurant ring-1 ring-border">
                {headerProfile.logoImage?.trim() ? (
                  <SafeLogoImage
                    src={headerProfile.logoImage}
                    alt={headerProfile.restaurantName}
                    className="h-8 w-8 object-cover"
                  />
                ) : (
                  <Store className="h-4 w-4" />
                )}
              </span>
              <div>
                <p className="max-w-[140px] truncate text-sm font-semibold leading-tight">
                  {headerProfile.restaurantName}
                </p>
                <p className="text-xs leading-tight text-muted-foreground">Owner</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <RestaurantTabContent activeTab={activeTab} />
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-card px-1 py-1 md:hidden">
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={`mobile-${item.key}`}
                type="button"
                onClick={() => setActiveTab(item.tab)}
                className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition-all ${
                  isActive ? 'text-restaurant' : 'text-muted-foreground'
                }`}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.badge && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-restaurant px-1 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold">{item.label}</span>
                {isActive && (
                  <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-restaurant" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
