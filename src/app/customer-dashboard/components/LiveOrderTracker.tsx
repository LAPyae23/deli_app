'use client';

import React, { useState, useEffect } from 'react';
import { CircleCheckBig, ChefHat, Bike, Package, Phone, MessageCircle, X } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';

const ORDER_STEPS = [
  { key: 'step-placed', status: 'PLACED', label: 'Order Placed', icon: Package, desc: 'Your order has been confirmed' },
  { key: 'step-preparing', status: 'PREPARING', label: 'Preparing', icon: ChefHat, desc: 'Burger Bliss is cooking your food' },
  { key: 'step-enroute', status: 'OUT_FOR_DELIVERY', label: 'On the Way', icon: Bike, desc: 'Carlos R. is heading to you' },
  { key: 'step-delivered', status: 'DELIVERED', label: 'Delivered', icon: CircleCheckBig, desc: 'Enjoy your meal!' },
];

const ACTIVE_STEP_INDEX = 2;

// Mock coordinates around Yangon, Myanmar
const RESTAURANT_LOCATION = { lat: 16.8452, lng: 96.1688 };
const CUSTOMER_LOCATION = { lat: 16.8564, lng: 96.1821 };
// Rider location (simulated between pickup and dropoff)
const INITIAL_RIDER_LOCATION = { lat: 16.8505, lng: 96.1752 };

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export default function LiveOrderTracker() {
  const [etaSeconds, setEtaSeconds] = useState(847);
  const [dismissed, setDismissed] = useState(false);
  const [riderLocation, setRiderLocation] = useState(INITIAL_RIDER_LOCATION);

  useEffect(() => {
    const interval = setInterval(() => {
      setEtaSeconds(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulate rider moving toward customer
  useEffect(() => {
    const interval = setInterval(() => {
      setRiderLocation(prev => ({
        lat: prev?.lat + (CUSTOMER_LOCATION?.lat - prev?.lat) * 0.02,
        lng: prev?.lng + (CUSTOMER_LOCATION?.lng - prev?.lng) * 0.02,
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (dismissed) return null;

  const etaMinutes = Math.floor(etaSeconds / 60);
  const etaSecsRem = etaSeconds % 60;

  const mapCenter = {
    lat: (riderLocation?.lat + CUSTOMER_LOCATION?.lat) / 2,
    lng: (riderLocation?.lng + CUSTOMER_LOCATION?.lng) / 2,
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden card-shadow-md animate-fade-in">
      {/* Header */}
      <div className="gradient-orange px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Bike className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-xs sm:text-sm truncate">Order #FP-8942 · Burger Bliss</p>
            <p className="text-white/70 text-xs truncate hidden sm:block">Smash Burger × 2, Truffle Fries × 1, Coke × 2</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-white/70 text-xs">Arrives in</p>
            <p className="text-white font-bold text-lg sm:text-xl font-tabular">
              {String(etaMinutes)?.padStart(2, '0')}:{String(etaSecsRem)?.padStart(2, '0')}
            </p>
          </div>
          <button onClick={() => setDismissed(true)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Live Map */}
      <div className="h-52 sm:h-64 w-full relative">
        {MAPS_API_KEY && MAPS_API_KEY !== 'your-google-maps-api-key-here' ? (
          <APIProvider apiKey={MAPS_API_KEY}>
            <Map
              defaultCenter={mapCenter}
              defaultZoom={13}
              gestureHandling="cooperative"
              disableDefaultUI={true}
              style={{ width: '100%', height: '100%' }}
              mapId="DEMO_MAP_ID"
            >
              {/* Restaurant marker */}
              <AdvancedMarker position={RESTAURANT_LOCATION} title="Burger Bliss (Pickup)">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-orange-500 border-2 border-white shadow-lg flex items-center justify-center">
                    <ChefHat className="w-4 h-4 text-white" />
                  </div>
                  <div className="mt-1 bg-white text-orange-600 text-[10px] font-bold px-1.5 py-0.5 rounded shadow">Restaurant</div>
                </div>
              </AdvancedMarker>

              {/* Customer / destination marker */}
              <AdvancedMarker position={CUSTOMER_LOCATION} title="Your Location (Dropoff)">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-white shadow-lg flex items-center justify-center">
                    <Package className="w-4 h-4 text-white" />
                  </div>
                  <div className="mt-1 bg-white text-green-600 text-[10px] font-bold px-1.5 py-0.5 rounded shadow">You</div>
                </div>
              </AdvancedMarker>

              {/* Rider marker (live position) */}
              <AdvancedMarker position={riderLocation} title="Carlos Ramirez (Rider)">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 border-2 border-white shadow-xl flex items-center justify-center animate-bounce">
                    <Bike className="w-5 h-5 text-white" />
                  </div>
                  <div className="mt-1 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">Rider</div>
                </div>
              </AdvancedMarker>
            </Map>
          </APIProvider>
        ) : (
          <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <Bike className="w-6 h-6 text-customer" />
            </div>
            <p className="text-sm font-semibold text-foreground">Live Map</p>
            <p className="text-xs text-muted-foreground text-center px-6">Add your Google Maps API key to enable real-time rider tracking</p>
          </div>
        )}
      </div>
      {/* Progress Steps */}
      <div className="px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex items-start sm:items-center justify-between relative">
          {/* Progress line */}
          <div className="absolute left-0 right-0 top-4 sm:top-5 h-0.5 bg-border mx-6 sm:mx-8" />
          <div
            className="absolute left-6 sm:left-8 top-4 sm:top-5 h-0.5 bg-customer transition-all duration-700"
            style={{ width: `${(ACTIVE_STEP_INDEX / (ORDER_STEPS?.length - 1)) * 100}%`, maxWidth: 'calc(100% - 3rem)' }}
          />
          {ORDER_STEPS?.map((step, i) => {
            const isCompleted = i < ACTIVE_STEP_INDEX;
            const isActive = i === ACTIVE_STEP_INDEX;
            return (
              <div key={step?.key} className="relative flex flex-col items-center gap-1.5 sm:gap-2 z-10">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                  isCompleted ? 'bg-customer border-customer' : isActive ? 'bg-orange-50 border-customer' : 'bg-card border-border'
                }`}>
                  <step.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isCompleted ? 'text-white' : isActive ? 'text-customer' : 'text-muted-foreground'}`} />
                  {isActive && <span className="absolute inset-0 rounded-full border-2 border-customer status-pulse" />}
                </div>
                <div className="text-center">
                  <p className={`text-[10px] sm:text-xs font-semibold ${isActive ? 'text-foreground' : isCompleted ? 'text-customer' : 'text-muted-foreground'}`}>
                    {step?.label}
                  </p>
                  {isActive && <p className="text-xs text-muted-foreground mt-0.5 hidden md:block">{step?.desc}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Rider Info */}
      <div className="px-4 sm:px-6 pb-4 sm:pb-5 flex items-center justify-between border-t border-border pt-3 sm:pt-4 gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Bike className="w-4 h-4 sm:w-5 sm:h-5 text-rider" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Carlos Ramirez</p>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground hidden sm:inline">Motorcycle ·</span>
              <span className="text-xs text-muted-foreground">⭐ 4.9</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold bg-muted rounded-lg hover:bg-border transition-colors">
            <Phone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Call</span>
          </button>
          <button className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold bg-muted rounded-lg hover:bg-border transition-colors">
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Message</span>
          </button>
        </div>
      </div>
    </div>
  );
}