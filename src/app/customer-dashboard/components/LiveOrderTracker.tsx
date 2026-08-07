'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  CircleCheckBig,
  ChefHat,
  Bike,
  Package,
  Phone,
  MessageCircle,
  X,
  Loader2,
  AlertTriangle,
  Star,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';

const LiveTrackerMap = dynamic(() => import('./LiveTrackerMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

type LatLng = { lat: number; lng: number };

type OrderStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'READY'
  | 'REJECTED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | string;

type TrackedOrder = {
  _id: string;
  orderNumber?: string;
  restaurantName?: string;
  status?: OrderStatus;
  prepTime?: number;
  items?: Array<{ name?: string; quantity?: number }>;
  restaurantCoords?: { lat?: number; lng?: number };
  deliveryAddress?: { lat?: number; lng?: number; address?: string };
  riderCoords?: { lat?: number; lng?: number };
  riderName?: string;
};

const ORDER_STEPS = [
  { key: 'step-placed', status: 'PENDING', label: 'Order Placed', icon: Package, desc: 'Waiting for restaurant confirmation' },
  { key: 'step-preparing', status: 'PREPARING', label: 'Preparing', icon: ChefHat, desc: 'The kitchen is cooking your food' },
  { key: 'step-enroute', status: 'OUT_FOR_DELIVERY', label: 'On the Way', icon: Bike, desc: 'Your rider is heading to you' },
  { key: 'step-delivered', status: 'DELIVERED', label: 'Delivered', icon: CircleCheckBig, desc: 'Enjoy your meal!' },
];

const FALLBACK_RESTAURANT = { lat: 16.8409, lng: 96.1735 };
const FALLBACK_CUSTOMER = { lat: 16.8564, lng: 96.1821 };
const POLL_MS = 5_000;

function statusToStepIndex(status?: OrderStatus): number {
  switch ((status || '').toUpperCase()) {
    case 'PENDING':
    case 'PLACED':
      return 0;
    case 'PREPARING':
      return 1;
    case 'READY':
      return 1;
    case 'OUT_FOR_DELIVERY':
      return 2;
    case 'DELIVERED':
      return 3;
    default:
      return 0;
  }
}

function formatItems(items?: TrackedOrder['items']) {
  if (!items?.length) return 'Your order';
  return items
    .map((item) => `${item.name || 'Item'} × ${item.quantity ?? 1}`)
    .join(', ');
}

function parseCoords(
  lat?: number,
  lng?: number,
  fallback: LatLng = FALLBACK_RESTAURANT
): LatLng {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
    return { lat: parsedLat, lng: parsedLng };
  }
  return fallback;
}

function riderFallbackForStatus(_status: string, restaurant: LatLng): LatLng {
  return { ...restaurant };
}

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className="rounded-md p-0.5 transition-transform hover:scale-110 disabled:opacity-50 disabled:hover:scale-100"
          aria-label={`Rate ${n} stars`}
        >
          <Star
            className={`h-7 w-7 sm:h-8 sm:w-8 ${
              n <= value
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-border'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

interface LiveOrderTrackerProps {
  activeOrderId: string;
  onDismiss?: () => void;
}

export default function LiveOrderTracker({ activeOrderId, onDismiss }: LiveOrderTrackerProps) {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [riderLocation, setRiderLocation] = useState<LatLng>(FALLBACK_RESTAURANT);
  const [restaurantRating, setRestaurantRating] = useState(5);
  const [riderRating, setRiderRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const syncedPrepRef = useRef<number | null>(null);

  const restaurantLocation = useMemo(
    () =>
      parseCoords(
        order?.restaurantCoords?.lat,
        order?.restaurantCoords?.lng,
        FALLBACK_RESTAURANT
      ),
    [order?.restaurantCoords?.lat, order?.restaurantCoords?.lng]
  );

  const customerLocation = useMemo(
    () =>
      parseCoords(
        order?.deliveryAddress?.lat,
        order?.deliveryAddress?.lng,
        FALLBACK_CUSTOMER
      ),
    [order?.deliveryAddress?.lat, order?.deliveryAddress?.lng]
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${activeOrderId}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to fetch');
        if (!cancelled) {
          const nextOrder = data.order as TrackedOrder;
          setOrder(nextOrder);
          setIsLoading(false);

          const status = String(nextOrder?.status || 'PENDING').toUpperCase();
          const restaurant = parseCoords(
            nextOrder?.restaurantCoords?.lat,
            nextOrder?.restaurantCoords?.lng,
            FALLBACK_RESTAURANT
          );

          const riderLat = Number(nextOrder?.riderCoords?.lat);
          const riderLng = Number(nextOrder?.riderCoords?.lng);
          if (Number.isFinite(riderLat) && Number.isFinite(riderLng)) {
            setRiderLocation({ lat: riderLat, lng: riderLng });
          } else {
            setRiderLocation(riderFallbackForStatus(status, restaurant));
          }

          const prep = Number(nextOrder?.prepTime);
          if (
            Number.isFinite(prep) &&
            prep > 0 &&
            syncedPrepRef.current !== prep &&
            status === 'PREPARING'
          ) {
            syncedPrepRef.current = prep;
            setEtaSeconds(prep * 60);
          }
        }
      } catch (error) {
        console.warn(error);
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchOrder();
    const interval = setInterval(fetchOrder, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeOrderId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setEtaSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    onDismiss?.();
  };

  const submitReview = async () => {
    setIsSubmittingReview(true);
    try {
      const res = await fetch(`/api/orders/${activeOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantRating, riderRating, reviewComment }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to submit review');
      toast.success('Thank you for your feedback!');
      handleDismiss();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit feedback');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const status = (order?.status || 'PENDING').toUpperCase();
  const isPending = status === 'PENDING' || status === 'PLACED';
  const isRejected = status === 'REJECTED' || status === 'CANCELLED';
  const activeStepIndex = statusToStepIndex(status);
  const showRider = status === 'OUT_FOR_DELIVERY' || status === 'READY' || status === 'PREPARING';

  const etaMinutes = Math.floor(etaSeconds / 60);
  const etaSecsRem = etaSeconds % 60;

  if (isLoading && !order) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card py-10 text-muted-foreground card-shadow-md">
        <Loader2 className="h-5 w-5 animate-spin text-customer" />
        <p className="text-sm font-medium">Loading your order…</p>
      </div>
    );
  }

  if (isRejected) {
    return (
      <div className="overflow-hidden rounded-2xl border border-danger/30 bg-card card-shadow-md animate-fade-in">
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground">Order declined</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sorry, the restaurant declined your order
              {order?.orderNumber ? ` (${order.orderNumber})` : ''}. You were not charged.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <button type="button" onClick={handleDismiss} className="btn-primary w-full justify-center py-3">
            Close tracker
          </button>
        </div>
      </div>
    );
  }

  if (status === 'DELIVERED') {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card card-shadow-md animate-fade-in">
        <div className="gradient-orange flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/20 sm:h-8 sm:w-8">
              <CircleCheckBig className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white sm:text-sm">
                Order {order?.orderNumber || '—'} · {order?.restaurantName || 'Restaurant'}
              </p>
              <p className="hidden truncate text-xs text-white/70 sm:block">Delivered successfully</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg bg-white/10 p-1.5 text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <CircleCheckBig className="h-7 w-7 text-success" />
            </div>
            <h3 className="text-lg font-bold text-foreground sm:text-xl">
              Order Delivered! How was it?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Rate your experience with the shop and rider.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50">
                  <Store className="h-4 w-4 text-customer" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Restaurant</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {order?.restaurantName || 'Restaurant'}
                  </p>
                </div>
              </div>
              <StarRating
                value={restaurantRating}
                onChange={setRestaurantRating}
                disabled={isSubmittingReview}
              />
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                  <Bike className="h-4 w-4 text-rider" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Rider</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {order?.riderName || 'Your delivery rider'}
                  </p>
                </div>
              </div>
              <StarRating
                value={riderRating}
                onChange={setRiderRating}
                disabled={isSubmittingReview}
              />
            </div>

            <div>
              <label
                htmlFor="review-comment"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Comment
              </label>
              <textarea
                id="review-comment"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                disabled={isSubmittingReview}
                rows={3}
                placeholder="Leave a comment for the shop and rider..."
                className="input-field w-full resize-none py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
            <button
              type="button"
              onClick={submitReview}
              disabled={isSubmittingReview}
              className="btn-primary flex w-full items-center justify-center gap-2 py-3 disabled:opacity-60 sm:flex-1"
            >
              {isSubmittingReview ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                'Submit Feedback'
              )}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isSubmittingReview}
              className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60 sm:w-auto sm:min-w-[7rem]"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden card-shadow-md animate-fade-in">
      <div className="gradient-orange px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white animate-spin" />
            ) : (
              <Bike className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-xs sm:text-sm truncate">
              Order {order?.orderNumber || '—'} · {order?.restaurantName || 'Restaurant'}
            </p>
            <p className="text-white/70 text-xs truncate hidden sm:block">
              {isPending ? 'Waiting for restaurant to confirm…' : formatItems(order?.items)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {!isPending && (
            <div className="text-right">
              <p className="text-white/70 text-xs">
                {status === 'PREPARING' ? 'Ready in' : 'Arrives in'}
              </p>
              <p className="text-white font-bold text-lg sm:text-xl font-tabular">
                {String(etaMinutes).padStart(2, '0')}:{String(etaSecsRem).padStart(2, '0')}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isPending ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-50">
            <Loader2 className="h-7 w-7 animate-spin text-customer" />
          </div>
          <div>
            <p className="text-base font-bold text-foreground">Waiting for restaurant to confirm…</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {order?.restaurantName || 'The restaurant'} will accept or decline shortly.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="h-52 sm:h-64 w-full relative">
            <LiveTrackerMap
              restaurantLocation={restaurantLocation}
              customerLocation={customerLocation}
              riderLocation={riderLocation}
              showRider={showRider}
            />
          </div>

          <div className="px-4 sm:px-6 py-4 sm:py-5">
            <div className="flex items-start sm:items-center justify-between relative">
              <div className="absolute left-0 right-0 top-4 sm:top-5 h-0.5 bg-border mx-6 sm:mx-8" />
              <div
                className="absolute left-6 sm:left-8 top-4 sm:top-5 h-0.5 bg-customer transition-all duration-700"
                style={{
                  width: `${(activeStepIndex / (ORDER_STEPS.length - 1)) * 100}%`,
                  maxWidth: 'calc(100% - 3rem)',
                }}
              />
              {ORDER_STEPS.map((step, i) => {
                const isCompleted = i < activeStepIndex;
                const isActive = i === activeStepIndex;
                return (
                  <div key={step.key} className="relative flex flex-col items-center gap-1.5 sm:gap-2 z-10">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        isCompleted
                          ? 'bg-customer border-customer'
                          : isActive
                            ? 'bg-orange-50 border-customer'
                            : 'bg-card border-border'
                      }`}
                    >
                      <step.icon
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                          isCompleted
                            ? 'text-white'
                            : isActive
                              ? 'text-customer'
                              : 'text-muted-foreground'
                        }`}
                      />
                      {isActive && (
                        <span className="absolute inset-0 rounded-full border-2 border-customer status-pulse" />
                      )}
                    </div>
                    <div className="text-center">
                      <p
                        className={`text-[10px] sm:text-xs font-semibold ${
                          isActive
                            ? 'text-foreground'
                            : isCompleted
                              ? 'text-customer'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {step.label}
                      </p>
                      {isActive && (
                        <p className="text-xs text-muted-foreground mt-0.5 hidden md:block">
                          {status === 'READY' ? 'Ready for rider pickup' : step.desc}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {showRider && (
            <div className="px-4 sm:px-6 pb-4 sm:pb-5 flex items-center justify-between border-t border-border pt-3 sm:pt-4 gap-3">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Bike className="w-4 h-4 sm:w-5 sm:h-5 text-rider" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {status === 'OUT_FOR_DELIVERY'
                      ? order?.riderName || 'Rider assigned'
                      : status === 'READY' || status === 'PREPARING'
                        ? 'Awaiting rider assignment'
                        : 'Rider assigned'}
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {status === 'OUT_FOR_DELIVERY' ? '⭐ 4.9' : 'Pickup soon'}
                    </span>
                  </div>
                </div>
              </div>
              {status === 'OUT_FOR_DELIVERY' && (
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  <button
                    type="button"
                    className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold bg-muted rounded-lg hover:bg-border transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Call</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold bg-muted rounded-lg hover:bg-border transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Message</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
