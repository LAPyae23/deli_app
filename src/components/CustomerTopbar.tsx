'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, User } from 'lucide-react';
import { toast } from 'sonner';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationBell, { type BellNotificationItem } from '@/components/NotificationBell';
import AppImage from '@/components/ui/AppImage';

interface CustomerTopbarProps {
  onProfileClick?: () => void;
  onSearch?: (query: string) => void;
  user?: {
    firstName?: string;
    lastName?: string;
    profileImage?: string | null;
  } | null;
}

const ACTIVE_STATUSES = new Set([
  'PENDING',
  'PLACED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
]);
const POLL_MS = 15_000;

export default function CustomerTopbar({ onProfileClick, onSearch, user }: CustomerTopbarProps) {
  const [notifications, setNotifications] = useState<BellNotificationItem[]>([]);
  const [avatarUrl, setAvatarUrl] = useState(user?.profileImage || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [streakCount, setStreakCount] = useState(0);
  const [hasStreakReward, setHasStreakReward] = useState(false);
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Customer';

  useEffect(() => {
    setAvatarUrl(user?.profileImage || '');
  }, [user?.profileImage]);

  useEffect(() => {
    function onProfileUpdated(event: Event) {
      const detail = (event as CustomEvent<{ profileImage?: string }>).detail || {};
      if (detail.profileImage !== undefined) {
        setAvatarUrl(detail.profileImage || '');
      }
    }
    window.addEventListener('fooddash:customer-profile-updated', onProfileUpdated);
    return () => {
      window.removeEventListener('fooddash:customer-profile-updated', onProfileUpdated);
    };
  }, []);

  // Daily streak check-in when dashboard opens
  useEffect(() => {
    let cancelled = false;

    async function checkInStreak() {
      try {
        const customerId = localStorage.getItem('fooddash_session_id');
        if (!customerId) return;

        const res = await fetch('/api/customer/streak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId }),
        });
        const data = await res.json();
        if (!res.ok || !data.success || cancelled || !data.streak) return;

        const streak = data.streak as {
          streakCount?: number;
          rewardGranted?: boolean;
          hasStreakReward?: boolean;
          streakDiscountPercent?: number;
          streakVoucherCode?: string;
          milestoneReached?: number;
        };

        setStreakCount(Number(streak.streakCount) || 0);
        setHasStreakReward(Boolean(streak.hasStreakReward));

        if (streak.rewardGranted) {
          const pct = Number(streak.streakDiscountPercent) || 10;
          const code = streak.streakVoucherCode || 'STREAK7';
          toast.success(`🔥 ${streak.milestoneReached || 7}-day streak! ${pct}% off unlocked`, {
            description: `Voucher ${code} is saved to your profile. Use it at checkout.`,
            duration: 6000,
          });
          window.dispatchEvent(
            new CustomEvent('fooddash:streak-reward', {
              detail: {
                percent: pct,
                code,
                hasStreakReward: true,
              },
            })
          );
        }
      } catch (error) {
        console.warn('Streak check-in failed', error);
      }
    }

    checkInStreak();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        if (!res.ok || !data.success || cancelled) return;

        const orders = Array.isArray(data.orders) ? data.orders : [];
        const active = orders.filter((o: { status?: string }) =>
          ACTIVE_STATUSES.has(String(o.status || '').toUpperCase())
        );

        setNotifications(
          active.slice(0, 8).map(
            (o: {
              _id?: string;
              id?: string;
              orderNumber?: string;
              status?: string;
              restaurantName?: string;
            }) => ({
              id: String(o._id || o.id || o.orderNumber || Math.random()),
              title: `Order ${o.orderNumber || ''}`.trim() || 'Active order',
              body: `${o.restaurantName || 'Restaurant'} · ${String(o.status || '').replace(/_/g, ' ')}`,
            })
          )
        );
      } catch {
        if (!cancelled) setNotifications([]);
      }
    }

    loadNotifications();
    const interval = setInterval(loadNotifications, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const hasAvatar = useMemo(() => Boolean(avatarUrl?.trim()), [avatarUrl]);
  const streakLabel =
    streakCount === 1 ? '1 day streak' : `${streakCount} day streak`;

  return (
    <header className="h-14 sm:h-16 bg-card border-b border-border flex items-center px-3 sm:px-6 gap-2 sm:gap-4 sticky top-0 z-30">
      <div className="flex-1 min-w-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search restaurants or dishes..."
            className="input-field pl-9 py-2 text-sm w-full"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (onSearch) onSearch(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3 ml-auto flex-shrink-0">
        <div
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold tabular-nums shadow-sm ${
            hasStreakReward
              ? 'border-customer/40 bg-gradient-to-r from-[#E62429]/15 to-orange-500/20 text-customer'
              : 'border-customer/30 bg-customer/10 text-customer'
          }`}
          title={
            hasStreakReward
              ? `${streakLabel} · 10% STREAK7 reward ready`
              : streakLabel
          }
          aria-label={streakLabel}
        >
          <span className="text-sm leading-none" aria-hidden>
            🔥
          </span>
          <span className="text-customer">{streakCount}</span>
          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wide text-customer/80">
            day{streakCount === 1 ? '' : 's'}
          </span>
        </div>

        <ThemeToggle className="relative p-2 rounded-lg hover:bg-muted transition-colors" />
        <NotificationBell
          showDot={notifications.length > 0}
          items={notifications}
          emptyLabel="No active orders"
        />
        <button
          type="button"
          onClick={onProfileClick}
          className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted sm:px-2"
        >
          <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
            {hasAvatar ? (
              <AppImage
                key={avatarUrl}
                src={avatarUrl}
                alt={displayName}
                width={32}
                height={32}
                className="h-8 w-8 object-cover"
                unoptimized
              />
            ) : (
              <User className="h-4 w-4" />
            )}
          </span>
          <div className="hidden md:block text-left">
            <p className="text-sm font-semibold leading-tight">{displayName}</p>
            <p className="text-xs text-muted-foreground leading-tight">Customer</p>
          </div>
        </button>
      </div>
    </header>
  );
}
