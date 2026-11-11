'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, Package, Sparkles } from 'lucide-react';

function greeting(hour: number) {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function yangonHour() {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Yangon', hour: 'numeric', hourCycle: 'h23' }).format(new Date())
  );
}

/** Top of Discover: a friendly greeting plus the two main shortcuts (parcel, AI picks). */
export default function DiscoverHeader() {
  const [name, setName] = useState('');
  const [hello, setHello] = useState('Welcome back');

  useEffect(() => {
    const full = localStorage.getItem('fooddash_session_name') || '';
    setName(full.trim().split(/\s+/)[0] || '');
    setHello(greeting(yangonHour()));
  }, []);

  return (
    <section className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {hello}
          {name ? `, ${name}` : ''} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">What would you like today? Order food or send a parcel across Yangon.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:flex">
        <Link
          href="/customer-dashboard/parcels"
          className="group flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition hover:border-customer/40 hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-customer/10">
            <Package className="h-5 w-5 text-customer" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-foreground">Send a parcel</span>
            <span className="block text-xs text-muted-foreground">Door-to-door, see the price first</span>
          </span>
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/customer-dashboard/ai-picks"
          className="group flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition hover:border-customer/40 hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
            <Sparkles className="h-5 w-5 text-amber-500" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-foreground">AI Picks</span>
            <span className="block text-xs text-muted-foreground">Weather, trending, your taste</span>
          </span>
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
