'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

type StoreStatus = 'OPEN' | 'BUSY' | 'CLOSED';

const STATUS_OPTIONS: { value: StoreStatus; label: string; color: string; dot: string }[] = [
  { value: 'OPEN', label: 'Open', color: 'text-success', dot: 'bg-success' },
  { value: 'BUSY', label: 'Busy', color: 'text-warning', dot: 'bg-warning' },
  { value: 'CLOSED', label: 'Closed', color: 'text-danger', dot: 'bg-danger' },
];

export default function StoreStatusSwitcher({ collapsed }: { collapsed: boolean }) {
  const [status, setStatus] = useState<StoreStatus>('OPEN');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sessionId = localStorage.getItem('fooddash_session_id');
    if (!sessionId) return;
    fetch(`/api/restaurant/profile?restaurantId=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.profile?.storeStatus) {
          setStatus(data.profile.storeStatus);
        }
      })
      .catch(() => {
        // keep default OPEN
      });
  }, []);

  const current = STATUS_OPTIONS.find((s) => s.value === status)!;

  const handleChange = async (s: StoreStatus) => {
    const sessionId = localStorage.getItem('fooddash_session_id');
    if (!sessionId) {
      toast.error('Please sign in again');
      return;
    }
    const previous = status;
    setStatus(s);
    setOpen(false);
    try {
      const res = await fetch('/api/restaurant/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: sessionId, storeStatus: s }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update status');
      }
      toast.success(`Store status updated to ${s}`);
    } catch (error) {
      setStatus(previous);
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  if (collapsed) {
    return (
      <div className="flex justify-center">
        <div className={`w-3 h-3 rounded-full ${current.dot} status-pulse`} />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-border transition-colors text-sm"
      >
        <div
          className={`w-2.5 h-2.5 rounded-full ${current.dot} ${
            status === 'OPEN' ? 'status-pulse' : ''
          }`}
        />
        <span className={`font-semibold flex-1 text-left ${current.color}`}>
          Store {current.label}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg card-shadow-md z-50 overflow-hidden">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={`status-opt-${opt.value}`}
              type="button"
              onClick={() => handleChange(opt.value)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors ${
                status === opt.value ? 'bg-muted' : ''
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${opt.dot}`} />
              <span className={`font-semibold ${opt.color}`}>{opt.label}</span>
              {status === opt.value && (
                <span className="ml-auto text-xs text-muted-foreground">Current</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
