'use client';

import { useT } from '@/lib/i18n';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, Package, Sparkles } from 'lucide-react';

function greetingKey(hour: number) {
  if (hour < 5) return 'greet.night' as const;
  if (hour < 12) return 'greet.morning' as const;
  if (hour < 17) return 'greet.afternoon' as const;
  return 'greet.evening' as const;
}

function yangonHour() {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Yangon', hour: 'numeric', hourCycle: 'h23' }).format(new Date())
  );
}

/** Top of Discover: a friendly greeting plus the two main shortcuts (parcel, AI picks). */
export default function DiscoverHeader() {
  const { t } = useT();
  const [name, setName] = useState('');
  const [helloKey, setHelloKey] = useState<ReturnType<typeof greetingKey>>('greet.evening');

  useEffect(() => {
    const full = localStorage.getItem('fooddash_session_name') || '';
    setName(full.trim().split(/\s+/)[0] || '');
    setHelloKey(greetingKey(yangonHour()));
  }, []);

  return (
    <section className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t(helloKey)}
          {name ? `, ${name}` : ''} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('greet.sub')}</p>
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
            <span className="block text-sm font-bold text-foreground">{t('quick.parcel')}</span>
            <span className="block text-xs text-muted-foreground">{t('quick.parcelSub')}</span>
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
            <span className="block text-sm font-bold text-foreground">{t('quick.ai')}</span>
            <span className="block text-xs text-muted-foreground">{t('quick.aiSub')}</span>
          </span>
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
