'use client';

import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subscribe() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const { publicKey } = await (await fetch('/api/push/public-key')).json();
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
}

/**
 * Small banner asking to turn on push notifications. Hidden when the
 * browser can't do push, when already on, or after the user dismisses it.
 */
export default function PushOptIn({ message, className = '' }: { message: string; className?: string }) {
  const [state, setState] = useState<'hidden' | 'ask' | 'busy'>('hidden');

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return;
    }
    if (Notification.permission === 'granted') {
      // Keep this device linked to whoever is signed in now.
      subscribe().catch(() => {});
      return;
    }
    if (Notification.permission === 'denied' || localStorage.getItem('fooddash_push_dismissed') === '1') return;
    setState('ask');
  }, []);

  if (state === 'hidden') return null;

  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm ${className}`}>
      <BellRing className="h-5 w-5 shrink-0 text-customer" />
      <p className="min-w-0 flex-1 text-sm text-foreground">{message}</p>
      <button
        type="button"
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy');
          try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') await subscribe();
          } catch {
            /* ignore */
          }
          setState('hidden');
        }}
        className="shrink-0 rounded-xl bg-customer px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
      >
        Turn on
      </button>
      <button
        type="button"
        aria-label="Not now"
        onClick={() => {
          localStorage.setItem('fooddash_push_dismissed', '1');
          setState('hidden');
        }}
        className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
