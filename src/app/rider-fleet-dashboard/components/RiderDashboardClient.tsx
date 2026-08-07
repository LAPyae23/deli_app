'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Bike, Home, DollarSign, ClipboardList, Settings, LogOut, Bell,
  MapPin, Phone, MessageCircle, Clock, Star, Navigation,
  CheckCircle, X, TrendingUp, Route, Wallet, Package, PackageOpen,
  UtensilsCrossed, Map as MapIcon, Save, Camera, User,
} from 'lucide-react';
import { toast } from 'sonner';
import AppLogo from '@/components/ui/AppLogo';
import EarningsChart from './EarningsChart';

const RiderLiveMap = dynamic(() => import('./RiderLiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

type DutyStatus = 'OFFLINE' | 'AVAILABLE' | 'DELIVERING';
type RiderTab = 'home' | 'routes' | 'earnings' | 'trips' | 'settings';
type RouteStopType = 'FOOD' | 'PARCEL_PICKUP' | 'PARCEL_DROPOFF';
type RouteStopStatus = 'COMPLETED' | 'CURRENT' | 'UPCOMING';

const RIDER_ID = 'rider-demo-id';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const DISPATCH_POLL_MS = 10_000;

interface DispatchOrder {
  id: string;
  orderNumber: string;
  restaurant: string;
  restaurantAddr: string;
  customerAddr: string;
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
    restaurantAddr: String(raw.restaurantName || 'Restaurant pickup'),
    customerAddr: String(deliveryAddress.address || 'Customer address'),
    pickupDistance: 'Nearby',
    dropDistance: `${dropKm.toFixed(1)} km`,
    estimatedEarnings: deliveryFee > 0 ? deliveryFee : Math.max(5, Math.round(total * 0.12 * 100) / 100),
    estimatedTip: Math.round(total * 0.05 * 100) / 100,
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

const COMPLETED_TRIPS = [
  { id: 'trip-001', orderNumber: '#FP-8940', restaurant: 'Burger Bliss', customer: 'Maya Chen', pickupAddr: '145 Broadway Ave', dropAddr: '123 Maple St', earnings: 6.40, tip: 2.00, distance: '2.4 km', duration: '18 min', completedAt: '15:52', status: 'DELIVERED' },
  { id: 'trip-002', orderNumber: '#FP-8931', restaurant: 'Spice Route', customer: 'David Okonkwo', pickupAddr: '88 5th Ave', dropAddr: '401 Park Blvd', earnings: 7.20, tip: 3.00, distance: '3.1 km', duration: '24 min', completedAt: '14:38', status: 'DELIVERED' },
  { id: 'trip-003', orderNumber: '#FP-8919', restaurant: 'Verde Kitchen', customer: 'Priya Sharma', pickupAddr: '22 W 72nd St', dropAddr: '55 Riverside Dr', earnings: 5.80, tip: 1.50, distance: '1.9 km', duration: '15 min', completedAt: '13:21', status: 'DELIVERED' },
  { id: 'trip-004', orderNumber: '#FP-8908', restaurant: 'Sakura Ramen', customer: 'Tom Fitzgerald', pickupAddr: '200 E 60th St', dropAddr: '310 Lexington Ave', earnings: 8.10, tip: 0, distance: '3.8 km', duration: '31 min', completedAt: '12:44', status: 'DELIVERED' },
  { id: 'trip-005', orderNumber: '#FP-8895', restaurant: 'Taco Loco', customer: 'Aisha Mensah', pickupAddr: '67 Canal St', dropAddr: '190 Grand St', earnings: 5.20, tip: 2.50, distance: '1.6 km', duration: '13 min', completedAt: '11:58', status: 'DELIVERED' },
  { id: 'trip-006', orderNumber: '#FP-8880', restaurant: 'Crispy Seoul', customer: 'James Park', pickupAddr: '34 Mott St', dropAddr: '78 Bowery St', earnings: 6.90, tip: 1.00, distance: '2.2 km', duration: '19 min', completedAt: '11:15', status: 'DELIVERED' },
];

const TODAY_ROUTE_PLAN: RouteStop[] = [
  {
    id: 'stop-01',
    type: 'FOOD',
    location: 'Bahan',
    address: '42 Inya Road, Bahan Township',
    status: 'COMPLETED',
    timeWindow: '09:15 – 09:40',
    customerName: 'Aye Chan',
    ref: '#FP-8940',
    notes: 'Food drop-off · Burger Bliss',
  },
  {
    id: 'stop-02',
    type: 'PARCEL_PICKUP',
    location: 'South Dagon',
    address: 'No. 18, Yadanar St, South Dagon',
    status: 'COMPLETED',
    timeWindow: '10:00 – 10:25',
    customerName: 'Ko Min Thu',
    ref: '#C2C-2201',
    notes: 'Small box · fragile',
  },
  {
    id: 'stop-03',
    type: 'FOOD',
    location: 'Thingangyun',
    address: '7 Waizayantar Rd, Thingangyun',
    status: 'COMPLETED',
    timeWindow: '10:40 – 11:05',
    customerName: 'Su Su Hlaing',
    ref: '#FP-8941',
    notes: 'Food drop-off · Spice Route',
  },
  {
    id: 'stop-04',
    type: 'PARCEL_DROPOFF',
    location: 'North Okkalapa',
    address: 'Bldg C-12, Thudhamma Rd, North Okkalapa',
    status: 'CURRENT',
    timeWindow: '11:20 – 11:50',
    customerName: 'Ma Thida Oo',
    ref: '#C2C-2201',
    notes: 'Deliver parcel from South Dagon',
  },
  {
    id: 'stop-05',
    type: 'PARCEL_PICKUP',
    location: 'Yankin',
    address: '88 Kabar Aye Pagoda Rd, Yankin',
    status: 'UPCOMING',
    timeWindow: '12:10 – 12:35',
    customerName: 'U Zaw Win',
    ref: '#C2C-2208',
    notes: 'Envelope · documents',
  },
  {
    id: 'stop-06',
    type: 'FOOD',
    location: 'Tamwe',
    address: '15 Myaynigone Rd, Tamwe',
    status: 'UPCOMING',
    timeWindow: '12:50 – 13:15',
    customerName: 'Hnin Ei Phyu',
    ref: '#FP-8945',
    notes: 'Food drop-off · Verde Kitchen',
  },
  {
    id: 'stop-07',
    type: 'PARCEL_DROPOFF',
    location: 'Hlaing',
    address: '3/A Parami Road, Hlaing Township',
    status: 'UPCOMING',
    timeWindow: '13:30 – 14:00',
    customerName: 'Daw Khin Mar',
    ref: '#C2C-2208',
    notes: 'Deliver parcel from Yankin',
  },
];

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
  PARCEL_PICKUP: {
    label: 'Parcel Pickup',
    icon: PackageOpen,
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
    node: 'bg-teal-500',
    ring: 'ring-teal-200',
  },
  PARCEL_DROPOFF: {
    label: 'Parcel Drop-off',
    icon: Package,
    badge: 'bg-rider/10 text-rider border-rider/20',
    node: 'bg-rider',
    ring: 'ring-rider/25',
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
}: {
  title: string;
  subtitle: string;
  label: string;
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
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:text-rider"
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
  const [activeDelivery, setActiveDelivery] = useState<DispatchOrder | null>(null);
  const [activeTab, setActiveTab] = useState<RiderTab>('home');
  const [riderPos, setRiderPos] = useState(INITIAL_RIDER_POS);
  const [accepting, setAccepting] = useState(false);
  const [profile, setProfile] = useState<RiderProfileForm>(INITIAL_PROFILE);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  const showDispatch = !!incomingDispatch && dutyStatus === 'AVAILABLE' && !activeDelivery;

  // Load rider profile
  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setProfileLoading(true);
      try {
        const res = await fetch(`/api/rider/profile?riderId=${RIDER_ID}`);
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

  // Poll for available dispatch orders
  useEffect(() => {
    if (dutyStatus !== 'AVAILABLE' || activeDelivery) return;

    let cancelled = false;

    async function pollAvailableOrders() {
      try {
        const res = await fetch('/api/orders?status=PREPARING&unassigned=true');
        const data = await res.json();
        if (!res.ok || !data.success || cancelled) return;

        const orders = Array.isArray(data.orders) ? data.orders : [];
        if (orders.length === 0) {
          setIncomingDispatch(null);
          return;
        }

        const mapped = mapApiOrderToDispatch(orders[0] as Record<string, unknown>);
        if (!mapped.id) return;

        setIncomingDispatch((prev) => {
          if (prev?.id === mapped.id) return prev;
          setDispatchTimer(30);
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
  }, [dutyStatus, activeDelivery]);

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
    if (!activeDelivery) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocation is not supported on this device');
      return;
    }

    const orderId = activeDelivery.id;
    let lastPatchAt = 0;
    const PATCH_INTERVAL_MS = 8_000;
    let cancelled = false;

    const patchRiderCoords = async (lat: number, lng: number) => {
      const now = Date.now();
      if (now - lastPatchAt < PATCH_INTERVAL_MS) return;
      lastPatchAt = now;
      try {
        await fetch(`/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ riderCoords: { lat, lng } }),
        });
      } catch (error) {
        console.warn('Failed to update rider coords:', error);
      }
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
  }, [activeDelivery?.id]);

  const toggleDuty = () => {
    const next = dutyStatus === 'OFFLINE' ? 'AVAILABLE' : 'OFFLINE';
    setDutyStatus(next);
    toast.success(next === 'AVAILABLE' ? 'You are now online — ready for dispatch' : 'You are now offline');
    if (next === 'OFFLINE') setIncomingDispatch(null);
  };

  const acceptDispatch = async () => {
    if (!incomingDispatch) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/orders/${incomingDispatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'OUT_FOR_DELIVERY',
          riderId: RIDER_ID,
          riderName: profile.name.trim() || 'Rider',
          riderCoords: incomingDispatch.restaurantCoords,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to accept');

      setActiveDelivery(incomingDispatch);
      setRiderPos(incomingDispatch.restaurantCoords);
      setIncomingDispatch(null);
      setDutyStatus('DELIVERING');
      toast.success(`Dispatch accepted — heading to ${incomingDispatch.restaurant}`);
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

  const markPickedUp = async () => {
    if (!activeDelivery) return;
    try {
      const res = await fetch(`/api/orders/${activeDelivery.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'OUT_FOR_DELIVERY' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update status');

      toast.success('Order picked up — heading to customer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark picked up');
    }
  };

  const markDelivered = async () => {
    if (!activeDelivery) return;
    try {
      const res = await fetch(`/api/orders/${activeDelivery.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DELIVERED' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update status');

      setActiveDelivery(null);
      setRiderPos(INITIAL_RIDER_POS);
      setDutyStatus('AVAILABLE');
      setDispatchTimer(30);
      toast.success('Delivery completed! Great job 🎉');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark delivered');
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
    setProfileSaving(true);
    try {
      const res = await fetch('/api/rider/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId: RIDER_ID,
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const navigateToStop = (stop: RouteStop) => {
    toast.success(`Navigating to ${stop.location} — ${stop.address}`);
  };

  const todayEarnings = COMPLETED_TRIPS.reduce((s, t) => s + t.earnings + t.tip, 0);
  const todayTrips = COMPLETED_TRIPS.length;
  const todayDistance = COMPLETED_TRIPS.reduce((s, t) => s + parseFloat(t.distance), 0).toFixed(1);
  const todayTips = COMPLETED_TRIPS.reduce((s, t) => s + t.tip, 0);

  const completedStops = TODAY_ROUTE_PLAN.filter((s) => s.status === 'COMPLETED').length;
  const currentStop = TODAY_ROUTE_PLAN.find((s) => s.status === 'CURRENT');
  const upcomingStops = TODAY_ROUTE_PLAN.filter((s) => s.status === 'UPCOMING').length;
  const parcelStops = TODAY_ROUTE_PLAN.filter((s) => s.type !== 'FOOD').length;
  const foodStops = TODAY_ROUTE_PLAN.filter((s) => s.type === 'FOOD').length;

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
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200 lg:hidden">
                <AppLogo size={28} />
              </div>
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
              <button
                type="button"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-danger ring-2 ring-white" />
              </button>

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

          {/* Content */}
          <main className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-10">

            {/* HOME */}
            {activeTab === 'home' && (
              <div className="mx-auto max-w-3xl space-y-5 lg:max-w-none">
                <div className={`grid gap-5 ${activeDelivery || (showDispatch && dutyStatus === 'AVAILABLE') ? 'lg:grid-cols-5' : ''}`}>

                  {/* Left / primary column — dispatch & active delivery */}
                  <div className={`space-y-5 ${(activeDelivery || (showDispatch && dutyStatus === 'AVAILABLE')) ? 'lg:col-span-3' : ''}`}>

                    {/* Dispatch request */}
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
                                { label: 'Base Pay', value: `$${incomingDispatch.estimatedEarnings.toFixed(2)}`, className: 'text-slate-900' },
                                { label: 'Est. Tip', value: `+$${incomingDispatch.estimatedTip.toFixed(2)}`, className: 'text-success' },
                                { label: 'Total Est.', value: `$${(incomingDispatch.estimatedEarnings + incomingDispatch.estimatedTip).toFixed(2)}`, className: 'text-rider' },
                              ].map((cell) => (
                                <div key={cell.label} className="rounded-xl border border-slate-100 bg-slate-50 py-3 text-center">
                                  <p className="text-[10px] font-medium text-slate-400">{cell.label}</p>
                                  <p className={`mt-1 text-sm font-bold font-tabular ${cell.className}`}>{cell.value}</p>
                                </div>
                              ))}
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

                    {/* Active delivery */}
                    {activeDelivery && (
                      <div className="animate-fade-in">
                        <div className="overflow-hidden rounded-2xl border border-success/20 bg-white shadow-md shadow-success/5">
                          <div className="flex items-center gap-2.5 border-b border-success/10 bg-success/[0.06] px-5 py-3 sm:px-6">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/15">
                              <Navigation className="h-3.5 w-3.5 text-success" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-success">Active Delivery</p>
                              <p className="text-[11px] font-medium text-success/70 font-tabular">{activeDelivery.orderNumber}</p>
                            </div>
                          </div>

                          <div className="space-y-4 p-4 sm:p-5">
                            <div className="relative h-52 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner sm:h-64 lg:h-72">
                              <RiderLiveMap
                                pickupCoords={
                                  activeDelivery.restaurantCoords?.lat
                                    ? activeDelivery.restaurantCoords
                                    : { lat: 16.8409, lng: 96.1735 }
                                }
                                dropoffCoords={
                                  activeDelivery.customerCoords?.lat
                                    ? activeDelivery.customerCoords
                                    : { lat: 16.8564, lng: 96.1821 }
                                }
                                riderCoords={riderPos}
                              />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <ContactRow
                                label="Pickup from"
                                title={activeDelivery.restaurant}
                                subtitle={activeDelivery.restaurantAddr}
                              />
                              <ContactRow
                                label="Deliver to"
                                title="Customer"
                                subtitle={activeDelivery.customerAddr}
                              />
                            </div>

                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={markPickedUp}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-warning/25 bg-warning/10 py-3 text-sm font-semibold text-warning transition-all hover:bg-warning/15 active:scale-[0.98]"
                              >
                                <CheckCircle className="h-4 w-4" /> Picked Up
                              </button>
                              <button
                                type="button"
                                onClick={markDelivered}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-success/25 bg-success/10 py-3 text-sm font-semibold text-success transition-all hover:bg-success/15 active:scale-[0.98]"
                              >
                                <CheckCircle className="h-4 w-4" /> Delivered
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Summary — right column on desktop when delivery/dispatch shown */}
                  <div className={`animate-fade-in ${(activeDelivery || (showDispatch && dutyStatus === 'AVAILABLE')) ? 'lg:col-span-2' : ''}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <SectionLabel>Today&apos;s Summary</SectionLabel>
                      <span className="text-[11px] font-medium text-slate-400 font-tabular">{todayTrips} trips</span>
                    </div>
                    <div className={`grid gap-3 ${
                      (activeDelivery || (showDispatch && dutyStatus === 'AVAILABLE'))
                        ? 'grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'
                        : 'grid-cols-2 lg:grid-cols-4'
                    }`}>
                      <MetricCard
                        label="Total Earnings"
                        value={`$${todayEarnings.toFixed(2)}`}
                        sub="Base + tips"
                        icon={Wallet}
                        accent="bg-success/10 text-success"
                      />
                      <MetricCard
                        label="Trips Completed"
                        value={String(todayTrips)}
                        sub="Today"
                        icon={Bike}
                        accent="bg-rider/10 text-rider"
                      />
                      <MetricCard
                        label="Distance"
                        value={`${todayDistance} km`}
                        sub="Total ridden"
                        icon={Route}
                        accent="bg-warning/10 text-warning"
                      />
                      <MetricCard
                        label="Tips Earned"
                        value={`$${todayTips.toFixed(2)}`}
                        sub="Customer tips"
                        icon={Star}
                        accent="bg-amber-400/15 text-amber-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ROUTES — C2C + Food daily plan */}
            {activeTab === 'routes' && (
              <div className="mx-auto max-w-3xl space-y-5 animate-fade-in lg:max-w-none">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <SectionLabel>Today&apos;s Optimized Route</SectionLabel>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      Auto-planned by township · Food + C2C parcels
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-600">
                      <UtensilsCrossed className="h-3 w-3" />
                      {foodStops} Food
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
                      <Package className="h-3 w-3" />
                      {parcelStops} Parcel
                    </span>
                  </div>
                </div>

                {/* Route map placeholder */}
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  <div className="relative h-44 bg-gradient-to-br from-slate-100 via-indigo-50/60 to-teal-50/50 sm:h-56 lg:h-64">
                    {/* Soft route path illustration */}
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden>
                      <path
                        d="M40 150 C 80 140, 100 80, 140 90 S 200 150, 240 110 S 300 40, 360 55"
                        fill="none"
                        stroke="#C7D2FE"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray="8 6"
                      />
                      <path
                        d="M40 150 C 80 140, 100 80, 140 90 S 200 150, 240 110"
                        fill="none"
                        stroke="#6366F1"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </svg>

                    {/* Township chips along the route */}
                    <div className="absolute left-[8%] bottom-[22%] flex flex-col items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-success ring-4 ring-white shadow" />
                      <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 shadow-sm">Bahan</span>
                    </div>
                    <div className="absolute left-[28%] top-[38%] flex flex-col items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-teal-500 ring-4 ring-white shadow" />
                      <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 shadow-sm">S. Dagon</span>
                    </div>
                    <div className="absolute left-[52%] bottom-[28%] flex flex-col items-center gap-1">
                      <span className="h-3 w-3 rounded-full bg-rider ring-4 ring-white shadow status-pulse" />
                      <span className="rounded-md bg-rider px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">N. Okkalapa</span>
                    </div>
                    <div className="absolute right-[18%] top-[18%] flex flex-col items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-slate-300 bg-white" />
                      <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 shadow-sm">Yankin</span>
                    </div>
                    <div className="absolute right-[6%] top-[24%] flex flex-col items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-slate-300 bg-white" />
                      <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 shadow-sm">Hlaing</span>
                    </div>

                    <div className="absolute left-3 top-3 flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm">
                      <MapIcon className="h-3.5 w-3.5 text-rider" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Route overview</p>
                        <p className="text-xs font-semibold text-slate-800">
                          {completedStops}/{TODAY_ROUTE_PLAN.length} stops done · {upcomingStops} left
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
                      {TODAY_ROUTE_PLAN.length} stops today
                    </span>
                  </div>

                  <ol className="relative space-y-0">
                    {TODAY_ROUTE_PLAN.map((stop, index) => {
                      const meta = ROUTE_TYPE_META[stop.type];
                      const TypeIcon = meta.icon;
                      const isLast = index === TODAY_ROUTE_PLAN.length - 1;
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
                <SectionLabel>Earnings Overview</SectionLabel>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard label="Today" value={`$${todayEarnings.toFixed(2)}`} icon={DollarSign} accent="bg-success/10 text-success" />
                  <MetricCard label="This Week" value="$284.60" icon={TrendingUp} accent="bg-rider/10 text-rider" />
                  <MetricCard label="Tips Today" value={`$${todayTips.toFixed(2)}`} icon={Star} accent="bg-amber-400/15 text-amber-500" />
                  <MetricCard label="Trips Today" value={String(todayTrips)} icon={Bike} accent="bg-warning/10 text-warning" />
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
                  <SectionLabel>Weekly Chart</SectionLabel>
                  <div className="mt-4">
                    <EarningsChart />
                  </div>
                </div>
              </div>
            )}

            {/* TRIPS */}
            {activeTab === 'trips' && (
              <div className="mx-auto max-w-3xl animate-fade-in lg:max-w-none">
                <div className="mb-4 flex items-center justify-between">
                  <SectionLabel>Recent Trips</SectionLabel>
                  <span className="text-[11px] font-medium text-slate-400 font-tabular">{todayTrips} trips today</span>
                </div>
                <div className="grid gap-2.5 lg:grid-cols-2">
                  {COMPLETED_TRIPS.map((trip) => (
                    <div
                      key={trip.id}
                      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="mb-2.5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 font-tabular">{trip.orderNumber}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {trip.restaurant} → {trip.customer}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-success font-tabular">
                            ${(trip.earnings + trip.tip).toFixed(2)}
                          </p>
                          {trip.tip > 0 && (
                            <p className="text-[11px] text-amber-500 font-tabular">+${trip.tip.toFixed(2)} tip</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span className="font-tabular">{trip.duration}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Navigation className="h-3 w-3" />
                          <span className="font-tabular">{trip.distance}</span>
                        </span>
                        <span className="ml-auto flex items-center gap-1 text-success">
                          <CheckCircle className="h-3 w-3" />
                          <span className="font-tabular">{trip.completedAt}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
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
    </div>
  );
}
