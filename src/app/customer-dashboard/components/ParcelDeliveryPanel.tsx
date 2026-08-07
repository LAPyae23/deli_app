'use client';

import React, { useMemo, useState } from 'react';
import {
  Package, PackageOpen, MapPin, Clock, CheckCircle, Bike,
  Navigation,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CustomerParcel, ParcelSize, ParcelStatus } from '../types';

const TOWNSHIPS = [
  'South Dagon',
  'North Okkalapa',
  'Yankin',
  'Hlaing',
  'Bahan',
  'Tamwe',
  'Thingangyun',
] as const;

const SIZE_OPTIONS: ParcelSize[] = ['Envelope', 'Small', 'Medium'];

const SIZE_FEES: Record<ParcelSize, number> = {
  Envelope: 2.5,
  Small: 4.0,
  Medium: 6.5,
};

const INITIAL_PARCELS: CustomerParcel[] = [
  {
    id: 'parcel-001',
    ref: '#C2C-2201',
    pickupLocation: 'South Dagon',
    pickupAddress: 'No. 18, Yadanar St, South Dagon',
    dropoffLocation: 'North Okkalapa',
    dropoffAddress: 'Bldg C-12, Thudhamma Rd, North Okkalapa',
    recipientName: 'Ma Thida Oo',
    status: 'IN_TRANSIT',
    timeWindow: '11:20 – 11:50',
    fee: 4.0,
    size: 'Small',
    notes: 'Small box · fragile',
  },
  {
    id: 'parcel-002',
    ref: '#C2C-2208',
    pickupLocation: 'Yankin',
    pickupAddress: '88 Kabar Aye Pagoda Rd, Yankin',
    dropoffLocation: 'Hlaing',
    dropoffAddress: '3/A Parami Road, Hlaing Township',
    recipientName: 'Daw Khin Mar',
    status: 'SCHEDULED',
    timeWindow: '13:30 – 14:00',
    fee: 2.5,
    size: 'Envelope',
    notes: 'Envelope · documents',
  },
  {
    id: 'parcel-003',
    ref: '#C2C-2188',
    pickupLocation: 'Bahan',
    pickupAddress: '42 Inya Road, Bahan Township',
    dropoffLocation: 'Tamwe',
    dropoffAddress: '15 Myaynigone Rd, Tamwe',
    recipientName: 'Ko Aung Kyaw',
    status: 'DELIVERED',
    timeWindow: 'Yesterday · 16:40',
    fee: 4.0,
    size: 'Small',
  },
];

const STATUS_META: Record<ParcelStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  SCHEDULED: { label: 'Scheduled', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  PICKED_UP: { label: 'Picked Up', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  IN_TRANSIT: { label: 'In Transit', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  DELIVERED: { label: 'Delivered', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function estimateFee(size: ParcelSize, pickup: string, dropoff: string) {
  const base = SIZE_FEES[size];
  const crossTownship = pickup && dropoff && pickup !== dropoff ? 1.5 : 0;
  return base + crossTownship;
}

export default function ParcelDeliveryPanel() {
  const [parcels, setParcels] = useState<CustomerParcel[]>(INITIAL_PARCELS);
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [size, setSize] = useState<ParcelSize>('Small');
  const [notes, setNotes] = useState('');

  const fee = useMemo(
    () => estimateFee(size, pickupLocation, dropoffLocation),
    [size, pickupLocation, dropoffLocation]
  );

  const activeParcel = parcels.find((p) => p.status === 'IN_TRANSIT');

  const resetForm = () => {
    setPickupLocation('');
    setPickupAddress('');
    setDropoffLocation('');
    setDropoffAddress('');
    setRecipientName('');
    setSize('Small');
    setNotes('');
  };

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupLocation || !pickupAddress || !dropoffLocation || !dropoffAddress || !recipientName.trim()) {
      toast.error('Please fill in pickup, drop-off, and recipient details');
      return;
    }
    if (pickupLocation === dropoffLocation && pickupAddress.trim() === dropoffAddress.trim()) {
      toast.error('Pickup and drop-off must be different');
      return;
    }

    const refNum = 2210 + parcels.length;
    const ref = `#C2C-${refNum}`;
    const next: CustomerParcel = {
      id: `parcel-${Date.now()}`,
      ref,
      pickupLocation,
      pickupAddress: pickupAddress.trim(),
      dropoffLocation,
      dropoffAddress: dropoffAddress.trim(),
      recipientName: recipientName.trim(),
      status: 'SCHEDULED',
      timeWindow: 'Today · TBD',
      fee,
      size,
      notes: notes.trim() || undefined,
    };

    setParcels((prev) => [next, ...prev]);
    resetForm();
    toast.success(`Parcel booked ${ref} — added to today’s optimized route`);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Send &amp; track parcels</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          C2C delivery across Yangon townships — auto-routed with food stops for faster handoffs.
        </p>
      </div>

      {activeParcel && (
        <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm animate-fade-in sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <Bike className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-500">
                Active parcel · {activeParcel.ref}
              </p>
              <p className="mt-0.5 text-sm font-bold text-foreground">
                Rider en route · {activeParcel.dropoffLocation}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {activeParcel.pickupLocation} → {activeParcel.dropoffLocation} · {activeParcel.recipientName}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-indigo-600 font-tabular">
            <Clock className="h-3.5 w-3.5" />
            {activeParcel.timeWindow}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Send form */}
        <form
          onSubmit={handleBook}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-customer/10 text-customer">
              <PackageOpen className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">Send a Parcel</p>
              <p className="text-[11px] text-muted-foreground">Pickup &amp; drop-off by township</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-600">
                Pickup
              </label>
              <select
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                className="input-field"
              >
                <option value="">Select township</option>
                {TOWNSHIPS.map((t) => (
                  <option key={`pick-${t}`} value={t}>{t}</option>
                ))}
              </select>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="Street address / landmark"
                className="input-field"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600">
                Drop-off
              </label>
              <select
                value={dropoffLocation}
                onChange={(e) => setDropoffLocation(e.target.value)}
                className="input-field"
              >
                <option value="">Select township</option>
                {TOWNSHIPS.map((t) => (
                  <option key={`drop-${t}`} value={t}>{t}</option>
                ))}
              </select>
              <input
                type="text"
                value={dropoffAddress}
                onChange={(e) => setDropoffAddress(e.target.value)}
                placeholder="Recipient street address"
                className="input-field"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Recipient
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Full name"
                className="input-field"
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Size
              </label>
              <div className="flex flex-wrap gap-2">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSize(opt)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                      size === opt
                        ? 'border-customer bg-orange-50 text-customer'
                        : 'border-border bg-card text-muted-foreground hover:border-customer/40'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Notes <span className="font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Fragile, leave with guard…"
                className="input-field"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Estimated fee</p>
                <p className="text-lg font-bold text-foreground font-tabular">${fee.toFixed(2)}</p>
              </div>
              <button type="submit" className="btn-primary px-5 py-2.5">
                <Package className="h-4 w-4" />
                Book Parcel
              </button>
            </div>
          </div>
        </form>

        {/* My parcels list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <p className="section-label">My Parcels</p>
            <span className="text-[11px] font-medium text-muted-foreground font-tabular">
              {parcels.length} total
            </span>
          </div>

          <div className="space-y-3">
            {parcels.map((parcel) => {
              const status = STATUS_META[parcel.status];
              const isDone = parcel.status === 'DELIVERED';
              const isActive = parcel.status === 'IN_TRANSIT';

              return (
                <article
                  key={parcel.id}
                  className={`rounded-2xl border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md ${
                    isActive
                      ? 'border-indigo-200'
                      : isDone
                        ? 'border-border opacity-90'
                        : 'border-border hover:border-slate-300'
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-foreground font-tabular">{parcel.ref}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        To {parcel.recipientName} · {parcel.size}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
                      {isActive && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 status-pulse" />}
                      {isDone && <CheckCircle className="mr-1 h-3 w-3" />}
                      {status.label}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex shrink-0 flex-col items-center pt-0.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-teal-500 ring-4 ring-teal-100" />
                      <span className="my-1 w-px flex-1 min-h-[28px] bg-gradient-to-b from-teal-300 to-indigo-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-100" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-600">Pickup</p>
                        <p className="text-sm font-semibold text-foreground">{parcel.pickupLocation}</p>
                        <p className="truncate text-xs text-muted-foreground">{parcel.pickupAddress}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-600">Drop-off</p>
                        <p className="text-sm font-semibold text-foreground">{parcel.dropoffLocation}</p>
                        <p className="truncate text-xs text-muted-foreground">{parcel.dropoffAddress}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-tabular">
                      <Clock className="h-3 w-3" />
                      {parcel.timeWindow}
                    </span>
                    <span className="font-bold text-foreground font-tabular">${parcel.fee.toFixed(2)}</span>
                  </div>

                  {parcel.notes && (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      {parcel.notes}
                    </p>
                  )}

                  {isActive && (
                    <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                      <Navigation className="h-3.5 w-3.5" />
                      On rider route · heading to {parcel.dropoffLocation}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
