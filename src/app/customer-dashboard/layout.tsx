'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import ClientErrorBoundary from '@/components/ClientErrorBoundary';

const CustomerChatbot = dynamic(() => import('./components/CustomerChatbot'), {
  ssr: false,
});

export default function CustomerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ClientErrorBoundary
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
            Dashboard failed to render. Refresh the page.
          </div>
        }
      >
        {children}
      </ClientErrorBoundary>
      <ClientErrorBoundary>
        <CustomerChatbot />
      </ClientErrorBoundary>
    </>
  );
}
