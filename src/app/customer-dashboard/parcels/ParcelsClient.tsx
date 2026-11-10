'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Phone,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { formatMMK } from '@/lib/currency';

const OsmMapPicker = dynamic(() => import('../components/OsmMapPicker'), {
  ssr: false,
  loading: () => <div className="h-[250px] animate-pulse rounded-xl bg-muted" />,
});
const LiveTrackerMap = dynamic(() => import('../components/LiveTrackerMap'), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-muted" />,
});

type Place = { address: string; detail: string; lat: number | null; lng: number | null };
type Size = 'SMALL' | 'MEDIUM' | 'LARGE';
type Quote = {
  roadKm: number;
  baseFee: number;
  distanceFee: number;
  sizeFee: number;
  total: number;
  etaMins: number;
};
type ParcelView = {
  _id: string;
  code: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED';
  senderName?: string;
  senderPhone?: string;
  recipientName: string;
  recipientPhone: string;
  pickup: Place & { lat: number; lng: number };
  dropoff: Place & { lat: number; lng: number };
  size: Size;
  description?: string;
  payer: 'SENDER' | 'RECIPIENT';
  price: { total: number; roadKm: number };
  etaMins?: number;
  deliveryPin?: string;
  riderName?: string;
  riderPhone?: string;
  riderCoords?: { lat?: number; lng?: number };
  createdAt: string;
};

const YANGON = { lat: 16.8409, lng: 96.1735 };
const EMPTY: Place = { address: '', detail: '', lat: null, lng: null };
const SIZES: Array<{ key: Size; label: string; hint: string; fee: number }> = [
  { key: 'SMALL', label: 'Small', hint: 'Documents, phone, keys · ≤3 kg', fee: 0 },
  { key: 'MEDIUM', label: 'Medium', hint: 'Shoebox, food box · ≤8 kg', fee: 700 },
  { key: 'LARGE', label: 'Large', hint: 'Bag or box for a motorbike · ≤20 kg', fee: 1500 },
];
const STATUS_TEXT: Record<ParcelView['status'], string> = {
  REQUESTED: 'Finding a rider',
  ACCEPTED: 'Rider on the way to pickup',
  PICKED_UP: 'On the way to recipient',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};
const STEPS: ParcelView['status'][] = ['REQUESTED', 'ACCEPTED', 'PICKED_UP', 'DELIVERED'];

type Suggestion = { display_name: string; lat: string; lon: string };

async function searchPlaces(q: string): Promise<Suggestion[]> {
  // OpenStreetMap Nominatim, limited to the Yangon area.
  const params = new URLSearchParams({
    format: 'jsonv2',
    q,
    countrycodes: 'mm',
    viewbox: '95.95,17.15,96.40,16.65',
    bounded: '1',
    limit: '5',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as Suggestion[];
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.display_name) ? false : (seen.add(r.display_name), true)));
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    return ((await res.json()).display_name as string) || null;
  } catch {
    return null;
  }
}

function PlaceField({
  label,
  icon,
  value,
  onChange,
  saved,
}: {
  label: string;
  icon: React.ReactNode;
  value: Place;
  onChange: (p: Place) => void;
  saved: Array<{ label: string; address: string; lat?: number; lng?: number }>;
}) {
  const [query, setQuery] = useState(value.address);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const typed = useRef(false);

  useEffect(() => {
    setQuery(value.address);
  }, [value.address]);

  useEffect(() => {
    if (!typed.current || query.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(query.trim()));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [query]);

  const pick = (lat: number, lng: number, address: string) => {
    typed.current = false;
    setResults([]);
    onChange({ ...value, address, lat, lng });
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            typed.current = true;
            setQuery(e.target.value);
            onChange({ ...value, address: e.target.value, lat: null, lng: null });
          }}
          placeholder="Type an address, street or place"
          className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-9 text-sm text-foreground outline-none focus:border-customer"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        {results.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <button
                  type="button"
                  onClick={() => pick(Number(r.lat), Number(r.lon), r.display_name)}
                  className="block w-full px-3 py-2 text-left text-xs text-foreground hover:bg-muted"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {saved
          .filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
          .slice(0, 3)
          .map((s) => (
            <button
              key={`${s.label}-${s.address}`}
              type="button"
              onClick={() => pick(Number(s.lat), Number(s.lng), s.address)}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
            >
              {s.label || 'Saved'}
            </button>
          ))}
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
        >
          <MapPin className="h-3 w-3" />
          {showMap ? 'Hide map' : 'Pin on map'}
        </button>
        {value.lat != null && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> Location set
          </span>
        )}
      </div>
      {showMap && (
        <div className="h-[250px] overflow-hidden rounded-xl border border-border">
          <OsmMapPicker
            center={value.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : YANGON}
            pin={value.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : YANGON}
            onPick={async (lat, lng) => {
              onChange({ ...value, lat, lng, address: value.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
              const name = await reverseGeocode(lat, lng);
              if (name) onChange({ ...value, lat, lng, address: name });
            }}
          />
        </div>
      )}
      <input
        value={value.detail}
        onChange={(e) => onChange({ ...value, detail: e.target.value })}
        placeholder="Building, floor, room or landmark (optional)"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-customer"
      />
    </div>
  );
}

function ParcelCard({
  parcel,
  incoming,
  onCancel,
}: {
  parcel: ParcelView;
  incoming: boolean;
  onCancel: (id: string) => void;
}) {
  const active = parcel.status === 'ACCEPTED' || parcel.status === 'PICKED_UP';
  const stepIndex = STEPS.indexOf(parcel.status);
  const rider =
    parcel.riderCoords && Number.isFinite(Number(parcel.riderCoords.lat))
      ? { lat: Number(parcel.riderCoords.lat), lng: Number(parcel.riderCoords.lng) }
      : null;
  return (
    <article className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-muted-foreground">{parcel.code}</p>
          <p className="text-sm font-bold text-foreground">{STATUS_TEXT[parcel.status]}</p>
          <p className="text-xs text-muted-foreground">
            {incoming ? `From ${parcel.senderName || 'a FoodDash user'}` : `To ${parcel.recipientName}`} ·{' '}
            {parcel.price.roadKm} km · {formatMMK(parcel.price.total)}{' '}
            ({parcel.payer === 'SENDER' ? 'sender pays' : 'recipient pays'})
          </p>
        </div>
        {parcel.deliveryPin && parcel.status !== 'DELIVERED' && parcel.status !== 'CANCELLED' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-3 w-3" /> Delivery PIN
            </p>
            <p className="text-lg font-bold tracking-[0.3em] text-emerald-800 font-tabular dark:text-emerald-300">
              {parcel.deliveryPin}
            </p>
          </div>
        )}
      </div>

      {parcel.status !== 'CANCELLED' && (
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-customer' : 'bg-muted'}`} />
          ))}
        </div>
      )}

      <div className="grid gap-1 text-xs">
        <p className="text-foreground">
          <span className="font-semibold">Pickup:</span> {parcel.pickup.address}
        </p>
        <p className="text-foreground">
          <span className="font-semibold">Drop-off:</span> {parcel.dropoff.address}
        </p>
      </div>

      {active && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs text-foreground">
            <span className="inline-flex items-center gap-1">
              <Bike className="h-3.5 w-3.5 text-customer" /> {parcel.riderName || 'Rider'}
            </span>
            {parcel.riderPhone && (
              <a href={`tel:${parcel.riderPhone}`} className="inline-flex items-center gap-1 font-semibold text-customer">
                <Phone className="h-3.5 w-3.5" /> Call rider
              </a>
            )}
            {parcel.etaMins != null && <span>About {parcel.etaMins} min</span>}
          </div>
          <div className="h-[260px] overflow-hidden rounded-xl border border-border">
            <LiveTrackerMap
              restaurantLocation={{ lat: parcel.pickup.lat, lng: parcel.pickup.lng }}
              customerLocation={{ lat: parcel.dropoff.lat, lng: parcel.dropoff.lng }}
              riderLocation={rider}
              showRider={Boolean(rider)}
              restaurantName="Pickup"
              etaMinutes={parcel.etaMins ?? null}
              status={parcel.status === 'PICKED_UP' ? 'OUT_FOR_DELIVERY' : 'PREPARING'}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Give the rider the delivery PIN only when the parcel is in the recipient&apos;s hands.
          </p>
        </>
      )}

      {!incoming && (parcel.status === 'REQUESTED' || parcel.status === 'ACCEPTED') && (
        <button
          type="button"
          onClick={() => onCancel(parcel._id)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-danger"
        >
          <X className="h-3.5 w-3.5" /> Cancel request
        </button>
      )}
    </article>
  );
}

export default function ParcelsClient() {
  const router = useRouter();
  const [pickup, setPickup] = useState<Place>(EMPTY);
  const [dropoff, setDropoff] = useState<Place>(EMPTY);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [size, setSize] = useState<Size>('SMALL');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [payer, setPayer] = useState<'SENDER' | 'RECIPIENT'>('SENDER');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<Array<{ label: string; address: string; lat?: number; lng?: number }>>([]);
  const [sent, setSent] = useState<ParcelView[]>([]);
  const [incoming, setIncoming] = useState<ParcelView[]>([]);
  const [tab, setTab] = useState<'sent' | 'incoming'>('sent');

  const loadParcels = useCallback(async () => {
    try {
      const res = await fetch('/api/parcels');
      const data = await res.json();
      if (res.ok && data.success) {
        setSent(data.sent || []);
        setIncoming(data.incoming || []);
      }
    } catch {
      /* keep last list */
    }
  }, []);

  useEffect(() => {
    void loadParcels();
    const t = setInterval(loadParcels, 10_000);
    return () => clearInterval(t);
  }, [loadParcels]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/customer/profile');
        const data = await res.json();
        const list = Array.isArray(data?.profile?.savedAddresses) ? data.profile.savedAddresses : [];
        setSaved(list);
        const first = list.find((a: { lat?: number }) => Number.isFinite(Number(a.lat)));
        if (first) setPickup({ address: first.address, detail: first.detail || '', lat: Number(first.lat), lng: Number(first.lng) });
      } catch {
        /* optional */
      }
    })();
  }, []);

  const ready = pickup.lat != null && dropoff.lat != null;

  useEffect(() => {
    if (!ready) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/parcels/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup, dropoff, size }),
      });
      const data = await res.json();
      if (cancelled) return;
      setQuote(data.quote || null);
      setQuoteError(data.success ? null : data.message);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, pickup, dropoff, size]);

  const submit = async () => {
    if (!ready || !quote || quoteError) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/parcels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup, dropoff, recipientName, recipientPhone, size, description, notes, payer }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not request a rider');
      toast.success(`Parcel ${data.parcel.code} requested — finding a rider`);
      setDropoff(EMPTY);
      setRecipientName('');
      setRecipientPhone('');
      setDescription('');
      setNotes('');
      setTab('sent');
      await loadParcels();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not request a rider');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id: string) => {
    if (!window.confirm('Cancel this parcel request?')) return;
    const res = await fetch(`/api/parcels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) toast.error(data.message || 'Could not cancel');
    else toast.success('Parcel cancelled');
    await loadParcels();
  };

  const list = tab === 'sent' ? sent : incoming;
  const activeCount = useMemo(
    () => sent.filter((p) => p.status !== 'DELIVERED' && p.status !== 'CANCELLED').length,
    [sent]
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => router.push('/customer-dashboard')}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Discover
          </button>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Package className="h-4 w-4 text-customer" /> FoodDash Express
            </p>
            <p className="text-[11px] text-muted-foreground">Send anything across Yangon — a rider picks it up from your door</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_380px]">
        <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h1 className="text-lg font-bold text-foreground">Send a parcel</h1>
          <PlaceField
            label="Pickup"
            icon={<Navigation className="h-3.5 w-3.5 text-customer" />}
            value={pickup}
            onChange={setPickup}
            saved={saved}
          />
          <PlaceField
            label="Drop-off"
            icon={<MapPin className="h-3.5 w-3.5 text-danger" />}
            value={dropoff}
            onChange={setDropoff}
            saved={saved}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Recipient name"
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-customer"
            />
            <input
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="Recipient phone (09…)"
              inputMode="tel"
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-customer"
            />
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">
            If the recipient uses FoodDash with this phone number, they can track the parcel in their app too.
          </p>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Size</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {SIZES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSize(s.key)}
                  aria-pressed={size === s.key}
                  className={`rounded-xl border p-3 text-left ${
                    size === s.key ? 'border-customer bg-customer/10' : 'border-border hover:bg-muted'
                  }`}
                >
                  <p className="text-sm font-bold text-foreground">{s.label}</p>
                  <p className="text-[11px] text-muted-foreground">{s.hint}</p>
                  <p className="mt-1 text-[11px] font-semibold text-foreground">{s.fee ? `+${formatMMK(s.fee)}` : 'No extra'}</p>
                </button>
              ))}
            </div>
          </div>

          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What are you sending? (e.g. documents, clothes)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-customer"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Note for the rider (optional)"
            rows={2}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-customer"
          />

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Who pays the rider (cash)?</p>
            <div className="inline-flex rounded-full border border-border bg-muted/40 p-0.5">
              {(['SENDER', 'RECIPIENT'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPayer(p)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${payer === p ? 'bg-customer text-white' : 'text-muted-foreground'}`}
                >
                  {p === 'SENDER' ? 'I pay at pickup' : 'Recipient pays at drop-off'}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-4">
            {!ready ? (
              <p className="text-sm text-muted-foreground">Choose pickup and drop-off to see the price.</p>
            ) : quoteError ? (
              <p className="text-sm text-danger">{quoteError}</p>
            ) : quote ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Base fare</span>
                  <span className="font-tabular">{formatMMK(quote.baseFee)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Distance ({quote.roadKm} km by road)</span>
                  <span className="font-tabular">{formatMMK(quote.distanceFee)}</span>
                </div>
                {quote.sizeFee > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Size</span>
                    <span className="font-tabular">{formatMMK(quote.sizeFee)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1 font-bold text-foreground">
                  <span>Total</span>
                  <span className="font-tabular">{formatMMK(quote.total)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">About {quote.etaMins} min ride once picked up.</p>
              </div>
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!ready || !quote || Boolean(quoteError) || submitting || !recipientName || recipientPhone.length < 7}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-customer py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bike className="h-4 w-4" />}
            Request a rider{quote && !quoteError ? ` · ${formatMMK(quote.total)}` : ''}
          </button>
        </section>

        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">My parcels</h2>
            {activeCount > 0 && <span className="text-[11px] text-muted-foreground">{activeCount} in progress</span>}
          </div>
          <div className="inline-flex rounded-full border border-border bg-muted/40 p-0.5">
            {(['sent', 'incoming'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${tab === t ? 'bg-customer text-white' : 'text-muted-foreground'}`}
              >
                {t === 'sent' ? `Sent (${sent.length})` : `To me (${incoming.length})`}
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              {tab === 'sent' ? 'No parcels sent yet.' : 'No parcels sent to your phone number yet.'}
            </p>
          ) : (
            list.map((p) => <ParcelCard key={p._id} parcel={p} incoming={tab === 'incoming'} onCancel={cancel} />)
          )}
        </aside>
      </main>
    </div>
  );
}
