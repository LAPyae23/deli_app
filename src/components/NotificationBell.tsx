'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

export type BellNotificationItem = {
  id: string;
  title: string;
  body?: string;
  onClick?: () => void;
};

type NotificationBellProps = {
  className?: string;
  iconClassName?: string;
  showDot?: boolean;
  emptyLabel?: string;
  align?: 'left' | 'right';
  items?: BellNotificationItem[];
};

export default function NotificationBell({
  className = 'relative rounded-lg p-2 transition-colors hover:bg-muted',
  iconClassName = 'h-5 w-5 text-muted-foreground',
  showDot = false,
  emptyLabel = 'No new notifications',
  align = 'right',
  items = [],
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasItems = items.length > 0;
  const shouldShowDot = showDot || hasItems;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={className}
      >
        <Bell className={iconClassName} />
        {shouldShowDot && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-card" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={`absolute z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-black/10 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Notifications
            </p>
          </div>

          {hasItems ? (
            <ul className="max-h-72 overflow-y-auto py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-muted"
                    onClick={() => {
                      item.onClick?.();
                      setOpen(false);
                    }}
                  >
                    <span className="text-sm font-semibold text-foreground">{item.title}</span>
                    {item.body && (
                      <span className="text-xs text-muted-foreground line-clamp-2">{item.body}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">{emptyLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                You&apos;re all caught up for now.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
