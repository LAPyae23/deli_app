'use client';

import React from 'react';
import ClientErrorBoundary from '@/components/ClientErrorBoundary';

export default function CustomerDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <p className="text-lg font-bold text-foreground">Customer dashboard hit a display error</p>
      <p className="max-w-md text-sm text-muted-foreground">
        {error?.message || 'A client-side exception occurred. Try reloading this page.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-customer px-4 py-2 text-sm font-bold text-white"
      >
        Reload dashboard
      </button>
    </div>
  );
}
