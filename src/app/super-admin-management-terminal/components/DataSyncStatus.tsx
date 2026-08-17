'use client';

import React, { useEffect, useState } from 'react';

type DataSyncStatusProps = {
  /** Epoch ms of the last successful data fetch */
  lastFetchTime: number | null;
  className?: string;
};

function formatSyncedAgo(lastFetchTime: number, now: number): string {
  const elapsedMs = Math.max(0, now - lastFetchTime);
  const secs = Math.floor(elapsedMs / 1000);

  if (secs < 15) return 'just now';
  if (secs < 60) return `${secs}s ago`;

  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Subtle admin header indicator: "Data Last Synced: X mins ago"
 * Refreshes the label every 60s without refetching data.
 */
export default function DataSyncStatus({
  lastFetchTime,
  className = '',
}: DataSyncStatusProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Re-render immediately when a new sync lands (so "just now" shows without waiting 60s)
  useEffect(() => {
    if (lastFetchTime != null) setNow(Date.now());
  }, [lastFetchTime]);

  const label =
    lastFetchTime == null
      ? 'syncing…'
      : formatSyncedAgo(lastFetchTime, now);

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground/90 backdrop-blur-sm ${className}`}
      title={
        lastFetchTime
          ? `Last sync: ${new Date(lastFetchTime).toLocaleTimeString()}`
          : 'Waiting for first sync'
      }
      aria-live="polite"
    >
      <span
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success status-pulse ring-2 ring-success/20"
        aria-hidden
      />
      <span className="whitespace-nowrap">
        Data Last Synced:{' '}
        <span className="font-semibold text-muted-foreground font-tabular">{label}</span>
      </span>
    </div>
  );
}
