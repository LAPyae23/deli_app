'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), {
  ssr: false,
});
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), {
  ssr: false,
});
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((m) => m.Polyline), { ssr: false });

type LatLng = { lat: number; lng: number };

interface CustomerRouteMapProps {
  restaurantCoords: LatLng;
  customerCoords: LatLng;
  status: string;
}

export default function CustomerRouteMap({
  restaurantCoords,
  customerCoords,
  status,
}: CustomerRouteMapProps) {
  const [routePositions, setRoutePositions] = useState<[number, number][]>([]);
  const [etaStr, setEtaStr] = useState('');
  const [distanceStr, setDistanceStr] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fixIcons() {
      const L = (await import('leaflet')).default;
      if (cancelled) return;
      const DefaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      L.Marker.prototype.options.icon = DefaultIcon;
      setMounted(true);
    }
    void fixIcons();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchRoute = async () => {
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${restaurantCoords.lng},${restaurantCoords.lat};` +
          `${customerCoords.lng},${customerCoords.lat}` +
          `?overview=full&geometries=geojson`;

        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;

        if (data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates;
          const latLngs = coords.map((c: number[]) => [c[1], c[0]] as [number, number]);
          setRoutePositions(latLngs);

          const distKm = (data.routes[0].distance / 1000).toFixed(1);
          const mins = Math.round(data.routes[0].duration / 60);
          setDistanceStr(`${distKm} km`);
          setEtaStr(`${mins} mins`);
        }
      } catch (error) {
        console.error('Error fetching OSRM route:', error);
      }
    };

    fetchRoute();
    return () => {
      cancelled = true;
    };
  }, [
    restaurantCoords.lat,
    restaurantCoords.lng,
    customerCoords.lat,
    customerCoords.lng,
  ]);

  const center: [number, number] = [
    (restaurantCoords.lat + customerCoords.lat) / 2,
    (restaurantCoords.lng + customerCoords.lng) / 2,
  ];

  if (!mounted) {
    return (
      <div className="mt-4 flex h-[250px] w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-muted text-sm text-muted-foreground">
        Loading map…
      </div>
    );
  }

  return (
    <div className="relative mt-4 h-[250px] w-full overflow-hidden rounded-xl border border-border">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {routePositions.length > 0 && (
          <Polyline
            positions={routePositions}
            pathOptions={{ color: '#F97316', weight: 4, dashArray: '5, 10' }}
          />
        )}
        <Marker position={[restaurantCoords.lat, restaurantCoords.lng]}>
          <Popup>Restaurant</Popup>
        </Marker>
        <Marker position={[customerCoords.lat, customerCoords.lng]}>
          <Popup>Your delivery location</Popup>
        </Marker>
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-lg border border-border bg-card/95 px-3 py-2 shadow-md backdrop-blur">
        <p className="text-xs font-semibold text-foreground">
          Estimated delivery in {etaStr || '—'}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {distanceStr || '—'} · {status.replace(/_/g, ' ')}
        </p>
      </div>
    </div>
  );
}
