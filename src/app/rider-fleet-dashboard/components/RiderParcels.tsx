'use client';

import { useT } from '@/lib/i18n';
import PushOptIn from '@/components/PushOptIn';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, MapPin, Navigation, Package, Phone } from 'lucide-react';

type Place = { address: string; detail?: string; lat: number; lng: number };
type RiderParcel = {
  _id: string;
  code: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED';
  pickup: Place;
  dropoff: Place;
  size: 'SMALL' | 'MEDIUM' | 'LARGE';
  description?: string;
  notes?: string;
  payer: 'SENDER' | 'RECIPIENT';
  senderName?: string;
  senderPhone?: string;
  recipientName?: string;
  recipientPhone?: string;
  price: { total: number; roadKm: number; riderEarning: number };
  pickupDistanceKm?: number | null;
  etaMins?: number;
  deliveredAt?: string;
};

const ks = (n: number) => `${Math.round(n).toLocaleString()} Ks`;
const directions = (p: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;

function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 8_000 }
    )
  );
}

/**
 * Rider side of FoodDash Express: nearby parcel requests (nearest riders
 * first), accept, pick up, deliver with the recipient's PIN.
 */
export default function RiderParcels({ online }: { online: boolean }) {
  const [pool, setPool] = useState<RiderParcel[]>([]);
  const [mine, setMine] = useState<RiderParcel[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [pins, setPins] = useState<Record<string, string>>({});
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);
  const { t } = useT();

  const load = useCallback(async () => {
    const pos = await currentPosition();
    if (pos) lastPos.current = pos;
    const q = new URLSearchParams({ pool: '1' });
    if (lastPos.current) {
      q.set('lat', String(lastPos.current.lat));
      q.set('lng', String(lastPos.current.lng));
    }
    try {
      const [poolRes, mineRes] = await Promise.all([
        online ? fetch(`/api/parcels?${q}`).then((r) => r.json()) : Promise.resolve({ parcels: [] }),
        fetch('/api/parcels').then((r) => r.json()),
      ]);
      setPool(poolRes.parcels || []);
      setMine(mineRes.parcels || []);
    } catch {
      /* keep last state */
    }
  }, [online]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  const active = mine.filter((p) => p.status === 'ACCEPTED' || p.status === 'PICKED_UP');

  // Share live GPS with customers while a parcel is active.
  useEffect(() => {
    if (!active.length) return;
    const send = async () => {
      const pos = (await currentPosition()) || lastPos.current;
      if (!pos) return;
      await Promise.all(
        active.map((p) =>
          fetch(`/api/parcels/${p._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'location', ...pos }),
          }).catch(() => null)
        )
      );
    };
    void send();
    const t = setInterval(send, 15_000);
    return () => clearInterval(t);
  }, [active.map((p) => p._id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    setBusy(id + action);
    try {
      const res = await fetch(`/api/parcels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Action failed');
      toast.success(
        action === 'accept' ? 'Parcel accepted — head to pickup' : action === 'pickup' ? 'Picked up' : 'Delivered!'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setBusy(null);
      void load();
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-bold text-slate-900">{t('rp.title')}</h2>
        <span className="text-xs text-slate-500">{t('rp.sub')}</span>
      </div>

      <PushOptIn message={t('push.rider')} />

      {active.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('rp.inProgress')}</h3>
          {active.map((p) => {
            const toPickup = p.status === 'ACCEPTED';
            const target = toPickup ? p.pickup : p.dropoff;
            return (
              <article key={p._id} className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500">{p.code}</p>
                    <p className="text-sm font-bold text-slate-900">
                      {toPickup ? t('rp.goPickup') : t('rp.deliver')}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-emerald-700">{ks(p.price.riderEarning)}</p>
                </div>
                <p className="text-xs text-slate-700">
                  <MapPin className="mr-1 inline h-3.5 w-3.5 text-rose-500" />
                  {target.address}
                  {target.detail ? ` · ${target.detail}` : ''}
                </p>
                <p className="text-xs text-slate-500">
                  {p.size.toLowerCase()} parcel{p.description ? ` · ${p.description}` : ''}
                  {p.notes ? ` · Note: ${p.notes}` : ''}
                </p>
                <p className="text-xs font-semibold text-slate-700">
                  {t(p.payer === 'SENDER' ? 'rp.collectSender' : 'rp.collectRecipient', { amount: ks(p.price.total) })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={directions(target)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    <Navigation className="h-3.5 w-3.5" /> {t('rp.navigate')}
                  </a>
                  {(toPickup ? p.senderPhone : p.recipientPhone) && (
                    <a
                      href={`tel:${toPickup ? p.senderPhone : p.recipientPhone}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      <Phone className="h-3.5 w-3.5" /> {t('rp.call', { name: toPickup ? p.senderName || 'sender' : p.recipientName || 'recipient' })}
                    </a>
                  )}
                </div>
                {toPickup ? (
                  <button
                    type="button"
                    disabled={busy === p._id + 'pickup'}
                    onClick={() => act(p._id, 'pickup')}
                    className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {t('rp.pickedUp')}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={pins[p._id] || ''}
                      onChange={(e) => setPins((m) => ({ ...m, [p._id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder={t('rp.pin')}
                      inputMode="numeric"
                      className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm tracking-[0.3em]"
                    />
                    <button
                      type="button"
                      disabled={(pins[p._id] || '').length !== 4 || busy === p._id + 'deliver'}
                      onClick={() => act(p._id, 'deliver', { pin: pins[p._id] })}
                      className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {t('rp.confirm')}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('rp.nearby')}</h3>
        {!online ? (
          <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
            {t('rp.goOnline')}
          </p>
        ) : pool.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
            {t('rp.none')}
          </p>
        ) : (
          pool.map((p) => (
            <article key={p._id} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-500">
                    {p.code} · {p.size.toLowerCase()}
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-900">{p.pickup.address}</p>
                  <p className="truncate text-xs text-slate-500">→ {p.dropoff.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-700">{ks(p.price.riderEarning)}</p>
                  <p className="text-[11px] text-slate-500">{t('rp.trip', { km: p.price.roadKm })}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  {p.pickupDistanceKm != null ? t('rp.toPickup', { km: p.pickupDistanceKm.toFixed(1) }) : '—'}
                </p>
                <button
                  type="button"
                  disabled={busy === p._id + 'accept'}
                  onClick={() => act(p._id, 'accept')}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {busy === p._id + 'accept' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {t('rp.accept')}
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {mine.some((p) => p.status === 'DELIVERED') && (
        <p className="text-[11px] text-slate-500">
          Delivered today: {mine.filter((p) => p.status === 'DELIVERED' && p.deliveredAt && new Date(p.deliveredAt).toDateString() === new Date().toDateString()).length}
        </p>
      )}
    </section>
  );
}
