'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Bike, Navigation, Package, Store } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

type LatLng = { lat: number; lng: number };
type DeliveryStatus = 'ACCEPTED' | 'PICKED_UP';

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

function FitBounds({ start, end }: { start: LatLng; end: LatLng }) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([
      [start.lat, start.lng],
      [end.lat, end.lng],
    ]);
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 15 });
  }, [map, start.lat, start.lng, end.lat, end.lng]);

  return null;
}

export default function RiderRouteMap({
  riderCoords,
  restaurantCoords,
  customerCoords,
  deliveryStatus,
}: RiderRouteMapProps) {
  const [routePath, setRoutePath] = useState<L.LatLngExpression[]>([]);
  const [etaStr, setEtaStr] = useState('');
  const [distanceStr, setDistanceStr] = useState('');

  const start = deliveryStatus === 'ACCEPTED' ? riderCoords : restaurantCoords;
  const end = deliveryStatus === 'ACCEPTED' ? restaurantCoords : customerCoords;
  const destinationLabel =
    deliveryStatus === 'ACCEPTED' ? 'Restaurant (Pick-up)' : 'Customer (Drop-off)';

  useEffect(() => {
    let cancelled = false;

    async function loadRoute() {
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${start.lng},${start.lat};${end.lng},${end.lat}` +
          `?overview=full&geometries=geojson`;

        const res = await fetch(url);
        if (!res.ok) {
          if (!cancelled) {
            setRoutePath([]);
            setEtaStr('');
            setDistanceStr('');
          }
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coords = route.geometry?.coordinates;
          if (Array.isArray(coords)) {
            setRoutePath(
              coords.map((pair: number[]) => [pair[1], pair[0]] as L.LatLngExpression)
            );
          } else {
            setRoutePath([]);
          }

          const distKm = (route.distance / 1000).toFixed(1);
          const mins = Math.round(route.duration / 60);
          setDistanceStr(`${distKm} km`);
          setEtaStr(`${mins} mins`);
        } else {
          setRoutePath([]);
          setEtaStr('');
          setDistanceStr('');
        }
      } catch (error) {
        console.warn('OSRM route fetch failed:', error);
        if (!cancelled) {
          setRoutePath([]);
          setEtaStr('');
          setDistanceStr('');
        }
      }
    }

    loadRoute();
    return () => {
      cancelled = true;
    };
  }, [start.lat, start.lng, end.lat, end.lng, deliveryStatus]);

  const startIcon = useMemo(() => {
    if (deliveryStatus === 'ACCEPTED') {
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

    const iconSvg = renderToStaticMarkup(
      <Store size={16} color="white" strokeWidth={2.25} />
    );
    return makeDivIcon(
      `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:32px;height:32px;border-radius:9999px;background:#f97316;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;">
          ${iconSvg}
        </div>
        <div style="margin-top:4px;background:#fff;color:#ea580c;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">Pickup</div>
      </div>`,
      [72, 56],
      [36, 40]
    );
  }, [deliveryStatus]);

  const endIcon = useMemo(() => {
    if (deliveryStatus === 'ACCEPTED') {
      const iconSvg = renderToStaticMarkup(
        <Store size={16} color="white" strokeWidth={2.25} />
      );
      return makeDivIcon(
        `<div style="display:flex;flex-direction:column;align-items:center;">
          <div style="width:32px;height:32px;border-radius:9999px;background:#f97316;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;">
            ${iconSvg}
          </div>
          <div style="margin-top:4px;background:#fff;color:#ea580c;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">Restaurant</div>
        </div>`,
        [72, 56],
        [36, 40]
      );
    }

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
  }, [deliveryStatus]);

  const center: LatLng = {
    lat: (start.lat + end.lat) / 2,
    lng: (start.lng + end.lng) / 2,
  };

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
        <FitBounds start={start} end={end} />
        {routePath.length > 0 && (
          <Polyline
            positions={routePath}
            pathOptions={{ color: '#6366F1', weight: 4, opacity: 0.9 }}
          />
        )}
        <Marker position={[start.lat, start.lng]} icon={startIcon} />
        <Marker position={[end.lat, end.lng]} icon={endIcon} />
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[1000]">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-500">
              Heading to {deliveryStatus === 'ACCEPTED' ? 'Restaurant' : 'Customer'}
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
                `https://www.google.com/maps/dir/?api=1&destination=${end.lat},${end.lng}`,
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
