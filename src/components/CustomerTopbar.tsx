'use client';

import React from 'react';
import { Bell, Search, MapPin } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';

export default function CustomerTopbar() {
  return (
    <header className="h-14 sm:h-16 bg-card border-b border-border flex items-center px-3 sm:px-6 gap-2 sm:gap-4 sticky top-0 z-30">
      {/* Location — hidden on very small screens */}
      <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0">
        <MapPin className="w-4 h-4 text-customer" />
        <span className="font-medium text-foreground hidden lg:inline">123 Maple Street, Brooklyn</span>
        <span className="font-medium text-foreground lg:hidden">Brooklyn</span>
        <button className="text-xs text-customer font-semibold hover:underline">Change</button>
      </div>

      {/* Mobile location icon only */}
      <div className="flex sm:hidden items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
        <MapPin className="w-4 h-4 text-customer" />
        <button className="text-xs text-customer font-semibold">Brooklyn</button>
      </div>

      {/* Search */}
      <div className="flex-1 min-w-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search restaurants or dishes..."
            className="input-field pl-9 py-2 text-sm w-full"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 sm:gap-3 ml-auto flex-shrink-0">
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
        </button>
        <div className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded-lg px-1.5 sm:px-2 py-1.5 transition-colors">
          <AppImage
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=maya"
            alt="Maya Chen avatar illustration"
            width={32}
            height={32}
            className="rounded-full bg-muted w-7 h-7 sm:w-8 sm:h-8"
          />
          <div className="hidden md:block">
            <p className="text-sm font-semibold leading-tight">Maya Chen</p>
            <p className="text-xs text-muted-foreground leading-tight">Customer</p>
          </div>
        </div>
      </div>
    </header>
  );
}