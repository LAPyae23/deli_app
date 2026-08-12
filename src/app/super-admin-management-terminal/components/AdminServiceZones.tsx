'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { renderToStaticMarkup } from 'react-dom/server';
import { Loader2, Store } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-card text-muted-foreground">
      Loading map…
    </div>
  ),
});
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then((m) => m.Circle), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });

const YANGON_CENTER: [number, number] = [16.8409, 96.1735];

/** Soft township rings for context (shops are the primary markers) */
const TOWNSHIP_ZONES = [
  { name: 'South Dagon', lat: 16.8512, lng: 96.2128, radius: 1800, color: '#0878D1' },
  { name: 'Bahan', lat: 16.8156, lng: 96.1536, radius: 1600, color: '#E62429' },
  { name: 'Kyauktada', lat: 16.7738, lng: 96.1621, radius: 1200, color: '#16A34A' },
  { name: 'Pabedan', lat: 16.7785, lng: 96.1558, radius: 1100, color: '#D97706' },
  { name: 'Latha', lat: 16.7758, lng: 96.1502, radius: 1100, color: '#1769AA' },
  { name: 'Lanmadaw', lat: 16.773, lng: 96.142, radius: 1200, color: '#7C3AED' },
  { name: 'Sanchaung', lat: 16.8068, lng: 96.1334, radius: 1500, color: '#E62429' },
  { name: 'Mayangone', lat: 16.868, lng: 96.152, radius: 1800, color: '#0878D1' },
  { name: 'South Okkalapa', lat: 16.847, lng: 96.182, radius: 1600, color: '#16A34A' },
  { name: 'North Okkalapa', lat: 16.88, lng: 96.158, radius: 1600, color: '#D97706' },
];

type MapRestaurant = {
  restaurantId: string;
  restaurantName: string;
  logoImage?: string;
  township?: string;
  storeStatus?: string;
  location?: { lat?: number; lng?: number };
};

function escapeAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function RestaurantMarkers({ restaurants }: { restaurants: MapRestaurant[] }) {
  const [L, setL] = useState<typeof import('leaflet') | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((mod) => {
      if (!cancelled) setL(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const storeSvg = useMemo(() => {
    if (!L) return '';
    return renderToStaticMarkup(<Store size={16} color="#1769AA" strokeWidth={2.25} />);
  }, [L]);

  const icons = useMemo(() => {
    if (!L) return new Map<string, import('leaflet').DivIcon>();
    const map = new Map<string, import('leaflet').DivIcon>();
    for (const r of restaurants) {
      const logo = r.logoImage?.trim();
      const name = escapeAttr((r.restaurantName || 'Shop').slice(0, 20));
      const body = logo
        ? `<img src="${escapeAttr(logo)}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:9999px;display:block;" onerror="this.style.display='none';var f=this.nextElementSibling;if(f)f.style.display='flex';" /><div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;background:#EFF6FF;">${storeSvg}</div>`
        : `<div style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#EFF6FF;">${storeSvg}</div>`;

      map.set(
        r.restaurantId,
        L.divIcon({
          className: 'admin-rest-marker',
          html: `<div style="display:flex;flex-direction:column;align-items:center;">
            <div style="width:36px;height:36px;border-radius:9999px;overflow:hidden;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.28);background:#EFF6FF;">
              ${body}
            </div>
          </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        })
      );
    }
    return map;
  }, [L, restaurants, storeSvg]);

  if (!L) return null;

  return (
    <>
      {restaurants.map((r) => {
        const lat = Number(r.location?.lat);
        const lng = Number(r.location?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const icon = icons.get(r.restaurantId);
        if (!icon) return null;
        return (
          <Marker key={r.restaurantId} position={[lat, lng]} icon={icon}>
            <Popup>
              <div className="min-w-[140px]">
                <p className="text-sm font-bold text-foreground">{r.restaurantName}</p>
                {r.township ? (
                  <p className="text-xs text-muted-foreground">{r.township}</p>
                ) : null}
                {r.storeStatus ? (
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-admin">
                    {r.storeStatus}
                  </p>
                ) : null}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export default function AdminServiceZones() {
  const [restaurants, setRestaurants] = useState<MapRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/restaurants?approved=1');
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to load restaurants');
        }
        const list = (Array.isArray(data.restaurants) ? data.restaurants : []) as MapRestaurant[];
        if (!cancelled) {
          setRestaurants(
            list.filter((r) => {
              const lat = Number(r.location?.lat);
              const lng = Number(r.location?.lng);
              return Number.isFinite(lat) && Number.isFinite(lng);
            })
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load restaurants');
          setRestaurants([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Service Zones &amp; Geofencing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approved restaurants plotted by GPS — logo markers show shop distribution across Yangon.
          </p>
        </div>
        <p className="text-xs font-semibold text-muted-foreground">
          {loading ? 'Loading shops…' : `${restaurants.length} approved shops on map`}
        </p>
      </div>

      <div className="relative mt-4 h-[500px] w-full overflow-hidden rounded-2xl border border-border">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-admin" />
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-x-0 top-3 z-10 mx-auto w-max rounded-lg border border-danger/30 bg-card px-3 py-2 text-xs font-semibold text-danger shadow">
            {error}
          </div>
        )}
        <MapContainer
          center={YANGON_CENTER}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {TOWNSHIP_ZONES.map((zone) => (
            <Circle
              key={zone.name}
              center={[zone.lat, zone.lng]}
              radius={zone.radius}
              pathOptions={{
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: 0.06,
                weight: 1,
                opacity: 0.35,
              }}
            >
              <Popup>{zone.name}</Popup>
            </Circle>
          ))}
          <RestaurantMarkers restaurants={restaurants} />
        </MapContainer>
      </div>
    </div>
  );
}
