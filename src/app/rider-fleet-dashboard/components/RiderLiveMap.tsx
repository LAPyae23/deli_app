'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Bike, Package, Store } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

type LatLng = { lat: number; lng: number };

const FALLBACK_PICKUP = { lat: 16.8409, lng: 96.1735 };
const FALLBACK_DROPOFF = { lat: 16.8564, lng: 96.1821 };

interface RiderLiveMapProps {
  pickupCoords: LatLng;
  dropoffCoords: LatLng;
  riderCoords: LatLng;
}

function safeCoords(coords: LatLng | null | undefined, fallback: LatLng): LatLng {
  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
    return { lat, lng };
  }
  return fallback;
}

function makeDivIcon(html: string, size: [number, number], anchor: [number, number]) {
  return L.divIcon({
    className: 'rider-live-marker',
    html,
    iconSize: size,
    iconAnchor: anchor,
  });
}

async function fetchOsrmRoute(
  start: LatLng,
  end: LatLng
): Promise<L.LatLngExpression[]> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${start.lng},${start.lat};${end.lng},${end.lat}` +
    `?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const coords = data?.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords)) return [];

  // GeoJSON is [lng, lat] → Leaflet needs [lat, lng]
  return coords.map((pair: number[]) => [pair[1], pair[0]] as L.LatLngExpression);
}

function FitBounds({
  pickupCoords,
  dropoffCoords,
  riderCoords,
}: RiderLiveMapProps) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([
      [pickupCoords.lat, pickupCoords.lng],
      [dropoffCoords.lat, dropoffCoords.lng],
      [riderCoords.lat, riderCoords.lng],
    ]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [
    map,
    pickupCoords.lat,
    pickupCoords.lng,
    dropoffCoords.lat,
    dropoffCoords.lng,
    riderCoords.lat,
    riderCoords.lng,
  ]);

  return null;
}

export default function RiderLiveMap({
  pickupCoords: pickupProp,
  dropoffCoords: dropoffProp,
  riderCoords: riderProp,
}: RiderLiveMapProps) {
  const pickupCoords = safeCoords(pickupProp, FALLBACK_PICKUP);
  const dropoffCoords = safeCoords(dropoffProp, FALLBACK_DROPOFF);
  const riderCoords = safeCoords(riderProp, pickupCoords);

  const [routePath, setRoutePath] = useState<L.LatLngExpression[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadRoute() {
      try {
        const path = await fetchOsrmRoute(pickupCoords, dropoffCoords);
        if (!cancelled) setRoutePath(path);
      } catch (error) {
        console.warn('OSRM route fetch failed:', error);
        if (!cancelled) setRoutePath([]);
      }
    }

    loadRoute();
    return () => {
      cancelled = true;
    };
  }, [
    pickupCoords.lat,
    pickupCoords.lng,
    dropoffCoords.lat,
    dropoffCoords.lng,
  ]);

  const pickupIcon = useMemo(() => {
    const iconSvg = renderToStaticMarkup(
      <Store size={16} color="white" strokeWidth={2.25} />
    );
    return makeDivIcon(
      `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:32px;height:32px;border-radius:9999px;background:#f97316;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;">
          ${iconSvg}
        </div>
        <div style="margin-top:4px;background:#fff;color:#ea580c;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.15);">Pickup</div>
      </div>`,
      [72, 56],
      [36, 40]
    );
  }, []);

  const dropoffIcon = useMemo(() => {
    const iconSvg = renderToStaticMarkup(
      <Package size={16} color="white" strokeWidth={2.25} />
    );
    return makeDivIcon(
      `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:32px;height:32px;border-radius:9999px;background:#22c55e;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;">
          ${iconSvg}
        </div>
        <div style="margin-top:4px;background:#fff;color:#16a34a;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.15);">Dropoff</div>
      </div>`,
      [64, 56],
      [32, 40]
    );
  }, []);

  const riderIcon = useMemo(() => {
    const iconSvg = renderToStaticMarkup(
      <Bike size={18} color="white" strokeWidth={2.25} />
    );
    return makeDivIcon(
      `<div style="display:flex;flex-direction:column;align-items:center;" class="animate-bounce">
        <div style="width:40px;height:40px;border-radius:9999px;background:#4f46e5;border:2px solid #fff;box-shadow:0 6px 16px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;">
          ${iconSvg}
        </div>
        <div style="margin-top:4px;background:#4f46e5;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.2);">You</div>
      </div>`,
      [64, 64],
      [32, 48]
    );
  }, []);

  const center: LatLng = {
    lat: (pickupCoords.lat + dropoffCoords.lat) / 2,
    lng: (pickupCoords.lng + dropoffCoords.lng) / 2,
  };

  return (
    <div className="h-full w-full [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full">
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
        <FitBounds
          pickupCoords={pickupCoords}
          dropoffCoords={dropoffCoords}
          riderCoords={riderCoords}
        />
        {routePath.length > 0 && (
          <Polyline
            positions={routePath}
            pathOptions={{ color: '#6366F1', weight: 4, opacity: 0.9 }}
          />
        )}
        {/* Pickup / Restaurant marker (orange Store icon) */}
        <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={pickupIcon} />
        {/* Dropoff / Customer marker (green Package icon) */}
        <Marker position={[dropoffCoords.lat, dropoffCoords.lng]} icon={dropoffIcon} />
        {/* Rider marker (indigo Bike icon) */}
        <Marker position={[riderCoords.lat, riderCoords.lng]} icon={riderIcon} />
      </MapContainer>
    </div>
  );
}
