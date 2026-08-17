'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, MessageSquareQuote, Star } from 'lucide-react';
import { formatRating } from '@/lib/formatRating';

type PublicReview = {
  customerName: string;
  restaurantRating: number;
  reviewComment: string;
  createdAt: string | null;
};

function formatReviewDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StarRow({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="flex items-center gap-0.5" aria-label={`${filled} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${
            n <= filled ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-border'
          }`}
        />
      ))}
    </div>
  );
}

export default function RestaurantReviews({
  restaurantId,
  refreshKey,
}: {
  restaurantId: string;
  refreshKey?: string | number | boolean;
}) {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/restaurants/${encodeURIComponent(restaurantId)}/reviews`
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to load reviews');
        }
        if (!cancelled) {
          setReviews(Array.isArray(data.reviews) ? data.reviews : []);
          setAverageRating(
            data.averageRating != null && Number.isFinite(Number(data.averageRating))
              ? Number(data.averageRating)
              : null
          );
        }
      } catch (error) {
        console.warn('Restaurant reviews load failed', error);
        if (!cancelled) {
          setReviews([]);
          setAverageRating(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, refreshKey]);

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 card-shadow sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <MessageSquareQuote className="h-4 w-4 text-customer" />
            <h2 className="text-lg font-bold text-foreground">What others are saying</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {reviews.length > 0
              ? `${reviews.length} recent review${reviews.length === 1 ? '' : 's'} from verified orders`
              : 'Verified reviews from customers who ordered here'}
          </p>
        </div>
        {averageRating != null && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="text-sm font-bold font-tabular text-foreground">
              {formatRating(averageRating)}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-customer" />
          Loading reviews…
        </div>
      ) : reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No reviews yet. Be the first to share how the food was.
        </p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review, index) => (
            <li
              key={`${review.customerName}-${review.createdAt || index}`}
              className="rounded-xl border border-border bg-background/60 p-4"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {review.customerName}
                  </p>
                  <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {formatReviewDate(review.createdAt)}
                  </p>
                </div>
                <StarRow rating={review.restaurantRating} />
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">
                {review.reviewComment}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
