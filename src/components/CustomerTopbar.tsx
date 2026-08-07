'use client';

import React from 'react';
import { Bell, Search } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';

interface CustomerTopbarProps {
  onProfileClick?: () => void;
  user?: {
    firstName: string;
    lastName: string;
    profileImage: string;
  };
}

const FALLBACK_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback';

export default function CustomerTopbar({ onProfileClick, user }: CustomerTopbarProps) {
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Customer';
  const avatarSrc = user?.profileImage || FALLBACK_AVATAR;
  const isDataImage = avatarSrc.startsWith('data:');

  return (
    <header className="h-14 sm:h-16 bg-card border-b border-border flex items-center px-3 sm:px-6 gap-2 sm:gap-4 sticky top-0 z-30">
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
        <div
          role="button"
          tabIndex={0}
          onClick={onProfileClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onProfileClick?.();
            }
          }}
          className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded-lg px-1.5 sm:px-2 py-1.5 transition-colors"
        >
          {isDataImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarSrc}
              alt={`${displayName} avatar`}
              className="rounded-full bg-muted w-7 h-7 sm:w-8 sm:h-8 object-cover"
              width={32}
              height={32}
            />
          ) : (
            <AppImage
              src={avatarSrc}
              alt={`${displayName} avatar`}
              width={32}
              height={32}
              className="rounded-full bg-muted w-7 h-7 sm:w-8 sm:h-8"
              unoptimized
            />
          )}
          <div className="hidden md:block">
            <p className="text-sm font-semibold leading-tight">{displayName}</p>
            <p className="text-xs text-muted-foreground leading-tight">Customer</p>
          </div>
        </div>
      </div>
    </header>
  );
}
