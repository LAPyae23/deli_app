'use client';

import React, { useEffect, useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Bike } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

type LatLng = { lat: number; lng: number };

interface RiderIdleMapProps {
  riderCoords: LatLng;
}

function makeDivIcon(html: string, size: [number, number], anchor: [number, number]) {
  return L.divIcon({
    className: 'rider-route-marker',
    html,
    iconSize: size,
    iconAnchor: anchor,
  });
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

function UpdateCenter({ coords }: { coords: LatLng }) {
  const map = useMap();

  useEffect(() => {
    const lat = Number(coords?.lat);
    const lng = Number(coords?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.setView([lat, lng], 15, { animate: true });
  }, [map, coords.lat, coords.lng]);

  return null;
}

export default function RiderIdleMap({ riderCoords }: RiderIdleMapProps) {
  const lat = Number(riderCoords?.lat);
  const lng = Number(riderCoords?.lng);
  const coords: LatLng = {
    lat: Number.isFinite(lat) ? lat : 16.8409,
    lng: Number.isFinite(lng) ? lng : 96.1735,
  };
  const youIcon = useMemo(() => riderIcon(), []);

  return (
    <div className="relative h-full w-full [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full">
      <MapContainer
        center={[coords.lat, coords.lng]}
        zoom={15}
        scrollWheelZoom={false}
        style={{ width: '100%', height: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <UpdateCenter coords={coords} />
        <Marker position={[coords.lat, coords.lng]} icon={youIcon} />
      </MapContainer>
    </div>
  );
}
