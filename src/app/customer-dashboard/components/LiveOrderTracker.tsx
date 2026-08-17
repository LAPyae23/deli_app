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
} from 'lucide-react';
import { toast } from 'sonner';
import ChatWidget from '@/components/ChatWidget';
import { CUSTOMER_TO_RIDER_QUICK_REPLIES } from '@/lib/support';

const LiveTrackerMap = dynamic(() => import('./LiveTrackerMap'), {
  ssr: false,
  loading: () => (
    <div className="mt-4 flex h-[250px] w-full items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

const MOCK_COORDS = {
  restaurant: { lat: 16.82, lng: 96.145 },
  customer: { lat: 16.8409, lng: 96.1735 },
};

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
  restaurantId?: string;
  status?: OrderStatus;
  prepTime?: number;
  travelMins?: number;
  durationMins?: number;
  items?: Array<{ name?: string; quantity?: number }>;
  restaurantCoords?: { lat?: number; lng?: number };
  deliveryAddress?: { lat?: number; lng?: number; address?: string };
  riderCoords?: { lat?: number; lng?: number };
  riderId?: string;
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

function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function riderFallbackForStatus(_status: string, restaurant: LatLng): LatLng {
  return { ...restaurant };
}

/** ETA minutes from order prep + travel (falls back to durationMins) */
function computeEtaMinutes(order?: TrackedOrder | null): number {
  if (!order) return 0;
  const prep = Number(order.prepTime);
  const travel = Number(order.travelMins);
  const duration = Number(order.durationMins);

  if (Number.isFinite(prep) && prep >= 0 && Number.isFinite(travel) && travel >= 0) {
    return Math.max(1, Math.round(prep + travel));
  }
  if (Number.isFinite(duration) && duration > 0) {
    return Math.round(duration);
  }
  if (Number.isFinite(prep) && prep > 0) {
    return Math.round(prep + 15);
  }
  return 30;
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

function notifyOrdersUpdated() {
  window.dispatchEvent(new CustomEvent('fooddash:orders-updated'));
}

export default function LiveOrderTracker({ activeOrderId, onDismiss }: LiveOrderTrackerProps) {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [riderLocation, setRiderLocation] = useState<LatLng>(FALLBACK_RESTAURANT);
  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState<string | null>(null);
  const [riderRating, setRiderRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const syncedPrepRef = useRef<number | null>(null);
  const logoFetchedFor = useRef<string | null>(null);

  useEffect(() => {
    setSessionId(localStorage.getItem('fooddash_session_id') || '');
  }, []);

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
          const customer = parseCoords(
            nextOrder?.deliveryAddress?.lat,
            nextOrder?.deliveryAddress?.lng,
            FALLBACK_CUSTOMER
          );

          const riderLat = Number(nextOrder?.riderCoords?.lat);
          const riderLng = Number(nextOrder?.riderCoords?.lng);
          if (Number.isFinite(riderLat) && Number.isFinite(riderLng)) {
            setRiderLocation({ lat: riderLat, lng: riderLng });
          } else {
            setRiderLocation(riderFallbackForStatus(status, restaurant));
          }

          const travelFromOrder = Number(nextOrder?.travelMins);
          const etaFromOrder = computeEtaMinutes(nextOrder);

          if (status === 'PREPARING' || status === 'READY' || status === 'PENDING' || status === 'PLACED') {
            const totalEta = etaFromOrder * 60;
            if (syncedPrepRef.current !== totalEta) {
              syncedPrepRef.current = totalEta;
              setEtaSeconds(totalEta);
            }
          } else if (status === 'OUT_FOR_DELIVERY') {
            const riderPos =
              Number.isFinite(riderLat) && Number.isFinite(riderLng)
                ? { lat: riderLat, lng: riderLng }
                : restaurant;
            const riderDistKm = haversineKm(riderPos, customer);
            const travelMins =
              Number.isFinite(travelFromOrder) && travelFromOrder > 0
                ? travelFromOrder
                : Math.max(5, Math.round(riderDistKm * 3));
            const riderTimeSeconds = travelMins * 60;
            setEtaSeconds((prev) =>
              Math.abs(prev - riderTimeSeconds) > 30 ? riderTimeSeconds : prev
            );
          }

          // Fetch restaurant logo once per restaurantId
          const rid = String(nextOrder?.restaurantId || '').trim();
          if (rid && logoFetchedFor.current !== rid) {
            logoFetchedFor.current = rid;
            try {
              const logoRes = await fetch(
                `/api/restaurant/profile?restaurantId=${encodeURIComponent(rid)}`
              );
              const logoData = await logoRes.json();
              if (logoRes.ok && logoData.success && logoData.profile?.logoImage) {
                if (!cancelled) setRestaurantLogoUrl(String(logoData.profile.logoImage));
              }
            } catch {
              // keep fallback store icon
            }
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

  const cancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;

    setIsCancelling(true);
    try {
      const res = await fetch(`/api/orders/${activeOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CANCELLED',
          cancelReason: 'Cancelled by customer',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to cancel order');
      }
      toast.success('Order cancelled');
      setOrder((prev) => (prev ? { ...prev, status: 'CANCELLED' } : prev));
      notifyOrdersUpdated();
      handleDismiss();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const submitReview = async () => {
    setIsSubmittingReview(true);
    try {
      const res = await fetch(`/api/orders/${activeOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderRating, reviewComment }),
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
  const canCancel = status === 'PENDING' || status === 'PREPARING';
  const isRejected = status === 'REJECTED' || status === 'CANCELLED';
  const activeStepIndex = statusToStepIndex(status);
  const showRider = status === 'OUT_FOR_DELIVERY' || status === 'READY' || status === 'PREPARING';
  const showRiderOnMap = status === 'OUT_FOR_DELIVERY';

  const etaMinutes = Math.floor(etaSeconds / 60);
  const etaSecsRem = etaSeconds % 60;
  const mapEtaMinutes = useMemo(() => computeEtaMinutes(order), [order]);

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
              Delivery Complete! How was your Rider?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Rate your delivery experience. You can rate the restaurant from its menu page.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/40">
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
                placeholder="Leave a comment for your rider..."
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
    <>
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
                Arrives in
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

      <div className="relative z-0 px-4 sm:px-6">
        <div className="mt-4 h-[280px] w-full overflow-hidden rounded-xl border border-border sm:h-[320px]">
          <LiveTrackerMap
            restaurantLocation={
              order?.restaurantCoords?.lat != null && order?.restaurantCoords?.lng != null
                ? restaurantLocation
                : MOCK_COORDS.restaurant
            }
            customerLocation={
              order?.deliveryAddress?.lat != null && order?.deliveryAddress?.lng != null
                ? customerLocation
                : MOCK_COORDS.customer
            }
            riderLocation={riderLocation}
            showRider={showRiderOnMap}
            restaurantLogoUrl={restaurantLogoUrl}
            restaurantName={order?.restaurantName || 'Restaurant'}
            etaMinutes={mapEtaMinutes}
            status={String(status || 'PENDING')}
          />
        </div>
        {isPending && (
          <div className="absolute inset-0 z-10 mt-4 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/50 px-6 text-center backdrop-blur-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950/50">
              <Loader2 className="h-7 w-7 animate-spin text-customer" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">
                Waiting for restaurant to confirm…
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {order?.restaurantName || 'The restaurant'} will accept or decline shortly.
              </p>
            </div>
          </div>
        )}
      </div>

      {!isPending && (
        <>
          <div className="px-4 sm:px-6 py-4 sm:py-5">
            <div className="relative flex items-start justify-between sm:items-center">
              <div className="absolute left-0 right-0 top-4 mx-6 h-0.5 bg-border sm:top-5 sm:mx-8" />
              <div
                className="absolute left-6 top-4 h-0.5 bg-customer transition-all duration-700 sm:left-8 sm:top-5"
                style={{
                  width: `${(activeStepIndex / (ORDER_STEPS.length - 1)) * 100}%`,
                  maxWidth: 'calc(100% - 3rem)',
                }}
              />
              {ORDER_STEPS.map((step, i) => {
                const isCompleted = i < activeStepIndex;
                const isActive = i === activeStepIndex;
                return (
                  <div
                    key={step.key}
                    className="relative z-10 flex flex-col items-center gap-1.5 sm:gap-2"
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 sm:h-10 sm:w-10 ${
                        isCompleted
                          ? 'border-customer bg-customer'
                          : isActive
                            ? 'border-customer bg-orange-50'
                            : 'border-border bg-card'
                      }`}
                    >
                      <step.icon
                        className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
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
                        className={`text-[10px] font-semibold sm:text-xs ${
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
                        <p className="mt-0.5 hidden text-xs text-muted-foreground md:block">
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
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 pb-4 pt-3 sm:px-6 sm:pb-5 sm:pt-4">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 sm:h-10 sm:w-10">
                  <Bike className="h-4 w-4 text-rider sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
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
                <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-2 text-xs font-semibold transition-colors hover:bg-border sm:gap-1.5 sm:px-3"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Call</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => order?.riderId && setChatOpen(true)}
                    disabled={!order?.riderId}
                    className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-2 text-xs font-semibold transition-colors hover:bg-border disabled:opacity-50 sm:gap-1.5 sm:px-3"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Message</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {canCancel && (
        <div className="border-t border-border px-4 py-4 sm:px-6">
          <button
            type="button"
            disabled={isCancelling}
            onClick={cancelOrder}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-danger px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isCancelling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cancelling…
              </>
            ) : (
              'Cancel Order'
            )}
          </button>
        </div>
      )}
    </div>

    {order?.riderId && sessionId && (
      <ChatWidget
        currentUserId={sessionId}
        currentUserRole="CUSTOMER"
        targetUserId={order.riderId}
        targetUserRole="RIDER"
        targetName={order.riderName || 'Rider'}
        orderId={activeOrderId}
        open={chatOpen}
        onOpenChange={setChatOpen}
        quickReplies={[...CUSTOMER_TO_RIDER_QUICK_REPLIES]}
        accentClassName="bg-customer"
      />
    )}
    </>
  );
}
