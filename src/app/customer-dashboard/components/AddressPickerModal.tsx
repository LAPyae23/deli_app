'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { X, MapPin, Navigation, Crosshair } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, type MapMouseEvent } from '@vis.gl/react-google-maps';
import { toast } from 'sonner';

export type PickedAddress = {
  label: string;
  address: string;
  lat: number;
  lng: number;
};

const YANGON_CENTER = { lat: 16.8409, lng: 96.1735 };
const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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
  const [locating, setLocating] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const next = { lat: initialPosition.lat, lng: initialPosition.lng };
    setPin(next);
    setCenter(next);
    setLabel(initialLabel);
    setMapKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when modal opens or coords change
  }, [isOpen, initialPosition.lat, initialPosition.lng, initialLabel]);

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    const latLng = e.detail.latLng;
    if (!latLng) return;
    setPin({ lat: latLng.lat, lng: latLng.lng });
    setLabel('Pinned Location');
  }, []);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPin(next);
        setCenter(next);
        setLabel('Current Location');
        setMapKey((k) => k + 1);
        setLocating(false);
        toast.success('Location detected');
      },
      () => {
        setLocating(false);
        toast.error('Unable to get your location. Please allow location access.');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const handleConfirm = () => {
    onConfirm({
      label,
      address: `${label} · Yangon, Myanmar (${formatCoords(pin.lat, pin.lng)})`,
      lat: pin.lat,
      lng: pin.lng,
    });
    onClose();
  };

  if (!isOpen) return null;

  const hasValidMapKey = MAPS_API_KEY && MAPS_API_KEY !== 'your-google-maps-api-key-here';

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground">Pick Delivery Address</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Tap the map to drop a pin in Yangon</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="relative h-64 sm:h-80 w-full flex-shrink-0 bg-muted">
          {hasValidMapKey ? (
            <APIProvider apiKey={MAPS_API_KEY}>
              <Map
                key={mapKey}
                defaultCenter={center}
                defaultZoom={14}
                gestureHandling="greedy"
                disableDefaultUI={false}
                style={{ width: '100%', height: '100%' }}
                mapId="DEMO_MAP_ID"
                onClick={handleMapClick}
              >
                <AdvancedMarker position={pin} title={label}>
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-customer border-2 border-white shadow-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </AdvancedMarker>
              </Map>
            </APIProvider>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-6 text-center">
              <MapPin className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm font-semibold">Map unavailable</p>
              <p className="text-xs text-muted-foreground">Add a Google Maps API key to pick locations on the map.</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 space-y-3 border-t border-border">
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl border border-border">
            <Crosshair className="w-4 h-4 text-customer mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground font-tabular">
                {formatCoords(pin.lat, pin.lng)} · Yangon, Myanmar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-muted/40 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-60"
          >
            <Navigation className={`w-4 h-4 text-customer ${locating ? 'animate-pulse' : ''}`} />
            {locating ? 'Detecting location…' : 'Use Current Location'}
          </button>

          <button onClick={handleConfirm} className="btn-primary w-full py-3 justify-center">
            Confirm Address
          </button>
        </div>
      </div>
    </div>
  );
}
