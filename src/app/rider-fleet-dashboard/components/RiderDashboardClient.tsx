'use client';

import React, { useState, useEffect } from 'react';
import { Bike, Home, DollarSign, ClipboardList, Settings, LogOut, Bell, MapPin, Phone, MessageCircle, Clock, Star, Navigation, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import AppLogo from '@/components/ui/AppLogo';
import EarningsChart from './EarningsChart';

type DutyStatus = 'OFFLINE' | 'AVAILABLE' | 'DELIVERING';
type RiderTab = 'home' | 'earnings' | 'trips' | 'settings';

const COMPLETED_TRIPS = [
  { id: 'trip-001', orderNumber: '#FP-8940', restaurant: 'Burger Bliss', customer: 'Maya Chen', pickupAddr: '145 Broadway Ave', dropAddr: '123 Maple St', earnings: 6.40, tip: 2.00, distance: '2.4 km', duration: '18 min', completedAt: '15:52', status: 'DELIVERED' },
  { id: 'trip-002', orderNumber: '#FP-8931', restaurant: 'Spice Route', customer: 'David Okonkwo', pickupAddr: '88 5th Ave', dropAddr: '401 Park Blvd', earnings: 7.20, tip: 3.00, distance: '3.1 km', duration: '24 min', completedAt: '14:38', status: 'DELIVERED' },
  { id: 'trip-003', orderNumber: '#FP-8919', restaurant: 'Verde Kitchen', customer: 'Priya Sharma', pickupAddr: '22 W 72nd St', dropAddr: '55 Riverside Dr', earnings: 5.80, tip: 1.50, distance: '1.9 km', duration: '15 min', completedAt: '13:21', status: 'DELIVERED' },
  { id: 'trip-004', orderNumber: '#FP-8908', restaurant: 'Sakura Ramen', customer: 'Tom Fitzgerald', pickupAddr: '200 E 60th St', dropAddr: '310 Lexington Ave', earnings: 8.10, tip: 0, distance: '3.8 km', duration: '31 min', completedAt: '12:44', status: 'DELIVERED' },
  { id: 'trip-005', orderNumber: '#FP-8895', restaurant: 'Taco Loco', customer: 'Aisha Mensah', pickupAddr: '67 Canal St', dropAddr: '190 Grand St', earnings: 5.20, tip: 2.50, distance: '1.6 km', duration: '13 min', completedAt: '11:58', status: 'DELIVERED' },
  { id: 'trip-006', orderNumber: '#FP-8880', restaurant: 'Crispy Seoul', customer: 'James Park', pickupAddr: '34 Mott St', dropAddr: '78 Bowery St', earnings: 6.90, tip: 1.00, distance: '2.2 km', duration: '19 min', completedAt: '11:15', status: 'DELIVERED' },
];

const DISPATCH_ORDER = {
  id: 'ord-dispatch-001',
  orderNumber: '#FP-8943',
  restaurant: 'Burger Bliss',
  restaurantAddr: '145 Broadway Ave, Manhattan',
  customerAddr: '123 Maple Street, Brooklyn',
  pickupDistance: '0.8 km',
  dropDistance: '3.2 km',
  estimatedEarnings: 7.40,
  estimatedTip: 2.00,
  items: 5,
  // Coordinates for the map
  restaurantCoords: { lat: 40.7128, lng: -74.006 },
  customerCoords: { lat: 40.6892, lng: -73.9442 },
};

const NAV_ITEMS: { key: string; label: string; icon: React.ElementType; id: RiderTab }[] = [
  { key: 'rnav-home', label: 'Home', icon: Home, id: 'home' },
  { key: 'rnav-earnings', label: 'Earnings', icon: DollarSign, id: 'earnings' },
  { key: 'rnav-trips', label: 'Trips', icon: ClipboardList, id: 'trips' },
  { key: 'rnav-settings', label: 'Settings', icon: Settings, id: 'settings' },
];

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Rider's initial position near the restaurant
const INITIAL_RIDER_POS = { lat: 40.7155, lng: -74.0035 };

export default function RiderDashboardClient() {
  const [dutyStatus, setDutyStatus] = useState<DutyStatus>('AVAILABLE');
  const [showDispatch, setShowDispatch] = useState(true);
  const [dispatchTimer, setDispatchTimer] = useState(30);
  const [activeDelivery, setActiveDelivery] = useState<typeof DISPATCH_ORDER | null>(null);
  const [activeTab, setActiveTab] = useState<RiderTab>('home');
  const [riderPos, setRiderPos] = useState(INITIAL_RIDER_POS);

  useEffect(() => {
    if (!showDispatch || dutyStatus !== 'AVAILABLE') return;
    const interval = setInterval(() => {
      setDispatchTimer(t => {
        if (t <= 1) {
          setShowDispatch(false);
          toast.error('Dispatch request expired');
          return 30;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showDispatch, dutyStatus]);

  // Simulate rider moving toward customer when delivering
  useEffect(() => {
    if (!activeDelivery) return;
    const target = activeDelivery.customerCoords;
    const interval = setInterval(() => {
      setRiderPos(prev => ({
        lat: prev.lat + (target.lat - prev.lat) * 0.025,
        lng: prev.lng + (target.lng - prev.lng) * 0.025,
      }));
    }, 2500);
    return () => clearInterval(interval);
  }, [activeDelivery]);

  const toggleDuty = () => {
    const next = dutyStatus === 'OFFLINE' ? 'AVAILABLE' : 'OFFLINE';
    setDutyStatus(next);
    toast.success(next === 'AVAILABLE' ? 'You are now online — ready for dispatch' : 'You are now offline');
    if (next === 'OFFLINE') setShowDispatch(false);
  };

  const acceptDispatch = () => {
    setActiveDelivery(DISPATCH_ORDER);
    setRiderPos(INITIAL_RIDER_POS);
    setShowDispatch(false);
    setDutyStatus('DELIVERING');
    toast.success(`Dispatch accepted — heading to ${DISPATCH_ORDER.restaurant}`);
  };

  const declineDispatch = () => {
    setShowDispatch(false);
    setDispatchTimer(30);
    toast.info('Dispatch declined');
  };

  const markPickedUp = () => {
    toast.success('Order picked up — heading to customer');
  };

  const markDelivered = () => {
    setActiveDelivery(null);
    setRiderPos(INITIAL_RIDER_POS);
    setDutyStatus('AVAILABLE');
    setShowDispatch(true);
    setDispatchTimer(30);
    toast.success('Delivery completed! Great job 🎉');
  };

  const todayEarnings = COMPLETED_TRIPS.reduce((s, t) => s + t.earnings + t.tip, 0);
  const todayTrips = COMPLETED_TRIPS.length;
  const todayDistance = COMPLETED_TRIPS.reduce((s, t) => s + parseFloat(t.distance), 0).toFixed(1);
  const todayTips = COMPLETED_TRIPS.reduce((s, t) => s + t.tip, 0);

  const hasValidMapKey = MAPS_API_KEY && MAPS_API_KEY !== 'your-google-maps-api-key-here';

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col max-w-md mx-auto relative overflow-hidden">
      {/* Top Header */}
      <header className="px-5 pt-safe pt-4 pb-3 flex items-center justify-between flex-shrink-0 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <AppLogo size={28} />
          <div>
            <p className="text-sm font-bold leading-tight text-white">Carlos Ramirez</p>
            <div className="flex items-center gap-1.5">
              <Star className="w-3 h-3 text-warning fill-warning" />
              <span className="text-xs text-zinc-400 font-medium">4.92 · 1,247 trips</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors">
            <Bell className="w-4 h-4 text-zinc-300" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-danger rounded-full" />
          </button>
          <button
            onClick={toggleDuty}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
              dutyStatus !== 'OFFLINE' ? 'bg-success/20 text-success border border-success/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${dutyStatus !== 'OFFLINE' ? 'bg-success status-pulse' : 'bg-zinc-600'}`} />
            {dutyStatus === 'OFFLINE' ? 'Go Online' : dutyStatus === 'AVAILABLE' ? 'Online' : 'Delivering'}
          </button>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto scrollbar-hide pb-20">

        {/* HOME TAB */}
        {activeTab === 'home' && (
          <>
            {/* Dispatch Modal */}
            {showDispatch && dutyStatus === 'AVAILABLE' && (
              <div className="mx-4 mt-4 animate-slide-up">
                <div className="bg-zinc-900 border border-rider/40 rounded-2xl overflow-hidden card-shadow-lg">
                  <div className="gradient-indigo px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold text-base">New Delivery Request</p>
                      <p className="text-white/70 text-xs">{DISPATCH_ORDER.restaurant} · {DISPATCH_ORDER.items} items</p>
                    </div>
                    <div className="relative w-14 h-14 flex-shrink-0">
                      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                        <circle
                          cx="28" cy="28" r="24" fill="none" stroke="white" strokeWidth="4"
                          strokeDasharray="150.8"
                          strokeDashoffset={150.8 * (1 - dispatchTimer / 30)}
                          strokeLinecap="round"
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg font-tabular">{dispatchTimer}</span>
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-1 mt-1 flex-shrink-0">
                        <div className="w-3 h-3 rounded-full bg-success border-2 border-success/30" />
                        <div className="w-0.5 h-6 bg-zinc-700" />
                        <div className="w-3 h-3 rounded-full bg-danger border-2 border-danger/30" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div>
                          <p className="text-xs text-zinc-500 font-medium">PICKUP</p>
                          <p className="text-sm font-semibold text-white">{DISPATCH_ORDER.restaurantAddr}</p>
                          <p className="text-xs text-zinc-400">{DISPATCH_ORDER.pickupDistance} away</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 font-medium">DROPOFF</p>
                          <p className="text-sm font-semibold text-white">{DISPATCH_ORDER.customerAddr}</p>
                          <p className="text-xs text-zinc-400">{DISPATCH_ORDER.dropDistance} from pickup</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 bg-zinc-800 rounded-xl p-3 text-center">
                        <p className="text-xs text-zinc-500 mb-0.5">Base Pay</p>
                        <p className="text-base font-bold text-white font-tabular">${DISPATCH_ORDER.estimatedEarnings.toFixed(2)}</p>
                      </div>
                      <div className="flex-1 bg-zinc-800 rounded-xl p-3 text-center">
                        <p className="text-xs text-zinc-500 mb-0.5">Est. Tip</p>
                        <p className="text-base font-bold text-success font-tabular">+${DISPATCH_ORDER.estimatedTip.toFixed(2)}</p>
                      </div>
                      <div className="flex-1 bg-zinc-800 rounded-xl p-3 text-center">
                        <p className="text-xs text-zinc-500 mb-0.5">Total Est.</p>
                        <p className="text-base font-bold text-rider font-tabular">${(DISPATCH_ORDER.estimatedEarnings + DISPATCH_ORDER.estimatedTip).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={declineDispatch} className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-sm hover:bg-zinc-700 transition-colors active:scale-95 flex items-center justify-center gap-2">
                        <X className="w-4 h-4" /> Decline
                      </button>
                      <button onClick={acceptDispatch} className="flex-1 py-3 rounded-xl gradient-indigo text-white font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Accept
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Active Delivery Card */}
            {activeDelivery && (
              <div className="mx-4 mt-4 animate-fade-in">
                <div className="bg-zinc-900 border border-success/30 rounded-2xl overflow-hidden">
                  <div className="bg-success/10 border-b border-success/20 px-5 py-3 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-success" />
                    <p className="text-success font-bold text-sm">Active Delivery — {activeDelivery.orderNumber}</p>
                  </div>
                  <div className="px-5 py-4 space-y-4">
                    {/* Live Map */}
                    <div className="h-52 rounded-xl overflow-hidden border border-zinc-700">
                      {hasValidMapKey ? (
                        <APIProvider apiKey={MAPS_API_KEY}>
                          <Map
                            defaultCenter={{
                              lat: (activeDelivery.restaurantCoords.lat + activeDelivery.customerCoords.lat) / 2,
                              lng: (activeDelivery.restaurantCoords.lng + activeDelivery.customerCoords.lng) / 2,
                            }}
                            defaultZoom={12}
                            gestureHandling="cooperative"
                            disableDefaultUI={true}
                            style={{ width: '100%', height: '100%' }}
                            mapId="DEMO_MAP_ID"
                          >
                            {/* Pickup marker */}
                            <AdvancedMarker position={activeDelivery.restaurantCoords} title={`Pickup: ${activeDelivery.restaurant}`}>
                              <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-orange-500 border-2 border-white shadow-lg flex items-center justify-center">
                                  <MapPin className="w-4 h-4 text-white" />
                                </div>
                                <div className="mt-0.5 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">Pickup</div>
                              </div>
                            </AdvancedMarker>

                            {/* Dropoff marker */}
                            <AdvancedMarker position={activeDelivery.customerCoords} title="Dropoff: Customer">
                              <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-red-500 border-2 border-white shadow-lg flex items-center justify-center">
                                  <MapPin className="w-4 h-4 text-white" />
                                </div>
                                <div className="mt-0.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">Dropoff</div>
                              </div>
                            </AdvancedMarker>

                            {/* Rider live position */}
                            <AdvancedMarker position={riderPos} title="Your Location">
                              <div className="flex flex-col items-center">
                                <div className="w-10 h-10 rounded-full bg-indigo-600 border-2 border-white shadow-xl flex items-center justify-center">
                                  <Bike className="w-5 h-5 text-white" />
                                </div>
                                <div className="mt-0.5 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">You</div>
                              </div>
                            </AdvancedMarker>
                          </Map>
                        </APIProvider>
                      ) : (
                        <div className="w-full h-full bg-zinc-800 flex flex-col items-center justify-center gap-2">
                          <MapPin className="w-8 h-8 text-zinc-600" />
                          <p className="text-xs text-zinc-500 text-center px-4">Add Google Maps API key to enable live navigation</p>
                        </div>
                      )}
                    </div>

                    <div className="bg-zinc-800 rounded-xl p-3.5">
                      <p className="text-xs text-zinc-500 mb-2 font-semibold">PICKUP FROM</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white">{activeDelivery.restaurant}</p>
                          <p className="text-xs text-zinc-400">{activeDelivery.restaurantAddr}</p>
                        </div>
                        <div className="flex gap-2">
                          <button className="w-9 h-9 rounded-xl bg-zinc-700 flex items-center justify-center hover:bg-zinc-600 transition-colors">
                            <Phone className="w-4 h-4 text-zinc-300" />
                          </button>
                          <button className="w-9 h-9 rounded-xl bg-zinc-700 flex items-center justify-center hover:bg-zinc-600 transition-colors">
                            <MessageCircle className="w-4 h-4 text-zinc-300" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="bg-zinc-800 rounded-xl p-3.5">
                      <p className="text-xs text-zinc-500 mb-2 font-semibold">DELIVER TO</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white">Customer</p>
                          <p className="text-xs text-zinc-400">{activeDelivery.customerAddr}</p>
                        </div>
                        <div className="flex gap-2">
                          <button className="w-9 h-9 rounded-xl bg-zinc-700 flex items-center justify-center hover:bg-zinc-600 transition-colors">
                            <Phone className="w-4 h-4 text-zinc-300" />
                          </button>
                          <button className="w-9 h-9 rounded-xl bg-zinc-700 flex items-center justify-center hover:bg-zinc-600 transition-colors">
                            <MessageCircle className="w-4 h-4 text-zinc-300" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={markPickedUp} className="flex-1 py-3 rounded-xl bg-warning/20 text-warning font-bold text-sm hover:bg-warning/30 transition-colors active:scale-95 flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Picked Up
                      </button>
                      <button onClick={markDelivered} className="flex-1 py-3 rounded-xl bg-success/20 text-success font-bold text-sm hover:bg-success/30 transition-colors active:scale-95 flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Delivered
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Today's Summary Cards */}
            <div className="px-4 mt-5">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Today&apos;s Summary</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'earn-total', label: 'Total Earnings', value: `$${todayEarnings.toFixed(2)}`, sub: 'Base + tips', icon: DollarSign, color: 'text-success', bg: 'bg-success/10' },
                  { id: 'earn-trips', label: 'Trips Completed', value: String(todayTrips), sub: 'Today', icon: Bike, color: 'text-rider', bg: 'bg-rider/10' },
                  { id: 'earn-distance', label: 'Distance', value: `${todayDistance} km`, sub: 'Total ridden', icon: Navigation, color: 'text-warning', bg: 'bg-warning/10' },
                  { id: 'earn-tips', label: 'Tips Earned', value: `$${todayTips.toFixed(2)}`, sub: 'Customer tips', icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
                ].map((card) => (
                  <div key={card.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.bg}`}>
                      <card.icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                    <p className={`text-xl font-bold font-tabular ${card.color}`}>{card.value}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{card.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* EARNINGS TAB */}
        {activeTab === 'earnings' && (
          <div className="px-4 mt-5 space-y-5">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Earnings Overview</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'e1', label: 'Today', value: `$${todayEarnings.toFixed(2)}`, color: 'text-success', bg: 'bg-success/10', icon: DollarSign },
                { id: 'e2', label: 'This Week', value: '$284.60', color: 'text-rider', bg: 'bg-rider/10', icon: DollarSign },
                { id: 'e3', label: 'Tips Today', value: `$${todayTips.toFixed(2)}`, color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: Star },
                { id: 'e4', label: 'Trips Today', value: String(todayTrips), color: 'text-warning', bg: 'bg-warning/10', icon: Bike },
              ].map((card) => (
                <div key={card.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.bg}`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                  <p className={`text-xl font-bold font-tabular ${card.color}`}>{card.value}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{card.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Weekly Chart</p>
              <EarningsChart />
            </div>
          </div>
        )}

        {/* TRIPS TAB */}
        {activeTab === 'trips' && (
          <div className="px-4 mt-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Recent Trips</p>
              <span className="text-xs text-zinc-600">{todayTrips} trips today</span>
            </div>
            <div className="space-y-2">
              {COMPLETED_TRIPS.map((trip) => (
                <div key={trip.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold text-white">{trip.orderNumber}</p>
                      <p className="text-xs text-zinc-400">{trip.restaurant} → {trip.customer}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-success font-tabular">${(trip.earnings + trip.tip).toFixed(2)}</p>
                      {trip.tip > 0 && <p className="text-xs text-yellow-400 font-tabular">+${trip.tip.toFixed(2)} tip</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{trip.duration}</span>
                    <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{trip.distance}</span>
                    <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-success" />{trip.completedAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="px-4 mt-5 space-y-4">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Account Settings</p>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-rider/20 flex items-center justify-center">
                  <Bike className="w-7 h-7 text-rider" />
                </div>
                <div>
                  <p className="font-bold text-white">Carlos Ramirez</p>
                  <p className="text-sm text-zinc-400">carlos.ramirez@riders.fooddash.app</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-3 h-3 text-warning fill-warning" />
                    <span className="text-xs text-zinc-400">4.92 rating · 1,247 trips</span>
                  </div>
                </div>
              </div>
              {[
                { label: 'Vehicle', value: 'Scooter · Honda PCX 125' },
                { label: 'License Plate', value: 'NYC-4821' },
                { label: 'Phone', value: '+1 (555) 234-5678' },
                { label: 'Bank Account', value: '····4521 (Chase)' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-3 border-t border-zinc-800">
                  <span className="text-sm text-zinc-400">{row.label}</span>
                  <span className="text-sm font-medium text-white">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-zinc-900 border-t border-zinc-800 flex items-center justify-around px-2 py-2 z-40">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all duration-150 ${
                isActive ? 'text-rider' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-semibold">{item.label}</span>
            </button>
          );
        })}
        <a href="/" className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all duration-150">
          <LogOut className="w-5 h-5" />
          <span className="text-xs font-semibold">Sign Out</span>
        </a>
      </nav>
    </div>
  );
}