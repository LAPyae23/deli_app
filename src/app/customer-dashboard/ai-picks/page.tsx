'use client';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import AiPicksClient from './AiPicksClient';

export default function AiPicksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading…
        </div>
      }
    >
      <AiPicksClient />
    </Suspense>
  );
}
