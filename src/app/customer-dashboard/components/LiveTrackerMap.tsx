'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Bike, ChefHat, Package } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

type LatLng = { lat: number; lng: number };

interface LiveTrackerMapProps {
  restaurantLocation: LatLng;
  customerLocation: LatLng;
  riderLocation?: LatLng | null;
  showRider?: boolean;
}

function makeDivIcon(html: string, size: [number, number], anchor: [number, number]) {
  return L.divIcon({
    className: 'live-tracker-marker',
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
  restaurantLocation,
  customerLocation,
}: {
  restaurantLocation: LatLng;
  customerLocation: LatLng;
}) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([
      [restaurantLocation.lat, restaurantLocation.lng],
      [customerLocation.lat, customerLocation.lng],
    ]);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [
    map,
    restaurantLocation.lat,
    restaurantLocation.lng,
    customerLocation.lat,
    customerLocation.lng,
  ]);

  return null;
}

export default function LiveTrackerMap({
  restaurantLocation,
  customerLocation,
  riderLocation,
  showRider = false,
}: LiveTrackerMapProps) {
  const [routePath, setRoutePath] = useState<L.LatLngExpression[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadRoute() {
      try {
        const path = await fetchOsrmRoute(restaurantLocation, customerLocation);
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
    restaurantLocation.lat,
    restaurantLocation.lng,
    customerLocation.lat,
    customerLocation.lng,
  ]);

  const restaurantIcon = useMemo(() => {
    const iconSvg = renderToStaticMarkup(
      <ChefHat size={16} color="white" strokeWidth={2.25} />
    );
    return makeDivIcon(
      `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:32px;height:32px;border-radius:9999px;background:#f97316;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;">
          ${iconSvg}
        </div>
        <div style="margin-top:4px;background:#fff;color:#ea580c;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.15);">Restaurant</div>
      </div>`,
      [72, 56],
      [36, 40]
    );
  }, []);

  const customerIcon = useMemo(() => {
    const iconSvg = renderToStaticMarkup(
      <Package size={16} color="white" strokeWidth={2.25} />
    );
    return makeDivIcon(
      `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:32px;height:32px;border-radius:9999px;background:#22c55e;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;">
          ${iconSvg}
        </div>
        <div style="margin-top:4px;background:#fff;color:#16a34a;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.15);">You</div>
      </div>`,
      [56, 56],
      [28, 40]
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
        <div style="margin-top:4px;background:#4f46e5;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.2);">Rider</div>
      </div>`,
      [64, 64],
      [32, 48]
    );
  }, []);

  const center: LatLng = {
    lat: (restaurantLocation.lat + customerLocation.lat) / 2,
    lng: (restaurantLocation.lng + customerLocation.lng) / 2,
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
          restaurantLocation={restaurantLocation}
          customerLocation={customerLocation}
        />
        {routePath.length > 0 && (
          <Polyline
            positions={routePath}
            pathOptions={{ color: '#6366F1', weight: 4, opacity: 0.9 }}
          />
        )}
        <Marker
          position={[restaurantLocation.lat, restaurantLocation.lng]}
          icon={restaurantIcon}
        />
        <Marker
          position={[customerLocation.lat, customerLocation.lng]}
          icon={customerIcon}
        />
        {showRider && riderLocation && (
          <Marker
            position={[riderLocation.lat, riderLocation.lng]}
            icon={riderIcon}
          />
        )}
      </MapContainer>
    </div>
  );
}
