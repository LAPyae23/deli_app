'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Bike, Home, DollarSign, ClipboardList, Settings, LogOut,
  MapPin, Phone, MessageCircle, Clock, Star, Navigation,
  CheckCircle, X, TrendingUp, Route, Wallet,
  UtensilsCrossed, Map as MapIcon, Save, Camera, User, Lock,
  AlertTriangle, Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import AppLogo from '@/components/ui/AppLogo';
import ChatWidget from '@/components/ChatWidget';
import NotificationBell, { type BellNotificationItem } from '@/components/NotificationBell';
import AppImage from '@/components/ui/AppImage';
import Link from 'next/link';
import { formatKyat } from '@/lib/currency';
import {
  dashboardChartMeta,
  dashboardPeriodLabel,
  dashboardSummaryTitle,
  type DashboardRange,
} from '@/lib/dashboardRange';
import DashboardRangeToggle from '@/components/DashboardRangeToggle';
import {
  SUPPORT_ADMIN_ID,
  SUPPORT_ADMIN_NAME,
  SUPPORT_ADMIN_ROLE,
  RIDER_TO_CUSTOMER_QUICK_REPLIES,
  RIDER_TO_RESTAURANT_QUICK_REPLIES,
} from '@/lib/support';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import EarningsChart from './EarningsChart';
import PredictiveHeatmap from './PredictiveHeatmap';

const RiderRouteMap = dynamic(() => import('./RiderRouteMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

const RiderIdleMap = dynamic(() => import('./RiderIdleMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
      Loading map...
    </div>
  ),
});

const MOCK_COORDS = {
  rider: { lat: 16.79, lng: 96.15 },
  restaurant: { lat: 16.82, lng: 96.145 },
  customer: { lat: 16.8409, lng: 96.1735 },
};

type DutyStatus = 'OFFLINE' | 'AVAILABLE' | 'DELIVERING';
type RiderTab = 'home' | 'routes' | 'earnings' | 'trips' | 'settings';
type RouteStopType = 'FOOD';
type RouteStopStatus = 'COMPLETED' | 'CURRENT' | 'UPCOMING';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const DISPATCH_POLL_MS = 10_000;

interface DispatchOrder {
  id: string;
  orderNumber: string;
  restaurant: string;
  restaurantId: string;
  restaurantAddr: string;
  customerAddr: string;
  customerId: string;
  customerName: string;
  pickupDistance: string;
  dropDistance: string;
  estimatedEarnings: number;
  estimatedTip: number;
  items: number;
  restaurantCoords: { lat: number; lng: number };
  customerCoords: { lat: number; lng: number };
}

type RiderProfileForm = {
  name: string;
  phone: string;
  vehicle: string;
  licensePlate: string;
  profileImage: string;
};

const INITIAL_PROFILE: RiderProfileForm = {
  name: '',
  phone: '',
  vehicle: '',
  licensePlate: '',
  profileImage: '',
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function mapApiOrderToDispatch(raw: Record<string, unknown>): DispatchOrder {
  const items = Array.isArray(raw.items) ? (raw.items as Array<{ quantity?: number }>) : [];
  const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const totals = (raw.totals || {}) as { total?: number; deliveryFee?: number };
  const deliveryAddress = (raw.deliveryAddress || {}) as {
    address?: string;
    lat?: number;
    lng?: number;
  };
  const restaurantCoordsRaw = (raw.restaurantCoords || {}) as { lat?: number; lng?: number };

  const restaurantCoords = {
    lat: Number(restaurantCoordsRaw.lat) || 16.8409,
    lng: Number(restaurantCoordsRaw.lng) || 96.1735,
  };
  const customerCoords = {
    lat: Number(deliveryAddress.lat) || 16.8564,
    lng: Number(deliveryAddress.lng) || 96.1821,
  };
  const dropKm = haversineKm(restaurantCoords, customerCoords);
  const total = Number(totals.total) || 0;
  const deliveryFee = Number(totals.deliveryFee) || 0;

  return {
    id: String(raw._id ?? ''),
    orderNumber: String(raw.orderNumber || ''),
    restaurant: String(raw.restaurantName || 'Restaurant'),
    restaurantId: String(raw.restaurantId || ''),
    restaurantAddr: String(raw.restaurantName || 'Restaurant pickup'),
    customerAddr: String(deliveryAddress.address || 'Customer address'),
    customerId: String(raw.customerId || ''),
    customerName: String(raw.customerName || 'Customer'),
    pickupDistance: 'Nearby',
    dropDistance: `${dropKm.toFixed(1)} km`,
    estimatedEarnings:
      deliveryFee > 0 ? Math.round(deliveryFee * 0.9) : Math.max(1500, Math.round(total * 0.12)),
    estimatedTip: Math.max(0, Math.round(total * 0.05)),
    items: itemCount || 1,
    restaurantCoords,
    customerCoords,
  };
}

interface RouteStop {
  id: string;
  type: RouteStopType;
  location: string;
  address: string;
  status: RouteStopStatus;
  timeWindow: string;
  customerName: string;
  ref?: string;
  notes?: string;
}

const ROUTE_TYPE_META: Record<
  RouteStopType,
  { label: string; icon: React.ElementType; badge: string; node: string; ring: string }
> = {
  FOOD: {
    label: 'Food',
    icon: UtensilsCrossed,
    badge: 'bg-orange-50 text-orange-600 border-orange-200',
    node: 'bg-orange-500',
    ring: 'ring-orange-200',
  },
};

const NAV_ITEMS: { key: string; label: string; icon: React.ElementType; id: RiderTab }[] = [
  { key: 'rnav-home', label: 'Home', icon: Home, id: 'home' },
  { key: 'rnav-routes', label: 'Routes', icon: MapIcon, id: 'routes' },
  { key: 'rnav-earnings', label: 'Earnings', icon: DollarSign, id: 'earnings' },
  { key: 'rnav-trips', label: 'Trips', icon: ClipboardList, id: 'trips' },
  { key: 'rnav-settings', label: 'Settings', icon: Settings, id: 'settings' },
];

const INITIAL_RIDER_POS = { lat: 16.8409, lng: 96.1735 };
const REMITTANCE_PRESETS = [10_000, 20_000, 50_000, 100_000];
type RemittanceMethod = 'KBZPay' | 'WavePay';

function isBrowser() {
  return typeof window !== 'undefined';
}

/** Absolute same-origin URL — relative `/api/...` fails during SSR (Failed to fetch). */
function clientApiUrl(path: string) {
  if (!isBrowser()) return path;
  return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
}

async function readJsonSafe(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/* ─── Shared UI atoms ─────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
      {children}
    </p>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md sm:p-5">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl sm:mb-4 sm:h-10 sm:w-10 ${accent}`}>
        <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
      </div>
      <p className="text-xl font-bold leading-none tracking-tight text-slate-900 font-tabular sm:text-2xl">{value}</p>
      <p className="mt-1.5 text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

function ContactRow({
  title,
  subtitle,
  label,
  onMessage,
}: {
  title: string;
  subtitle: string;
  label: string;
  onMessage?: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:text-rider"
            aria-label="Call"
          >
            <Phone className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMessage}
            disabled={!onMessage}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:text-rider disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Message"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Dashboard ──────────────────────────────────────────── */

export default function RiderDashboardClient() {
  const [dutyStatus, setDutyStatus] = useState<DutyStatus>('AVAILABLE');
  const [incomingDispatch, setIncomingDispatch] = useState<DispatchOrder | null>(null);
  const [dispatchTimer, setDispatchTimer] = useState(30);
  const [activeDeliveries, setActiveDeliveries] = useState<
    (DispatchOrder & { deliveryStatus: 'ACCEPTED' | 'PICKED_UP' })[]
  >([]);
  const [activeTab, setActiveTab] = useState<RiderTab>('home');
  const [riderPos, setRiderPos] = useState(INITIAL_RIDER_POS);
  const [accepting, setAccepting] = useState(false);
  const [profile, setProfile] = useState<RiderProfileForm>(INITIAL_PROFILE);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [remittanceOpen, setRemittanceOpen] = useState(false);
  const [remittanceMethod, setRemittanceMethod] = useState<RemittanceMethod>('KBZPay');
  const [remittanceAmount, setRemittanceAmount] = useState('');
  const [remitting, setRemitting] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);
  const [chatPeer, setChatPeer] = useState<'customer' | 'restaurant'>('customer');
  const [supportOpen, setSupportOpen] = useState(false);
  const [statsRange, setStatsRange] = useState<DashboardRange>('7d');
  const playNotification = useNotificationSound();

  const showDispatch =
    !!incomingDispatch &&
    dutyStatus !== 'OFFLINE' &&
    activeDeliveries.length < 2 &&
    !isBlocked;

  useEffect(() => {
    if (isBlocked) setIncomingDispatch(null);
  }, [isBlocked]);

  useEffect(() => {
    if (!isBrowser()) return;
    const role = window.localStorage.getItem('fooddash_session_role');
    if (role !== 'RIDER') {
      window.location.href = '/';
    }
  }, []);

  useEffect(() => {
    if (!isBrowser()) return;
    setSessionId(window.localStorage.getItem('fooddash_session_id') || '');
  }, []);

  useEffect(() => {
    if (!isBrowser()) return;
    let cancelled = false;

    async function restoreActiveDeliveries() {
      const riderId = window.localStorage.getItem('fooddash_session_id') || '';
      if (!riderId) return;

      try {
        const res = await fetch(
          `/api/orders?riderId=${encodeURIComponent(riderId)}&limit=10`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (!res.ok || !data.success || cancelled) return;

        const orders = Array.isArray(data.orders) ? data.orders : [];
        const restored = orders
          .filter((raw: Record<string, unknown>) => {
            const status = String(raw.status || '').toUpperCase();
            return status === 'PREPARING' || status === 'READY' || status === 'OUT_FOR_DELIVERY';
          })
          .map((raw: Record<string, unknown>) => {
            const mapped = mapApiOrderToDispatch(raw);
            const status = String(raw.status || '').toUpperCase();
            return {
              ...mapped,
              deliveryStatus:
                status === 'OUT_FOR_DELIVERY' ? ('PICKED_UP' as const) : ('ACCEPTED' as const),
            };
          })
          .filter((order: { id: string }) => Boolean(order.id));

        if (cancelled) return;
        setActiveDeliveries(restored);
        if (restored.length > 0) {
          setDutyStatus((prev) => (prev === 'OFFLINE' ? prev : 'DELIVERING'));
          setActiveTab('routes');
        }
      } catch (error) {
        console.warn('Failed to restore active deliveries', error);
      }
    }

    restoreActiveDeliveries();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!isBrowser()) return;
    try {
      const riderId = window.localStorage.getItem('fooddash_session_id');
      if (!riderId) return;

      const res = await fetch(
        clientApiUrl(
          `/api/rider/dashboard?riderId=${encodeURIComponent(riderId)}&range=${statsRange}`
        ),
        { cache: 'no-store' }
      );
      const data = await readJsonSafe(res);
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.message || `Dashboard request failed (${res.status})`));
      }
      setDashboardData(data);
      setDashboardError(null);
      const wallet = data.wallet as { walletBalance?: number; isBlocked?: boolean } | undefined;
      if (wallet) {
        setWalletBalance(Number(wallet.walletBalance) || 0);
        setIsBlocked(wallet.isBlocked === true);
      }
    } catch (e) {
      console.error('Failed to load rider dashboard', e);
      setDashboardError(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }, [statsRange]);

  const loadRoutes = useCallback(async () => {
    if (!isBrowser()) return;
    try {
      const riderId = window.localStorage.getItem('fooddash_session_id');
      if (!riderId) return;

      const res = await fetch(
        clientApiUrl(`/api/rider/routes?riderId=${encodeURIComponent(riderId)}`),
        { cache: 'no-store' }
      );
      const data = await readJsonSafe(res);
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.message || `Routes request failed (${res.status})`));
      }
      setRouteStops(Array.isArray(data.routes) ? (data.routes as RouteStop[]) : []);
      setRoutesError(null);
    } catch (e) {
      console.error('Failed to load rider routes', e);
      setRoutesError(e instanceof Error ? e.message : 'Failed to load routes');
    }
  }, []);

  useEffect(() => {
    if (!isBrowser()) return;
    void loadDashboard();
    void loadRoutes();
    const interval = window.setInterval(() => {
      void loadDashboard();
      void loadRoutes();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [loadDashboard, loadRoutes]);

  // Load rider profile
  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setProfileLoading(true);
      try {
        const sessionId = localStorage.getItem('fooddash_session_id');
        if (!sessionId) {
          if (!cancelled) setProfileLoading(false);
          return;
        }

        const res = await fetch(
          `/api/rider/profile?riderId=${encodeURIComponent(sessionId)}`
        );
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load');
        if (!cancelled && data.profile) {
          setProfile({
            name: data.profile.name || '',
            phone: data.profile.phone || '',
            vehicle: data.profile.vehicle || '',
            licensePlate: data.profile.licensePlate || '',
            profileImage: data.profile.profileImage || '',
          });
          // Sync local duty toggle with RiderProfile.status (Offline riders get no dispatch)
          if (String(data.profile.status) === 'Offline') {
            setDutyStatus('OFFLINE');
            setIncomingDispatch(null);
          } else if (String(data.profile.status) === 'Online') {
            setDutyStatus((prev) => (prev === 'DELIVERING' ? prev : 'AVAILABLE'));
          }
          if (data.profile.walletBalance != null) {
            setWalletBalance(Number(data.profile.walletBalance) || 0);
          }
          if (typeof data.profile.isBlocked === 'boolean') {
            setIsBlocked(data.profile.isBlocked);
          }
        }
      } catch (error) {
        console.warn(error);
        if (!cancelled) toast.error('Failed to load rider profile');
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll for available dispatch orders (skipped when Offline, blocked, or at capacity)
  useEffect(() => {
    if (dutyStatus === 'OFFLINE' || isBlocked) return;
    if (activeDeliveries.length >= 2) return;

    let cancelled = false;
    const riderId = localStorage.getItem('fooddash_session_id') || '';
    const takenIds = new Set(activeDeliveries.map((d) => d.id));

    async function pollAvailableOrders() {
      if (activeDeliveries.length >= 2) return;
      try {
        // Server returns [] if this rider is Offline
        const params = new URLSearchParams({
          status: 'PREPARING',
          unassigned: 'true',
          limit: '20',
        });
        if (riderId) params.set('forRiderId', riderId);

        const res = await fetch(`/api/orders?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || !data.success || cancelled) return;

        const orders = Array.isArray(data.orders) ? data.orders : [];
        const nextRaw = orders.find((raw: Record<string, unknown>) => {
          const id = String(raw._id ?? '');
          return id && !takenIds.has(id);
        });
        if (!nextRaw) {
          setIncomingDispatch(null);
          return;
        }

        const mapped = mapApiOrderToDispatch(nextRaw as Record<string, unknown>);
        if (!mapped.id) return;

        setIncomingDispatch((prev) => {
          if (prev?.id === mapped.id) return prev;
          setDispatchTimer(30);
          playNotification();
          return mapped;
        });
      } catch (error) {
        console.warn(error);
      }
    }

    pollAvailableOrders();
    const interval = setInterval(pollAvailableOrders, DISPATCH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [dutyStatus, activeDeliveries, playNotification, isBlocked]);

  useEffect(() => {
    if (!showDispatch) return;
    const interval = setInterval(() => {
      setDispatchTimer((t) => {
        if (t <= 1) {
          setIncomingDispatch(null);
          toast.error('Dispatch request expired');
          return 30;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showDispatch]);

  useEffect(() => {
    if (dutyStatus === 'OFFLINE') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocation is not supported on this device');
      return;
    }

    const orderIds = activeDeliveries.map((d) => d.id);
    let lastPatchAt = 0;
    const PATCH_INTERVAL_MS = 8_000;
    let cancelled = false;

    const patchRiderCoords = async (lat: number, lng: number) => {
      if (orderIds.length === 0) return;
      const now = Date.now();
      if (now - lastPatchAt < PATCH_INTERVAL_MS) return;
      lastPatchAt = now;
      await Promise.all(
        orderIds.map(async (orderId) => {
          try {
            await fetch(`/api/orders/${orderId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ riderCoords: { lat, lng } }),
            });
          } catch (error) {
            console.warn('Failed to update rider coords:', error);
          }
        })
      );
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (cancelled) return;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setRiderPos({ lat, lng });
        void patchRiderCoords(lat, lng);
      },
      (error) => {
        console.warn(error);
        toast.error('Unable to access GPS. Allow location access for live tracking.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [dutyStatus, activeDeliveries]);

  const toggleDuty = async () => {
    if (activeDeliveries.length > 0) {
      toast.error('Finish your current delivery before going offline');
      return;
    }
    const next = dutyStatus === 'OFFLINE' ? 'AVAILABLE' : 'OFFLINE';
    const profileStatus = next === 'AVAILABLE' ? 'Online' : 'Offline';
    const riderId = localStorage.getItem('fooddash_session_id') || '';

    setDutyStatus(next);
    if (next === 'OFFLINE') setIncomingDispatch(null);

    try {
      if (riderId) {
        await fetch('/api/rider/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            riderId,
            name: profile.name,
            phone: profile.phone,
            vehicle: profile.vehicle,
            licensePlate: profile.licensePlate,
            profileImage: profile.profileImage,
            status: profileStatus,
          }),
        });
      }
      toast.success(
        next === 'AVAILABLE'
          ? 'You are now online — ready for dispatch'
          : 'You are now offline — no new dispatches'
      );
    } catch {
      toast.error('Could not sync online status');
    }
  };

  const acceptDispatch = async () => {
    if (!incomingDispatch) return;
    if (activeDeliveries.length >= 2) {
      toast.error('You already have 2 active orders');
      return;
    }
    setAccepting(true);
    try {
      const res = await fetch(`/api/orders/${incomingDispatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'OUT_FOR_DELIVERY',
          riderId: localStorage.getItem('fooddash_session_id') || 'unknown',
          riderName: profile.name.trim() || 'Rider',
          riderCoords: incomingDispatch.restaurantCoords,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to accept');

      setActiveDeliveries((prev) => [
        ...prev,
        { ...incomingDispatch, deliveryStatus: 'ACCEPTED' },
      ]);
      setRiderPos(MOCK_COORDS.rider);
      setIncomingDispatch(null);
      setDutyStatus('DELIVERING');
      setActiveTab('routes');
      toast.success(`Dispatch accepted — heading to ${incomingDispatch.restaurant}`);
      void loadRoutes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept dispatch');
    } finally {
      setAccepting(false);
    }
  };

  const declineDispatch = () => {
    setIncomingDispatch(null);
    setDispatchTimer(30);
    toast.info('Dispatch declined');
  };

  const markPickedUp = async (orderId: string) => {
    const order = activeDeliveries.find((d) => d.id === orderId);
    if (!order) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'OUT_FOR_DELIVERY' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update status');

      setActiveDeliveries((prev) =>
        prev.map((d) =>
          d.id === orderId ? { ...d, deliveryStatus: 'PICKED_UP' } : d
        )
      );
      setRiderPos(
        order.restaurantCoords?.lat
          ? order.restaurantCoords
          : MOCK_COORDS.restaurant
      );
      toast.success('Order picked up — heading to customer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark picked up');
    }
  };

  const markDelivered = async (orderId: string) => {
    const order = activeDeliveries.find((d) => d.id === orderId);
    if (!order) return;
    try {
      const baseRiderFee = order.estimatedEarnings || 0;
      const tipAmount = order.estimatedTip || 0;
      const distanceKm = parseFloat(order.dropDistance) || 0;
      const durationMins = 25; // Average static duration for now

      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'DELIVERED',
          baseRiderFee,
          tipAmount,
          distanceKm,
          durationMins,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update status');

      const remaining = activeDeliveries.filter((d) => d.id !== orderId);
      setActiveDeliveries(remaining);
      if (remaining.length === 0) {
        setRiderPos(INITIAL_RIDER_POS);
        setDutyStatus('AVAILABLE');
        setDispatchTimer(30);
      }
      toast.success('Delivery completed! Great job 🎉');
      if (data.riderWallet) {
        setWalletBalance(Number(data.riderWallet.walletBalance) || 0);
        setIsBlocked(data.riderWallet.isBlocked === true);
      }
      void loadDashboard();
      void loadRoutes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark delivered');
    }
  };

  const openRemittanceModal = () => {
    setRemittanceMethod('KBZPay');
    setRemittanceAmount('');
    setRemittanceOpen(true);
  };

  const submitRemittance = async () => {
    if (!isBrowser()) return;
    const riderId = window.localStorage.getItem('fooddash_session_id');
    if (!riderId) {
      toast.error('Please sign in again');
      return;
    }
    const amount = Number(String(remittanceAmount).replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid deposit amount');
      return;
    }
    setRemitting(true);
    try {
      const res = await fetch(clientApiUrl('/api/rider/remittance'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId,
          amount: Math.round(amount),
          method: remittanceMethod,
        }),
      });
      const data = await readJsonSafe(res);
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.message || 'Remittance failed'));
      }
      setWalletBalance(Number(data.walletBalance) || 0);
      setIsBlocked(data.isBlocked === true);
      setRemittanceOpen(false);
      setRemittanceAmount('');
      toast.success(
        data.isBlocked
          ? `Deposited ${formatKyat(amount)}. Still below the -50,000 Ks limit.`
          : `Deposited ${formatKyat(amount)} via ${remittanceMethod}. Account is active.`
      );
      void loadDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to deposit');
    } finally {
      setRemitting(false);
    }
  };

  const handleProfileImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image size should be less than 2MB');
      return;
    }
    try {
      const base64 = await readFileAsBase64(file);
      setProfile((prev) => ({ ...prev, profileImage: base64 }));
    } catch {
      toast.error('Failed to read image');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.name.trim()) {
      toast.error('Name is required');
      return;
    }
    const sessionId = localStorage.getItem('fooddash_session_id');
    if (!sessionId) {
      toast.error('Please sign in again');
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch('/api/rider/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId: sessionId,
          name: profile.name.trim(),
          phone: profile.phone.trim(),
          vehicle: profile.vehicle.trim(),
          licensePlate: profile.licensePlate.trim(),
          profileImage: profile.profileImage,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Save failed');
      toast.success('Rider profile saved');
      window.dispatchEvent(
        new CustomEvent('fooddash:rider-profile-updated', {
          detail: { profileImage: profile.profileImage, name: profile.name.trim() },
        })
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const navigateToStop = (stop: RouteStop) => {
    toast.success(`Navigating to ${stop.location} — ${stop.address}`);
  };

  const weeklyEarnings = Number(dashboardData?.weeklyStats?.weeklyEarnings) || 0;
  const weeklyTrips = Number(dashboardData?.weeklyStats?.weeklyTrips) || 0;
  const weeklyDistance = Number(dashboardData?.weeklyStats?.weeklyDistance) || 0;
  const weeklyTips = Number(dashboardData?.weeklyStats?.weeklyTips) || 0;
  const weeklyChart = Array.isArray(dashboardData?.weeklyChartData)
    ? dashboardData.weeklyChartData
    : [];
  const periodLabel = dashboardPeriodLabel(statsRange);
  const summaryTitle = dashboardSummaryTitle(statsRange);
  const chartMeta = dashboardChartMeta(statsRange);
  const chartTitle = chartMeta.title;
  const chartSubtitle = chartMeta.subtitle;
  const weeklyTotal =
    weeklyChart.reduce(
      (s: number, d: { earnings: number }) => s + (Number(d.earnings) || 0),
      0
    ) || 0;

  const safeRouteStops = Array.isArray(routeStops) ? routeStops : [];
  const completedStops = safeRouteStops.filter((s) => s.status === 'COMPLETED').length;
  const currentStop = safeRouteStops.find((s) => s.status === 'CURRENT');
  const upcomingStops = safeRouteStops.filter((s) => s.status === 'UPCOMING').length;
  const foodStops = safeRouteStops.filter((s) => s.type === 'FOOD').length;

  const chatDelivery =
    activeDeliveries.find((d) => d.id === chatOrderId) ||
    activeDeliveries.find((d) => d.customerId || d.restaurantId) ||
    null;
  const chatTargetId =
    chatPeer === 'restaurant'
      ? chatDelivery?.restaurantId || ''
      : chatDelivery?.customerId || '';

  const dutyLabel =
    dutyStatus === 'OFFLINE' ? 'Go Online' : dutyStatus === 'AVAILABLE' ? 'Online' : 'Delivering';

  const renderNavButtons = (variant: 'sidebar' | 'bottom') => (
    <>
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        if (variant === 'sidebar') {
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-rider/10 text-rider'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </button>
          );
        }
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition-all duration-200 ${
              isActive ? 'text-rider' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {isActive && <span className="absolute inset-0 rounded-xl bg-rider/10" />}
            <item.icon className={`relative z-10 h-[18px] w-[18px] ${isActive ? 'scale-105' : ''} transition-transform`} />
            <span className="relative z-10 text-[10px] font-semibold">{item.label}</span>
          </button>
        );
      })}
      {variant === 'sidebar' ? (
        <a
          href="/"
          className="mt-auto flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-500 transition-all duration-150 hover:bg-slate-100 hover:text-slate-800"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign Out
        </a>
      ) : (
        <a
          href="/"
          className="flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-slate-400 transition-all duration-200 hover:text-slate-600"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span className="text-[10px] font-semibold">Sign Out</span>
        </a>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl lg:gap-0">

        {/* ── Desktop sidebar ──────────────────────────────────── */}
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex xl:w-60">
          <div className="mb-8 flex items-center gap-2.5 px-2">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
              <AppLogo size={26} />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-slate-900">Rider</p>
              <p className="text-[11px] font-medium text-slate-400">Fleet Dashboard</p>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {renderNavButtons('sidebar')}
          </nav>
        </aside>

        {/* ── Main column ──────────────────────────────────────── */}
        <div className="relative flex min-w-0 flex-1 flex-col">

          {/* Header */}
          <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8 pt-safe">
            <div className="flex items-center gap-3">
              <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
                {profile.profileImage?.trim() ? (
                  <AppImage
                    key={profile.profileImage}
                    src={profile.profileImage}
                    alt={profile.name || 'Rider'}
                    width={40}
                    height={40}
                    className="h-10 w-10 object-cover"
                    unoptimized
                  />
                ) : (
                  <AppLogo size={28} />
                )}
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight tracking-tight text-slate-900 sm:text-[15px]">
                  {profile.name.trim() || 'Rider'}
                </p>
                <div className="mt-0.5 flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="text-[11px] font-medium text-slate-500 font-tabular">4.92 · 1,247 trips</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <NotificationBell
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800"
                iconClassName="h-4 w-4"
                showDot={Boolean(showDispatch && incomingDispatch) || activeDeliveries.length > 0}
                items={
                  [
                    ...(showDispatch && incomingDispatch
                      ? [
                          {
                            id: incomingDispatch.id,
                            title: 'New dispatch request',
                            body: `${incomingDispatch.restaurant} · ${incomingDispatch.orderNumber}`,
                            onClick: () => setActiveTab('routes'),
                          } satisfies BellNotificationItem,
                        ]
                      : []),
                    ...activeDeliveries.map(
                      (delivery) =>
                        ({
                          id: `active-${delivery.id}`,
                          title: 'Active delivery',
                          body: `${delivery.restaurant} → customer`,
                          onClick: () => setActiveTab('routes'),
                        }) satisfies BellNotificationItem
                    ),
                  ] as BellNotificationItem[]
                }
                emptyLabel="No dispatch alerts"
              />

              <button
                type="button"
                onClick={toggleDuty}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-200 active:scale-95 ${
                  dutyStatus !== 'OFFLINE'
                    ? 'border-success/30 bg-success/10 text-success'
                    : 'border-slate-200 bg-white text-slate-500 shadow-sm'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    dutyStatus !== 'OFFLINE' ? 'bg-success status-pulse' : 'bg-slate-300'
                  }`}
                />
                {dutyLabel}
              </button>
            </div>
          </header>

          {(dashboardError || routesError) && (
            <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 sm:mx-6 lg:mx-8">
              {dashboardError ? `Dashboard data unavailable: ${dashboardError}. Showing last known values.` : null}
              {dashboardError && routesError ? ' ' : null}
              {routesError ? `Route plan unavailable: ${routesError}.` : null}
            </div>
          )}

          {/* Content */}
          <main className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-10">

            {/* HOME */}
            {activeTab === 'home' && (
              <div className="mx-auto max-w-3xl space-y-5 lg:max-w-none">
                {isBlocked && (
                  <div className="flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3.5 text-red-800 shadow-sm ring-1 ring-red-500/20">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <p className="text-sm font-bold leading-snug">
                      Account Suspended: Wallet limit reached (-50,000 Ks). Please remit cash to receive new orders.
                    </p>
                  </div>
                )}
                <div className="animate-fade-in">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <SectionLabel>{summaryTitle}</SectionLabel>
                      <DashboardRangeToggle value={statsRange} onChange={setStatsRange} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <MetricCard
                        label="Total Earnings"
                        value={formatKyat(weeklyEarnings)}
                        sub={`${periodLabel} · base + tips`}
                        icon={Wallet}
                        accent="bg-success/10 text-success"
                      />
                      <MetricCard
                        label={`Trips ${periodLabel}`}
                        value={String(weeklyTrips)}
                        sub={periodLabel}
                        icon={Bike}
                        accent="bg-rider/10 text-rider"
                      />
                      <MetricCard
                        label="Distance"
                        value={`${Number(weeklyDistance).toFixed(1)} km`}
                        sub={`Ridden ${periodLabel.toLowerCase()}`}
                        icon={Route}
                        accent="bg-warning/10 text-warning"
                      />
                      <MetricCard
                        label={`Tips ${periodLabel}`}
                        value={formatKyat(weeklyTips)}
                        sub="Customer tips"
                        icon={Star}
                        accent="bg-amber-400/15 text-amber-500"
                      />
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
                    <div>
                      <SectionLabel>Wallet &amp; Remittance</SectionLabel>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        COD collections sit in your float until you deposit to the company
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        isBlocked
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {isBlocked ? 'Suspended' : 'Active'}
                    </span>
                  </div>
                  <div className="px-4 py-4 sm:px-5 sm:py-5">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Current balance
                        </p>
                        <p
                          className={`mt-1 text-2xl font-bold tracking-tight font-tabular sm:text-3xl ${
                            walletBalance < 0 ? 'text-red-600' : 'text-slate-900'
                          }`}
                        >
                          {formatKyat(walletBalance)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Auto-block at {formatKyat(-50000)} · negative means you owe the platform
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={openRemittanceModal}
                        className="inline-flex items-center gap-2 rounded-xl bg-rider px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-rider/90 active:scale-[0.98]"
                      >
                        <Building2 className="h-4 w-4" />
                        Deposit to Company
                      </button>
                    </div>
                  </div>
                </div>

                <PredictiveHeatmap />
              </div>
            )}

            {/* ROUTES — Food daily plan */}
            {activeTab === 'routes' && (
              <div className="mx-auto max-w-3xl space-y-5 animate-fade-in lg:max-w-none">
                {showDispatch && incomingDispatch && (
                  <div className="animate-slide-up">
                    <div className="overflow-hidden rounded-2xl border border-rider/20 bg-white shadow-md shadow-rider/5">
                      <div className="gradient-indigo relative px-5 py-4 sm:px-6">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
                        <div className="relative flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Incoming</p>
                            <p className="mt-0.5 text-base font-bold text-white sm:text-lg">New Delivery Request</p>
                            <p className="mt-0.5 text-xs text-white/75 sm:text-sm">
                              {incomingDispatch.restaurant} · {incomingDispatch.items} items · {incomingDispatch.orderNumber}
                            </p>
                          </div>
                          <div className="relative h-14 w-14 shrink-0">
                            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                              <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3.5" />
                              <circle
                                cx="28" cy="28" r="24" fill="none" stroke="white" strokeWidth="3.5"
                                strokeDasharray="150.8"
                                strokeDashoffset={150.8 * (1 - dispatchTimer / 30)}
                                strokeLinecap="round"
                                className="transition-all duration-1000"
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white font-tabular">
                              {dispatchTimer}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 px-5 py-4 sm:px-6 sm:py-5">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 flex shrink-0 flex-col items-center gap-1">
                            <div className="h-2.5 w-2.5 rounded-full bg-success ring-4 ring-success/15" />
                            <div className="h-8 w-px bg-gradient-to-b from-success/40 to-danger/40" />
                            <div className="h-2.5 w-2.5 rounded-full bg-danger ring-4 ring-danger/15" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Pickup</p>
                              <p className="mt-0.5 text-sm font-semibold text-slate-900">{incomingDispatch.restaurantAddr}</p>
                              <p className="text-xs text-slate-500 font-tabular">{incomingDispatch.pickupDistance}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Dropoff</p>
                              <p className="mt-0.5 text-sm font-semibold text-slate-900">{incomingDispatch.customerAddr}</p>
                              <p className="text-xs text-slate-500 font-tabular">{incomingDispatch.dropDistance} from pickup</p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          {[
                            { label: 'Base Pay', value: formatKyat(incomingDispatch.estimatedEarnings), className: 'text-slate-900' },
                            { label: 'Est. Tip', value: `+${formatKyat(incomingDispatch.estimatedTip)}`, className: 'text-success' },
                            { label: 'Total Est.', value: formatKyat(incomingDispatch.estimatedEarnings + incomingDispatch.estimatedTip), className: 'text-rider' },
                          ].map((cell) => (
                            <div key={cell.label} className="rounded-xl border border-slate-100 bg-slate-50 py-3 text-center">
                              <p className="text-[10px] font-medium text-slate-400">{cell.label}</p>
                              <p className={`mt-1 text-sm font-bold font-tabular ${cell.className}`}>{cell.value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="relative h-44 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner sm:h-56">
                          <RiderRouteMap
                            riderCoords={riderPos?.lat ? riderPos : MOCK_COORDS.rider}
                            restaurantCoords={
                              incomingDispatch.restaurantCoords?.lat
                                ? incomingDispatch.restaurantCoords
                                : MOCK_COORDS.restaurant
                            }
                            customerCoords={
                              incomingDispatch.customerCoords?.lat
                                ? incomingDispatch.customerCoords
                                : MOCK_COORDS.customer
                            }
                            deliveryStatus="PREVIEW"
                          />
                        </div>

                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={declineDispatch}
                            disabled={accepting}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
                          >
                            <X className="h-4 w-4" /> Decline
                          </button>
                          <button
                            type="button"
                            onClick={acceptDispatch}
                            disabled={accepting}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl gradient-indigo py-3 text-sm font-semibold text-white shadow-md shadow-rider/25 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                          >
                            <CheckCircle className="h-4 w-4" /> {accepting ? 'Accepting…' : 'Accept'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeDeliveries.map((delivery) => (
                  <div key={delivery.id} className="animate-fade-in">
                    <div className="overflow-hidden rounded-2xl border border-success/20 bg-white shadow-md shadow-success/5">
                      <div className="flex items-center gap-2.5 border-b border-success/10 bg-success/[0.06] px-5 py-3 sm:px-6">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/15">
                          <Navigation className="h-3.5 w-3.5 text-success" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-success">Active Delivery</p>
                          <p className="text-[11px] font-medium text-success/70 font-tabular">
                            {delivery.orderNumber}
                            {delivery.deliveryStatus === 'PICKED_UP' ? ' · En route to customer' : ' · Head to pickup'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4 p-4 sm:p-5">
                        <div className="relative h-52 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner sm:h-64 lg:h-72">
                          <RiderRouteMap
                            riderCoords={riderPos?.lat ? riderPos : MOCK_COORDS.rider}
                            restaurantCoords={
                              delivery.restaurantCoords?.lat
                                ? delivery.restaurantCoords
                                : MOCK_COORDS.restaurant
                            }
                            customerCoords={
                              delivery.customerCoords?.lat
                                ? delivery.customerCoords
                                : MOCK_COORDS.customer
                            }
                            deliveryStatus={delivery.deliveryStatus}
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <ContactRow
                            label="Pickup from"
                            title={delivery.restaurant}
                            subtitle={delivery.restaurantAddr}
                            onMessage={
                              delivery.restaurantId
                                ? () => {
                                    setChatOrderId(delivery.id);
                                    setChatPeer('restaurant');
                                    setChatOpen(true);
                                  }
                                : undefined
                            }
                          />
                          <ContactRow
                            label="Deliver to"
                            title={delivery.customerName || 'Customer'}
                            subtitle={delivery.customerAddr}
                            onMessage={
                              delivery.customerId
                                ? () => {
                                    setChatOrderId(delivery.id);
                                    setChatPeer('customer');
                                    setChatOpen(true);
                                  }
                                : undefined
                            }
                          />
                        </div>

                        {delivery.deliveryStatus === 'ACCEPTED' ? (
                          <button
                            type="button"
                            onClick={() => markPickedUp(delivery.id)}
                            className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700"
                          >
                            Mark as Picked Up
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => markDelivered(delivery.id)}
                            className="w-full rounded-xl bg-customer py-3 font-semibold text-white transition hover:bg-customer/90"
                          >
                            Complete Delivery
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <SectionLabel>Today&apos;s Optimized Route</SectionLabel>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      Auto-planned by township · Food deliveries
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-600">
                      <UtensilsCrossed className="h-3 w-3" />
                      {foodStops} Food
                    </span>
                  </div>
                </div>

                {/* Route map placeholder */}
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  <div className="relative h-44 bg-slate-100 sm:h-56 lg:h-64">
                    <RiderIdleMap
                      riderCoords={riderPos?.lat ? riderPos : INITIAL_RIDER_POS}
                    />

                    <div className="absolute left-3 top-3 z-[1000] flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm">
                      <MapIcon className="h-3.5 w-3.5 text-rider" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Route overview</p>
                        <p className="text-xs font-semibold text-slate-800">
                          {completedStops}/{safeRouteStops.length} stops done · {upcomingStops} left
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress strip */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Completed', value: String(completedStops), accent: 'text-success' },
                    { label: 'Current', value: currentStop?.location ?? '—', accent: 'text-rider' },
                    { label: 'Upcoming', value: String(upcomingStops), accent: 'text-slate-700' },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-slate-200/80 bg-white px-3 py-3 text-center shadow-sm sm:px-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{stat.label}</p>
                      <p className={`mt-1 truncate text-sm font-bold font-tabular sm:text-base ${stat.accent}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Current stop CTA */}
                {currentStop && (
                  <div className="flex flex-col gap-3 rounded-2xl border border-rider/20 bg-white p-4 shadow-md shadow-rider/5 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rider">Next stop</p>
                      <p className="mt-0.5 truncate text-base font-bold text-slate-900">
                        {currentStop.location}
                        <span className="ml-2 text-sm font-medium text-slate-400">· {currentStop.customerName}</span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{currentStop.address}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateToStop(currentStop)}
                      className="flex shrink-0 items-center justify-center gap-2 rounded-xl gradient-indigo px-5 py-3 text-sm font-semibold text-white shadow-md shadow-rider/25 transition-all hover:opacity-95 active:scale-[0.98]"
                    >
                      <Navigation className="h-4 w-4" />
                      Start Next Route
                    </button>
                  </div>
                )}

                {/* Vertical timeline */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <SectionLabel>Stop sequence</SectionLabel>
                    <span className="text-[11px] font-medium text-slate-400 font-tabular">
                      {safeRouteStops.length} stops today
                    </span>
                  </div>

                  {safeRouteStops.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center">
                      <Route className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-semibold text-slate-600">No stops yet today</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Accept a dispatch and your pickup / drop-off stops will appear here.
                      </p>
                    </div>
                  ) : null}

                  <ol className="relative space-y-0">
                    {safeRouteStops.map((stop, index) => {
                      const meta = ROUTE_TYPE_META[stop.type] || ROUTE_TYPE_META.FOOD;
                      const TypeIcon = meta.icon;
                      const isLast = index === safeRouteStops.length - 1;
                      const isCompleted = stop.status === 'COMPLETED';
                      const isCurrent = stop.status === 'CURRENT';

                      return (
                        <li key={stop.id} className="relative flex gap-3 sm:gap-4">
                          {/* Timeline rail */}
                          <div className="flex w-9 shrink-0 flex-col items-center sm:w-10">
                            <div
                              className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-sm sm:h-10 sm:w-10 ${
                                isCompleted
                                  ? 'bg-success'
                                  : isCurrent
                                    ? `${meta.node} ring-4 ${meta.ring}`
                                    : 'bg-slate-200'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle className="h-4 w-4 text-white sm:h-[18px] sm:w-[18px]" />
                              ) : (
                                <TypeIcon className={`h-4 w-4 sm:h-[18px] sm:w-[18px] ${isCurrent ? 'text-white' : 'text-slate-500'}`} />
                              )}
                            </div>
                            {!isLast && (
                              <div
                                className={`w-0.5 flex-1 min-h-[1.25rem] ${
                                  isCompleted ? 'bg-success/35' : 'bg-slate-200'
                                }`}
                              />
                            )}
                          </div>

                          {/* Card */}
                          <div
                            className={`mb-3 min-w-0 flex-1 rounded-2xl border p-3.5 transition-all duration-200 sm:p-4 ${
                              isCurrent
                                ? 'border-rider/30 bg-rider/[0.04] shadow-sm'
                                : isCompleted
                                  ? 'border-slate-100 bg-slate-50/70'
                                  : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>
                                    <TypeIcon className="h-3 w-3" />
                                    {meta.label}
                                  </span>
                                  {isCurrent && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-rider/25 bg-rider/10 px-2 py-0.5 text-[10px] font-bold text-rider">
                                      <span className="h-1.5 w-1.5 rounded-full bg-rider status-pulse" />
                                      Current
                                    </span>
                                  )}
                                  {isCompleted && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-success">Done</span>
                                  )}
                                </div>
                                <p className={`mt-1.5 text-sm font-bold tracking-tight ${isCompleted ? 'text-slate-600' : 'text-slate-900'}`}>
                                  {stop.location}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">{stop.address}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="flex items-center justify-end gap-1 text-[11px] font-medium text-slate-400 font-tabular">
                                  <Clock className="h-3 w-3" />
                                  {stop.timeWindow}
                                </p>
                                {stop.ref && (
                                  <p className="mt-1 text-[11px] font-semibold text-slate-500 font-tabular">{stop.ref}</p>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100/80 pt-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-slate-700">{stop.customerName}</p>
                                {stop.notes && <p className="mt-0.5 truncate text-[11px] text-slate-400">{stop.notes}</p>}
                              </div>
                              {isCurrent && (
                                <button
                                  type="button"
                                  onClick={() => navigateToStop(stop)}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-rider/20 bg-rider/10 px-3 py-2 text-xs font-semibold text-rider transition-all hover:bg-rider/15 active:scale-[0.98]"
                                >
                                  <Navigation className="h-3.5 w-3.5" />
                                  Navigate
                                </button>
                              )}
                              {stop.status === 'UPCOMING' && (
                                <span className="text-[11px] font-medium text-slate-400">Upcoming</span>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            )}

            {/* EARNINGS */}
            {activeTab === 'earnings' && (
              <div className="mx-auto max-w-3xl space-y-5 animate-fade-in lg:max-w-none">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionLabel>Earnings Overview</SectionLabel>
                  <DashboardRangeToggle value={statsRange} onChange={setStatsRange} />
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard label={periodLabel} value={formatKyat(Number(weeklyEarnings))} icon={DollarSign} accent="bg-success/10 text-success" />
                  <MetricCard label="Chart Total" value={formatKyat(Number(weeklyTotal))} icon={TrendingUp} accent="bg-rider/10 text-rider" />
                  <MetricCard label={`Tips ${periodLabel}`} value={formatKyat(Number(weeklyTips))} icon={Star} accent="bg-amber-400/15 text-amber-500" />
                  <MetricCard label={`Trips ${periodLabel}`} value={String(weeklyTrips)} icon={Bike} accent="bg-warning/10 text-warning" />
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
                  <SectionLabel>{chartTitle}</SectionLabel>
                  <div className="mt-4">
                    <EarningsChart
                      data={weeklyChart}
                      total={weeklyTotal}
                      title={chartTitle}
                      subtitle={chartSubtitle}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TRIPS */}
            {activeTab === 'trips' && (
              <div className="mx-auto max-w-3xl animate-fade-in lg:max-w-none">
                <div className="mb-4 flex items-center justify-between">
                  <SectionLabel>Recent Trips</SectionLabel>
                  <span className="text-[11px] font-medium text-slate-400 font-tabular">{weeklyTrips} trips this week</span>
                </div>
                {(Array.isArray(dashboardData?.recentTrips) ? dashboardData.recentTrips : []).length === 0 ? (
                  <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-12 text-center shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">No completed trips yet</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Delivered orders assigned to you will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2.5 lg:grid-cols-2">
                    {(Array.isArray(dashboardData?.recentTrips) ? dashboardData.recentTrips : []).map((trip: any) => {
                      const tip = Number(trip.tipAmount) || 0;
                      const base =
                        trip.baseRiderFee != null
                          ? Number(trip.baseRiderFee) || 0
                          : Math.round((Number(trip.totals?.deliveryFee) || 0) * 0.9);
                      const earnings = base + tip;
                      const distanceKm = Number(trip.distanceKm) || 0;
                      const durationMins = Number(trip.durationMins) || 0;
                      const completedLabel = trip.completedAt
                        ? new Date(trip.completedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : trip.createdAt
                          ? new Date(trip.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—';

                      return (
                        <div
                          key={trip._id}
                          className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md"
                        >
                          <div className="mb-2.5 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 font-tabular">
                                {trip.orderNumber || '—'}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-slate-500">
                                {trip.restaurantName || 'Restaurant'} →{' '}
                                {trip.customerName || 'Customer'}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-bold text-success font-tabular">
                                {formatKyat(earnings)}
                              </p>
                              {tip > 0 && (
                                <p className="text-[11px] text-amber-500 font-tabular">
                                  +{formatKyat(tip)} tip
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span className="font-tabular">
                                {durationMins > 0 ? `${durationMins} min` : '—'}
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Navigation className="h-3 w-3" />
                              <span className="font-tabular">
                                {distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : '—'}
                              </span>
                            </span>
                            <span className="ml-auto flex items-center gap-1 text-success">
                              <CheckCircle className="h-3 w-3" />
                              <span className="font-tabular">{completedLabel}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SETTINGS */}
            {activeTab === 'settings' && (
              <div className="mx-auto max-w-xl space-y-4 animate-fade-in lg:max-w-2xl">
                <SectionLabel>Account Settings</SectionLabel>

                {profileLoading ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-rider border-t-transparent" />
                    <p className="text-sm font-medium">Loading profile…</p>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSaveProfile}
                    className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
                  >
                    <div className="flex flex-col items-center gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:p-6">
                      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-rider/10 ring-1 ring-rider/15">
                        {profile.profileImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profile.profileImage}
                            alt="Rider avatar"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-8 w-8 text-rider" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-center sm:text-left">
                        <p className="font-semibold text-slate-900">{profile.name.trim() || 'Your name'}</p>
                        <p className="mt-0.5 truncate text-sm text-slate-500">
                          {profile.phone.trim() || 'Add your phone number'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100">
                            <Camera className="h-3.5 w-3.5" />
                            Change Photo
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleProfileImage}
                            />
                          </label>
                          {profile.profileImage && (
                            <button
                              type="button"
                              onClick={() => setProfile((p) => ({ ...p, profileImage: '' }))}
                              className="rounded-full px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-400">Max 2MB · JPG or PNG</p>
                      </div>
                    </div>

                    <div className="space-y-4 px-5 py-5 sm:px-6">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Full Name</label>
                        <input
                          type="text"
                          required
                          value={profile.name}
                          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                          className="input-field"
                          placeholder="e.g. Carlos Ramirez"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={profile.phone}
                          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          className="input-field"
                          placeholder="+95 9 xxx xxx xxx"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                          <Bike className="h-3.5 w-3.5 text-slate-400" />
                          Vehicle
                        </label>
                        <input
                          type="text"
                          value={profile.vehicle}
                          onChange={(e) => setProfile({ ...profile, vehicle: e.target.value })}
                          className="input-field"
                          placeholder="e.g. Scooter · Honda PCX 125"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">License Plate</label>
                        <input
                          type="text"
                          value={profile.licensePlate}
                          onChange={(e) => setProfile({ ...profile, licensePlate: e.target.value })}
                          className="input-field"
                          placeholder="e.g. YGN-4821"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={profileSaving}
                        className="btn-primary w-full justify-center py-3"
                      >
                        <Save className="h-4 w-4" />
                        {profileSaving ? 'Saving…' : 'Save Profile'}
                      </button>
                    </div>
                  </form>
                )}

                <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-1 flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-rider" />
                    <h3 className="text-sm font-bold text-slate-900">Support</h3>
                  </div>
                  <p className="mb-4 text-xs text-slate-500">
                    Message FoodDash Support about dispatch issues, payouts, or account help.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSupportOpen(true)}
                    className="btn-primary w-full justify-center py-3"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Contact Support
                  </button>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-1 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-rider" />
                    <h3 className="text-sm font-bold text-slate-900">Security</h3>
                  </div>
                  <p className="mb-4 text-xs text-slate-500">
                    Keep your rider account secure with a strong password.
                  </p>
                  <Link href="/change-password" className="btn-secondary w-full justify-center py-3">
                    <Lock className="h-4 w-4" />
                    Change Password
                  </Link>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── Mobile bottom navigation ───────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 px-2 pb-3 pt-2 sm:px-3 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around rounded-2xl border border-slate-200 bg-white/95 px-0.5 py-1.5 shadow-lg shadow-slate-900/5 backdrop-blur-xl sm:px-1.5">
          {renderNavButtons('bottom')}
        </div>
      </nav>

      {chatTargetId && sessionId && chatDelivery && (
        <ChatWidget
          currentUserId={sessionId}
          currentUserRole="RIDER"
          targetUserId={chatTargetId}
          targetUserRole={chatPeer === 'restaurant' ? 'RESTAURANT' : 'CUSTOMER'}
          targetName={
            chatPeer === 'restaurant'
              ? chatDelivery.restaurant || 'Restaurant'
              : chatDelivery.customerName || 'Customer'
          }
          orderId={chatDelivery.id}
          open={chatOpen}
          onOpenChange={setChatOpen}
          quickReplies={
            chatPeer === 'restaurant'
              ? [...RIDER_TO_RESTAURANT_QUICK_REPLIES]
              : [...RIDER_TO_CUSTOMER_QUICK_REPLIES]
          }
          accentClassName="bg-rider"
        />
      )}

      {sessionId && (
        <ChatWidget
          currentUserId={sessionId}
          currentUserRole="RIDER"
          targetUserId={SUPPORT_ADMIN_ID}
          targetUserRole={SUPPORT_ADMIN_ROLE}
          targetName={SUPPORT_ADMIN_NAME}
          open={supportOpen}
          onOpenChange={setSupportOpen}
          showLauncher={false}
          accentClassName="bg-rider"
        />
      )}

      {remittanceOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          onClick={() => {
            if (!remitting) setRemittanceOpen(false);
          }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="remittance-title"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p id="remittance-title" className="text-sm font-bold text-slate-900">
                  Deposit to Company
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Remit COD cash via KBZPay or WavePay
                </p>
              </div>
              <button
                type="button"
                onClick={() => !remitting && setRemittanceOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Payment method
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(['KBZPay', 'WavePay'] as RemittanceMethod[]).map((method) => {
                    const selected = remittanceMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setRemittanceMethod(method)}
                        className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
                          selected
                            ? 'border-rider/40 bg-rider/10 text-rider ring-1 ring-rider/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Amount
                </p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {REMITTANCE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRemittanceAmount(String(preset))}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        Number(remittanceAmount) === preset
                          ? 'border-rider/40 bg-rider/10 text-rider'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {formatKyat(preset)}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={remittanceAmount}
                  onChange={(e) => setRemittanceAmount(e.target.value)}
                  placeholder="Enter amount (Ks)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none ring-rider/20 placeholder:font-medium placeholder:text-slate-400 focus:border-rider/40 focus:bg-white focus:ring-2"
                />
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                disabled={remitting}
                onClick={() => setRemittanceOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={remitting}
                onClick={() => void submitRemittance()}
                className="flex-1 rounded-xl bg-rider py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rider/90 disabled:opacity-60"
              >
                {remitting ? 'Depositing…' : 'Confirm deposit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
