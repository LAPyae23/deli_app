'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Bike, Store, X } from 'lucide-react';

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  name: string;
  email: string;
  read: boolean;
  createdAt: string;
}

export default function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin-notifications');
      const data = await res.json();
      if (!res.ok || !data.success) return;
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Keep last known state if fetch fails
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const id = window.setInterval(loadNotifications, 20000);
    return () => window.clearInterval(id);
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const openPanel = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen) {
      // Closing the panel clears the list — admin already saw them
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin-notifications');
      const data = await res.json();
      if (!res.ok || !data.success) return;

      const list = data.notifications || [];
      setNotifications(list);
      setUnreadCount(data.unreadCount || 0);

      if (list.length > 0) {
        await fetch('/api/admin-notifications', { method: 'PATCH' });
        setUnreadCount(0);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={openPanel}
        className="relative p-2 rounded-lg hover:bg-zinc-800 transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5 text-zinc-400" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">Notifications</p>
              <p className="text-xs text-zinc-500">New restaurant & rider registrations</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <p className="px-4 py-8 text-sm text-zinc-500 text-center">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-sm text-zinc-500 text-center">No notifications yet</p>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {notifications.map((item) => {
                  const isVendor = item.type === 'VENDOR_REGISTERED';
                  return (
                    <li key={item.id} className="px-4 py-3 hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 p-1.5 rounded-lg ${
                            isVendor ? 'bg-teal-500/10 text-restaurant' : 'bg-rider/10 text-rider'
                          }`}
                        >
                          {isVendor ? <Store className="w-3.5 h-3.5" /> : <Bike className="w-3.5 h-3.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">{item.message}</p>
                          <p className="text-[11px] text-zinc-600 mt-1.5">{item.createdAt}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
