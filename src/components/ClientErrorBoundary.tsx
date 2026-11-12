'use client';

import React from 'react';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = { hasError: boolean };

export default class ClientErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('UI recovered from a client error:', error.message);
    // Report to the admin System Health screen (best effort).
    try {
      void fetch('/api/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route: window.location.pathname,
          message: error.message,
          stack: error.stack?.slice(0, 2000),
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* never let reporting break the page */
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
