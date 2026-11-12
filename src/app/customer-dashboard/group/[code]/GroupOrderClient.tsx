'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Crown, Lock, Minus, Plus, Users } from 'lucide-react';
import { formatKyat } from '@/lib/currency';
import { calculateOrderPricing, DEFAULT_DELIVERY_FEE_KS } from '@/lib/orderPricing';

type GroupItem = { menuItemId: string; name: string; unitPrice: number; quantity: number };
type Member = { customerId: string; name: string; items: GroupItem[] };
type Group = {
  code: string;
  hostId: string;
  hostName: string;
  restaurantId: string;
  restaurantName: string;
  status: 'OPEN' | 'LOCKED' | 'PLACED' | 'CANCELLED';
  members: Member[];
  orderId?: string;
  expiresAt: string;
};
type Dish = { _id: string; name: string; price: number; discountPrice?: number; category: string; isAvailable?: boolean; stockQuantity?: number };
type Address = { label: string; address: string; detail?: string; lat?: number; lng?: number; township?: string };
type Share = { customerId: string; name: string; food: number; amount: number };

const POLL_MS = 4000;
const memberFood = (m: Member) => m.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

/** Shared cart: everyone adds their own dishes, the host checks out once, the bill is split. */
export default function GroupOrderClient({ code }: { code: string }) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [me, setMe] = useState('');
  const [error, setError] = useState('');
  const [menu, setMenu] = useState<Dish[]>([]);
  const [busy, setBusy] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressIdx, setAddressIdx] = useState(0);
  const [tip, setTip] = useState(0);
  const [shares, setShares] = useState<Share[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/group-orders/${code}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setError(data.message || 'Group order not found');
      return;
    }
    setGroup(data.group as Group);
    setMe(String(data.me));
  }, [code]);

  useEffect(() => {
    void load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const restaurantId = group?.restaurantId;
  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/menu?restaurantId=${encodeURIComponent(restaurantId)}`)
      .then((r) => r.json())
      .then((d) => setMenu(((d.items || []) as Dish[]).filter((i) => i.isAvailable !== false)))
      .catch(() => {});
  }, [restaurantId]);

  const isHost = group?.hostId === me;
  const mine = group?.members.find((m) => m.customerId === me);
  const isMember = Boolean(mine);

  useEffect(() => {
    if (!isHost || !me) return;
    fetch(`/api/customer/profile?customerId=${encodeURIComponent(me)}`)
      .then((r) => r.json())
      .then((d) => {
        const list = (d?.profile?.savedAddresses || []) as Address[];
        setAddresses(list.filter((a) => a.address));
      })
      .catch(() => {});
  }, [isHost, me]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/group-orders/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Something went wrong');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const qtyOf = (menuItemId: string) => mine?.items.find((i) => i.menuItemId === menuItemId)?.quantity || 0;

  const subtotal = useMemo(() => (group ? group.members.reduce((s, m) => s + memberFood(m), 0) : 0), [group]);
  const pricing = calculateOrderPricing({ subtotal, deliveryFee: subtotal > 0 ? DEFAULT_DELIVERY_FEE_KS : 0, tipAmount: tip });
  const shareLink = typeof window !== 'undefined' ? `${window.location.origin}/customer-dashboard/group/${code}` : '';

  const place = async () => {
    const address = addresses[addressIdx];
    if (!address) {
      toast.error('Add a delivery address in your profile first');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/group-orders/${code}/place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryAddress: address, tipAmount: tip }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not place the order');
      setShares(data.shares as Share[]);
      toast.success(`Order ${data.orderNumber} placed for the group`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not place the order');
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <p className="text-lg font-bold text-foreground">{error}</p>
        <Link href="/customer-dashboard" className="mt-4 inline-block text-sm font-semibold text-customer underline">
          Back to FoodDash
        </Link>
      </div>
    );
  }
  if (!group) return <div className="mx-auto mt-10 h-40 max-w-3xl animate-pulse rounded-2xl bg-muted" />;

  const categories = Array.from(new Set(menu.map((d) => d.category)));
  const editable = group.status === 'OPEN' && isMember;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <Link href="/customer-dashboard" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> FoodDash
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 p-5 text-white">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
            <Users className="h-4 w-4" /> Group order · {group.status}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{group.restaurantName}</h1>
          <p className="text-sm opacity-90">
            Hosted by {group.hostName} · {group.members.length} people · code <b className="font-mono">{group.code}</b>
          </p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(shareLink);
              toast.success('Link copied. Send it to your friends.');
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/30"
          >
            <Copy className="h-3.5 w-3.5" /> Copy invite link
          </button>
        </div>
        {shareLink && (
          <div className="rounded-xl bg-white p-2">
            <QRCodeSVG value={shareLink} size={96} />
          </div>
        )}
      </div>

      {!isMember && group.status === 'OPEN' && (
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-violet-300 bg-violet-50 p-4 dark:bg-violet-950/30">
          <p className="text-sm text-foreground">You were invited to this group order. Join to add your food.</p>
          <button type="button" disabled={busy} onClick={() => act({ action: 'join' })} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white">
            Join
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {group.status !== 'OPEN' && group.status !== 'PLACED' && (
            <p className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" /> {group.status === 'LOCKED' ? 'The host locked the cart to check out.' : 'This group order was cancelled.'}
            </p>
          )}
          {categories.map((cat) => (
            <div key={cat}>
              <h2 className="mb-2 text-base font-bold text-foreground">{cat}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {menu
                  .filter((d) => d.category === cat)
                  .map((d) => {
                    const q = qtyOf(d._id);
                    const price = Number(d.discountPrice) > 0 ? Math.min(d.price, Number(d.discountPrice)) : d.price;
                    return (
                      <div key={d._id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{d.name}</p>
                          <p className="text-xs text-muted-foreground">{formatKyat(price)}</p>
                        </div>
                        {editable && (
                          <div className="flex items-center gap-1.5">
                            {q > 0 && (
                              <>
                                <button type="button" disabled={busy} onClick={() => act({ action: 'set', menuItemId: d._id, quantity: q - 1 })} className="flex h-7 w-7 items-center justify-center rounded-full border border-border" aria-label={`Remove one ${d.name}`}>
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-5 text-center text-sm font-bold">{q}</span>
                              </>
                            )}
                            <button type="button" disabled={busy} onClick={() => act({ action: 'set', menuItemId: d._id, quantity: q + 1 })} className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white" aria-label={`Add ${d.name}`}>
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-bold text-foreground">Who&apos;s ordering what</p>
            <ul className="space-y-3">
              {group.members.map((m) => (
                <li key={m.customerId} className="text-sm">
                  <p className="flex items-center justify-between font-semibold text-foreground">
                    <span className="flex items-center gap-1">
                      {m.customerId === group.hostId && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                      {m.name}
                      {m.customerId === me ? ' (you)' : ''}
                    </span>
                    <span className="font-tabular">{formatKyat(memberFood(m))}</span>
                  </p>
                  {m.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Still choosing…</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{m.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Food</span><span>{formatKyat(pricing.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery (est.)</span><span>{formatKyat(subtotal > 0 ? pricing.deliveryFee : 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax 8%</span><span>{formatKyat(pricing.tax)}</span></div>
              {tip > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tip</span><span>{formatKyat(tip)}</span></div>}
              <div className="flex justify-between text-sm font-bold"><span>Total</span><span className="text-violet-600">{formatKyat(subtotal > 0 ? pricing.total : 0)}</span></div>
              <p className="pt-1 text-[11px] text-muted-foreground">Each person pays their own food plus an equal share of delivery, tax and tip.</p>
            </div>
          </div>

          {(shares || group.status === 'PLACED') && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 dark:bg-emerald-950/30">
              <p className="mb-2 text-sm font-bold text-emerald-800 dark:text-emerald-200">Order placed. Pay the host:</p>
              {shares ? (
                <ul className="space-y-1 text-sm">
                  {shares.map((s) => (
                    <li key={s.customerId} className="flex justify-between">
                      <span>{s.name}</span>
                      <b>{formatKyat(s.amount)}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">The host can see each share in the order details.</p>
              )}
              {isHost && (
                <button type="button" onClick={() => router.push('/customer-dashboard')} className="mt-3 w-full rounded-xl bg-emerald-600 py-2 text-sm font-bold text-white">
                  Track the order
                </button>
              )}
            </div>
          )}

          {isHost && (group.status === 'OPEN' || group.status === 'LOCKED') && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-bold text-foreground">Host checkout</p>
              {addresses.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Save a delivery address in <Link href="/customer-dashboard" className="underline">your profile</Link> first.
                </p>
              ) : (
                <select className="input-field w-full py-2 text-sm" value={addressIdx} onChange={(e) => setAddressIdx(Number(e.target.value))}>
                  {addresses.map((a, i) => (
                    <option key={`${a.label}-${i}`} value={i}>
                      {a.label} · {a.address}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                {[0, 500, 1000, 2000].map((t) => (
                  <button key={t} type="button" onClick={() => setTip(t)} className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${tip === t ? 'border-violet-600 text-violet-600' : 'border-border text-muted-foreground'}`}>
                    {t === 0 ? 'No tip' : formatKyat(t)}
                  </button>
                ))}
              </div>
              <button type="button" disabled={busy || subtotal === 0} onClick={place} className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                Place group order · cash on delivery
              </button>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => act({ action: group.status === 'OPEN' ? 'lock' : 'unlock' })} className="flex-1 rounded-lg border border-border py-1.5 text-xs font-semibold">
                  {group.status === 'OPEN' ? 'Lock cart' : 'Unlock cart'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Cancel this group order for everyone?')) void act({ action: 'cancel' });
                  }}
                  className="flex-1 rounded-lg border border-danger/40 py-1.5 text-xs font-semibold text-danger"
                >
                  Cancel group
                </button>
              </div>
            </div>
          )}
          {isMember && !isHost && group.status === 'OPEN' && (
            <button type="button" disabled={busy} onClick={() => act({ action: 'leave' })} className="w-full rounded-xl border border-border py-2 text-xs font-semibold text-muted-foreground">
              Leave group
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
