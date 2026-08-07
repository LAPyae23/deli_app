'use client';

/**
 * Address picker using OpenStreetMap + Leaflet (free alternative to Google Maps).
 * Requires: npm install leaflet react-leaflet
 *           npm install -D @types/leaflet
 */

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { X, Navigation, Crosshair } from 'lucide-react';
import { toast } from 'sonner';

export type PickedAddress = {
  label: string;
  address: string;
  lat: number;
  lng: number;
};

const YANGON_CENTER = { lat: 16.8409, lng: 96.1735 };

const OsmMapPicker = dynamic(() => import('./OsmMapPicker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

interface AddressPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (address: PickedAddress) => void;
  initialPosition?: { lat: number; lng: number };
  initialLabel?: string;
}

function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.display_name as string) || null;
  } catch {
    return null;
  }
}

export default function AddressPickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialPosition = YANGON_CENTER,
  initialLabel = 'Selected Location',
}: AddressPickerModalProps) {
  const [pin, setPin] = useState(initialPosition);
  const [center, setCenter] = useState(initialPosition);
  const [label, setLabel] = useState(initialLabel);
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const next = { lat: initialPosition.lat, lng: initialPosition.lng };
    setPin(next);
    setCenter(next);
    setLabel(initialLabel);
    setResolvedAddress('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPosition.lat, initialPosition.lng, initialLabel]);

  const handlePick = useCallback(async (lat: number, lng: number) => {
    setPin({ lat, lng });
    setLabel('Pinned Location');
    setGeocoding(true);
    setResolvedAddress('Fetching address...');

    const address = await reverseGeocode(lat, lng);
    if (address) {
      setResolvedAddress(address);
    } else {
      setResolvedAddress(`Pinned location · ${formatCoords(lat, lng)}`);
      toast.error('Could not resolve street address. Coordinates will be used.');
    }
    setGeocoding(false);
  }, []);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPin(next);
        setCenter(next);
        setLabel('Current Location');
        setLocating(false);
        toast.success('Location detected');

        setGeocoding(true);
        setResolvedAddress('Fetching address...');
        const address = await reverseGeocode(next.lat, next.lng);
        setResolvedAddress(address || `Current location · ${formatCoords(next.lat, next.lng)}`);
        setGeocoding(false);
      },
      () => {
        setLocating(false);
        toast.error('Unable to get your location. Please allow location access.');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const handleConfirm = () => {
    const address =
      resolvedAddress && resolvedAddress !== 'Fetching address...'
        ? resolvedAddress
        : `${label} · Yangon, Myanmar (${formatCoords(pin.lat, pin.lng)})`;

    onConfirm({
      label,
      address,
      lat: pin.lat,
      lng: pin.lng,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Pick Delivery Address</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tap the map to drop a pin (OpenStreetMap)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors hover:bg-border"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="relative h-64 w-full flex-shrink-0 bg-muted sm:h-80">
          <OsmMapPicker center={center} pin={pin} onPick={handlePick} />
        </div>

        <div className="space-y-3 border-t border-border px-5 py-4">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-3">
            <Crosshair className="mt-0.5 h-4 w-4 flex-shrink-0 text-customer" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground font-tabular">
                {formatCoords(pin.lat, pin.lng)}
              </p>
              {resolvedAddress && (
                <p className="mt-1 text-xs text-foreground">
                  {geocoding ? 'Fetching address…' : resolvedAddress}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            <Navigation className={`h-4 w-4 text-customer ${locating ? 'animate-pulse' : ''}`} />
            {locating ? 'Detecting location…' : 'Use Current Location'}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={geocoding}
            className="btn-primary w-full justify-center py-3"
          >
            Confirm Address
          </button>
        </div>
      </div>
    </div>
  );
}
