'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingCart, ClipboardList, MapPin, Heart, Settings, LogOut, ChevronLeft, ChevronRight,  } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';

const NAV_ITEMS = [
  { key: 'nav-home', href: '/customer-dashboard', icon: Home, label: 'Discover', badge: null },
  { key: 'nav-orders', href: '/customer-dashboard?tab=orders', icon: ClipboardList, label: 'My Orders', badge: '1' },
  { key: 'nav-cart', href: '/customer-dashboard?tab=cart', icon: ShoppingCart, label: 'Cart', badge: '3' },
  { key: 'nav-addresses', href: '/customer-dashboard?tab=addresses', icon: MapPin, label: 'Addresses', badge: null },
  { key: 'nav-favorites', href: '/customer-dashboard?tab=favorites', icon: Heart, label: 'Favorites', badge: null },
];

export default function CustomerSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside className={`flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-60'} min-h-screen relative`}>
      <div className={`flex items-center border-b border-border h-16 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <AppLogo size={28} />
            <span className="font-bold text-base tracking-tight">FoodDash</span>
          </div>
        )}
        {collapsed && <AppLogo size={28} />}
        <button onClick={() => setCollapsed(p => !p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
        {!collapsed && <p className="section-label px-3 mb-2 mt-1">Menu</p>}
        {NAV_ITEMS?.map((item) => {
          const isActive = pathname === item?.href || pathname?.startsWith(item?.href?.split('?')?.[0]);
          return (
            <Link
              key={item?.key}
              href={item?.href}
              title={collapsed ? item?.label : undefined}
              className={`${isActive ? 'nav-item-active bg-orange-50 text-customer' : 'nav-item'} ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item?.label}</span>
                  {item?.badge && (
                    <span className="min-w-[20px] h-5 flex items-center justify-center bg-customer text-white text-xs font-bold rounded-full px-1.5">
                      {item?.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border space-y-1">
        <Link href="/customer-dashboard?tab=settings" className={`nav-item ${collapsed ? 'justify-center px-0' : ''}`} title={collapsed ? 'Settings' : undefined}>
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        <Link href="/" className={`nav-item ${collapsed ? 'justify-center px-0' : ''}`} title={collapsed ? 'Sign Out' : undefined}>
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </Link>
      </div>
    </aside>
  );
}