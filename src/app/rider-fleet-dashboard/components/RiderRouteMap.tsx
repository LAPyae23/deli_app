'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Bike, Navigation, Package, Store } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

type LatLng = { lat: number; lng: number };
type DeliveryStatus = 'ACCEPTED' | 'PICKED_UP' | 'PREVIEW';

interface RiderRouteMapProps {
  riderCoords: LatLng;
  restaurantCoords: LatLng;
  customerCoords: LatLng;
  deliveryStatus: DeliveryStatus;
}

function makeDivIcon(html: string, size: [number, number], anchor: [number, number]) {
  return L.divIcon({
    className: 'rider-route-marker',
    html,
    iconSize: size,
    iconAnchor: anchor,
  });
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat},${p.lng}`).join('|');

  useEffect(() => {
    if (points.length < 1) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as L.LatLngTuple));
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}

async function fetchOsrmPath(start: LatLng, end: LatLng) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${start.lng},${start.lat};${end.lng},${end.lat}` +
    `?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return { path: [] as L.LatLngExpression[], km: 0, mins: 0 };
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return { path: [] as L.LatLngExpression[], km: 0, mins: 0 };
  const coords = Array.isArray(route.geometry?.coordinates)
    ? route.geometry.coordinates.map(
        (pair: number[]) => [pair[1], pair[0]] as L.LatLngExpression
      )
    : [];
  return {
    path: coords,
    km: route.distance / 1000,
    mins: Math.round(route.duration / 60),
  };
}

function riderIcon() {
  const iconSvg = renderToStaticMarkup(
    <Bike size={18} color="white" strokeWidth={2.25} />
  );
  return makeDivIcon(
    `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:40px;height:40px;border-radius:9999px;background:#4f46e5;border:2px solid #fff;box-shadow:0 6px 16px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;">
        ${iconSvg}
      </div>
      <div style="margin-top:4px;background:#4f46e5;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">You</div>
    </div>`,
    [64, 64],
    [32, 48]
  );
}

function storeIcon(label: string) {
  const iconSvg = renderToStaticMarkup(
    <Store size={16} color="white" strokeWidth={2.25} />
  );
  return makeDivIcon(
    `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:32px;height:32px;border-radius:9999px;background:#f97316;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;">
        ${iconSvg}
      </div>
      <div style="margin-top:4px;background:#fff;color:#ea580c;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">${label}</div>
    </div>`,
    [72, 56],
    [36, 40]
  );
}

function dropoffIcon() {
  const iconSvg = renderToStaticMarkup(
    <Package size={16} color="white" strokeWidth={2.25} />
  );
  return makeDivIcon(
    `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:32px;height:32px;border-radius:9999px;background:#22c55e;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;">
        ${iconSvg}
      </div>
      <div style="margin-top:4px;background:#fff;color:#16a34a;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">Dropoff</div>
    </div>`,
    [64, 56],
    [32, 40]
  );
}

export default function RiderRouteMap({
  riderCoords,
  restaurantCoords,
  customerCoords,
  deliveryStatus,
}: RiderRouteMapProps) {
  const isPreview = deliveryStatus === 'PREVIEW';
  const [pickupPath, setPickupPath] = useState<L.LatLngExpression[]>([]);
  const [dropoffPath, setDropoffPath] = useState<L.LatLngExpression[]>([]);
  const [etaStr, setEtaStr] = useState('');
  const [distanceStr, setDistanceStr] = useState('');

  const start = deliveryStatus === 'PICKED_UP' ? restaurantCoords : riderCoords;
  const end = deliveryStatus === 'PICKED_UP' ? customerCoords : restaurantCoords;
  const destinationLabel = isPreview
    ? 'Pickup & drop-off'
    : deliveryStatus === 'ACCEPTED'
      ? 'Restaurant (Pick-up)'
      : 'Customer (Drop-off)';

  useEffect(() => {
    let cancelled = false;

    async function loadRoute() {
      try {
        if (isPreview) {
          const [pickup, dropoff] = await Promise.all([
            fetchOsrmPath(riderCoords, restaurantCoords),
            fetchOsrmPath(restaurantCoords, customerCoords),
          ]);
          if (cancelled) return;
          setPickupPath(pickup.path);
          setDropoffPath(dropoff.path);
          const km = pickup.km + dropoff.km;
          const mins = pickup.mins + dropoff.mins;
          setDistanceStr(km > 0 ? `${km.toFixed(1)} km` : '');
          setEtaStr(mins > 0 ? `${mins} mins` : '');
          return;
        }

        const result = await fetchOsrmPath(start, end);
        if (cancelled) return;
        setPickupPath(result.path);
        setDropoffPath([]);
        setDistanceStr(result.km > 0 ? `${result.km.toFixed(1)} km` : '');
        setEtaStr(result.mins > 0 ? `${result.mins} mins` : '');
      } catch (error) {
        console.warn('OSRM route fetch failed:', error);
        if (!cancelled) {
          setPickupPath([]);
          setDropoffPath([]);
          setEtaStr('');
          setDistanceStr('');
        }
      }
    }

    loadRoute();
    return () => {
      cancelled = true;
    };
  }, [
    isPreview,
    riderCoords.lat,
    riderCoords.lng,
    restaurantCoords.lat,
    restaurantCoords.lng,
    customerCoords.lat,
    customerCoords.lng,
    start.lat,
    start.lng,
    end.lat,
    end.lng,
    deliveryStatus,
  ]);

  const youIcon = useMemo(() => riderIcon(), []);
  const pickupMarker = useMemo(
    () => storeIcon(deliveryStatus === 'ACCEPTED' ? 'Restaurant' : 'Pickup'),
    [deliveryStatus]
  );
  const dropMarker = useMemo(() => dropoffIcon(), []);

  const fitPoints = isPreview
    ? [riderCoords, restaurantCoords, customerCoords]
    : [start, end];

  const center: LatLng = {
    lat: (restaurantCoords.lat + customerCoords.lat + riderCoords.lat) / 3,
    lng: (restaurantCoords.lng + customerCoords.lng + riderCoords.lng) / 3,
  };

  const navTarget = isPreview ? restaurantCoords : end;

  return (
    <div className="relative h-full w-full [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ width: '100%', height: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={fitPoints} />
        {pickupPath.length > 0 && (
          <Polyline
            positions={pickupPath}
            pathOptions={{ color: '#6366F1', weight: 4, opacity: 0.9 }}
          />
        )}
        {dropoffPath.length > 0 && (
          <Polyline
            positions={dropoffPath}
            pathOptions={{ color: '#22c55e', weight: 4, opacity: 0.9, dashArray: '8 8' }}
          />
        )}
        {(isPreview || deliveryStatus === 'ACCEPTED') && (
          <Marker position={[riderCoords.lat, riderCoords.lng]} icon={youIcon} />
        )}
        <Marker
          position={[restaurantCoords.lat, restaurantCoords.lng]}
          icon={pickupMarker}
        />
        {(isPreview || deliveryStatus === 'PICKED_UP') && (
          <Marker position={[customerCoords.lat, customerCoords.lng]} icon={dropMarker} />
        )}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[1000]">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-500">
              {isPreview
                ? 'Full trip preview'
                : `Heading to ${deliveryStatus === 'ACCEPTED' ? 'Restaurant' : 'Customer'}`}
            </p>
            <p className="truncate text-sm font-semibold text-slate-900">
              {destinationLabel}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-600 font-tabular">
              ETA: {etaStr || '—'} • {distanceStr || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${navTarget.lat},${navTarget.lng}`,
                '_blank'
              )
            }
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Navigation className="h-3.5 w-3.5" />
            Navigate
          </button>
        </div>
      </div>
    </div>
  );
}
