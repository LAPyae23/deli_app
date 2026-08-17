'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Loader2,
  Share2,
  Sparkles,
  Trophy,
  Utensils,
  Wallet,
  ShoppingBag,
  X,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatKyat } from '@/lib/currency';

type WrappedData = {
  customerName?: string;
  monthLabel?: string;
  totalOrders?: number;
  totalSpent?: number;
  topItem?: { name: string; quantity: number };
  topCategory?: { name: string; quantity: number };
  township?: string;
  percentile?: number;
  percentileText?: string;
  headline?: string;
};

type WrappedResponse = {
  success: boolean;
  wrapped?: WrappedData;
  message?: string;
};

function formatSpent(amount: number) {
  return formatKyat(amount || 0);
}

export default function FoodieWrapped() {
  const [wrapped, setWrapped] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const customerId = localStorage.getItem('fooddash_session_id') || '';
        if (!customerId) {
          throw new Error('Please sign in to view your Foodie Wrapped');
        }

        const res = await fetch(
          `/api/customer/wrapped?customerId=${encodeURIComponent(customerId)}`
        );
        const data = (await res.json()) as WrappedResponse;
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to load Foodie Wrapped');
        }
        if (!cancelled) setWrapped(data.wrapped || null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setWrapped(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function handleShare() {
    const text =
      wrapped?.headline || 'Check out my Foodie Wrapped on FoodDash!';
    const shareBody = `${text}\n${wrapped?.percentileText || ''}`;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareBody).catch(() => undefined);
    }
    toast.success('Share card ready — copied to clipboard!');
  }

  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-pink-200/50 bg-gradient-to-r from-pink-50 to-violet-50 px-4 py-3 text-sm text-slate-600 dark:border-border dark:from-muted dark:to-muted dark:text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
        Unwrapping your month…
      </div>
    );
  }

  if (error || !wrapped) return null;

  const qty = wrapped.topItem?.quantity || 0;
  const itemName = wrapped.topItem?.name || 'Burgers';
  const headline =
    wrapped.headline ||
    (qty > 0
      ? `You ate ${qty} ${itemName} this month!`
      : 'Your Foodie story starts with the next order.');

  return (
    <section className="mb-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-700 px-4 py-3 text-left text-white shadow-md shadow-fuchsia-500/20 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]"
      >
        <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-yellow-300/25 blur-2xl" />
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/25">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">
            Foodie Wrapped · {wrapped.monthLabel || 'This month'}
          </span>
          <span className="mt-0.5 block truncate text-sm font-bold sm:text-base">
            {headline}
          </span>
        </span>
        <span className="relative inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold ring-1 ring-white/20">
          Open
          <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Foodie Wrapped"
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl shadow-2xl sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-pink-500 via-rose-500 to-purple-700 px-5 py-6 text-white sm:px-6">
                <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-yellow-300/30 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 right-0 h-44 w-44 rounded-full bg-cyan-300/25 blur-3xl" />

                <div className="relative mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/90 ring-1 ring-white/20">
                      <Sparkles className="h-3.5 w-3.5" />
                      Foodie Wrapped
                    </div>
                    <p className="text-sm font-medium text-white/75">
                      {wrapped.monthLabel || 'This month'} ·{' '}
                      {wrapped.customerName || 'Foodie'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleShare}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-fuchsia-700"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-full bg-white/15 p-2 transition hover:bg-white/25"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <h2 className="relative text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                  {headline}
                </h2>

                <div className="relative mt-4 flex items-start gap-2 rounded-2xl bg-black/15 px-3.5 py-3 ring-1 ring-white/15">
                  <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
                  <p className="text-sm font-semibold leading-relaxed text-white/95">
                    {wrapped.percentileText ||
                      'You are in the top 5% of Fast Food lovers in Yankin!'}
                  </p>
                </div>

                <div className="relative mt-5 grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                    <ShoppingBag className="mb-1.5 h-4 w-4" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
                      Orders
                    </p>
                    <p className="text-xl font-black font-tabular">
                      {wrapped.totalOrders ?? 0}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                    <Wallet className="mb-1.5 h-4 w-4" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
                      Spent
                    </p>
                    <p className="text-lg font-black font-tabular">
                      {formatSpent(wrapped.totalSpent || 0)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                    <Utensils className="mb-1.5 h-4 w-4" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
                      Top bite
                    </p>
                    <p className="truncate text-base font-black">{itemName}</p>
                    <p className="text-xs text-white/70 font-tabular">×{qty || 0}</p>
                  </div>
                  <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                    <Sparkles className="mb-1.5 h-4 w-4" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
                      Top category
                    </p>
                    <p className="truncate text-base font-black">
                      {wrapped.topCategory?.name || 'Fast Food'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
