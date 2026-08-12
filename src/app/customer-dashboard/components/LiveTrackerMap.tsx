'use client';

import 'leaflet/dist/leaflet.css';
import React, { useEffect, useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Bike, Package, Store } from 'lucide-react';

type LatLng = { lat: number; lng: number };

interface LiveTrackerMapProps {
  restaurantLocation: LatLng;
  customerLocation: LatLng;
  riderLocation?: LatLng | null;
  showRider?: boolean;
  /** Restaurant logo for pickup marker */
  restaurantLogoUrl?: string | null;
  restaurantName?: string;
  /** Estimated delivery minutes (prepTime + travelMins) */
  etaMinutes?: number | null;
  status?: string;
}

function makeDivIcon(html: string, size: [number, number], anchor: [number, number]) {
  return L.divIcon({
    className: 'live-tracker-marker',
    html,
    iconSize: size,
    iconAnchor: anchor,
  });
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
  restaurantLogoUrl,
  restaurantName = 'Restaurant',
  etaMinutes = null,
  status = '',
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

  const storeFallbackSvg = useMemo(
    () => renderToStaticMarkup(<Store size={18} color="#E62429" strokeWidth={2.25} />),
    []
  );

  const restaurantIcon = useMemo(() => {
    const logo = restaurantLogoUrl?.trim();
    const label = escapeAttr(restaurantName.slice(0, 18));
    const markerBody = logo
      ? `<img
          src="${escapeAttr(logo)}"
          alt="${label}"
          style="width:100%;height:100%;object-fit:cover;border-radius:9999px;display:block;"
          onerror="this.style.display='none';var f=this.nextElementSibling;if(f)f.style.display='flex';"
        /><div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;background:#fff;">${storeFallbackSvg}</div>`
      : `<div style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#fff;">${storeFallbackSvg}</div>`;

    return makeDivIcon(
      `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:44px;height:44px;border-radius:9999px;overflow:hidden;border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.28);background:#FEE2E2;">
          ${markerBody}
        </div>
        <div style="margin-top:4px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#fff;color:#E62429;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.15);">${label}</div>
      </div>`,
      [96, 68],
      [48, 48]
    );
  }, [restaurantLogoUrl, restaurantName, storeFallbackSvg]);

  const customerIcon = useMemo(() => {
    const iconSvg = renderToStaticMarkup(
      <Package size={16} color="white" strokeWidth={2.25} />
    );
    return makeDivIcon(
      `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:32px;height:32px;border-radius:9999px;background:#16A34A;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;">
          ${iconSvg}
        </div>
        <div style="margin-top:4px;background:#fff;color:#16A34A;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.15);">You</div>
      </div>`,
      [56, 56],
      [28, 40]
    );
  }, []);

  const riderIcon = useMemo(() => {
    const iconSvg = renderToStaticMarkup(
      <Bike size={20} color="white" strokeWidth={2.25} />
    );
    return makeDivIcon(
      `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:42px;height:42px;border-radius:9999px;background:#0878D1;border:2.5px solid #fff;box-shadow:0 6px 16px rgba(8,120,209,.45);display:flex;align-items:center;justify-content:center;">
          ${iconSvg}
        </div>
        <div style="margin-top:4px;background:#0878D1;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.2);">Rider</div>
      </div>`,
      [72, 66],
      [36, 48]
    );
  }, []);

  const center: LatLng = {
    lat: (restaurantLocation.lat + customerLocation.lat) / 2,
    lng: (restaurantLocation.lng + customerLocation.lng) / 2,
  };

  const etaLabel =
    etaMinutes != null && Number.isFinite(etaMinutes) && etaMinutes > 0
      ? `${Math.round(etaMinutes)} min`
      : '—';

  return (
    <div className="relative h-full w-full [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', minHeight: '250px', zIndex: 0 }}
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
            pathOptions={{ color: '#1769AA', weight: 4, opacity: 0.85 }}
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

      {/* Floating ETA card */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-[1000] flex justify-center sm:left-auto sm:right-3 sm:justify-end">
        <div className="pointer-events-auto min-w-[160px] rounded-2xl border border-border/80 bg-card/95 px-4 py-3 shadow-lg shadow-black/10 backdrop-blur-md">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Estimated delivery
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {etaLabel}
          </p>
          {status ? (
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">
              {String(status).replace(/_/g, ' ')}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
