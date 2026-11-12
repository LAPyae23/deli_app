'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, TicketPercent } from 'lucide-react';

type Promo = {
  code: string;
  description?: string;
  kind: 'PERCENT' | 'FLAT' | 'FREE_DELIVERY';
  value: number;
  maxDiscount?: number;
  minSubtotal?: number;
  firstOrderOnly?: boolean;
  perUserLimit?: number;
  totalLimit?: number;
  usedCount?: number;
  expiresAt?: string | null;
  active?: boolean;
  label?: string;
};

const EMPTY = {
  code: '',
  description: '',
  kind: 'PERCENT' as Promo['kind'],
  value: 10,
  maxDiscount: 0,
  minSubtotal: 0,
  firstOrderOnly: false,
  perUserLimit: 1,
  totalLimit: 0,
  expiresAt: '',
};

/** Admin screen to create, review and switch off platform-wide promo codes. */
export default function PromoManager() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/promos');
    const data = await res.json();
    if (data?.success) setPromos(data.promos);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not save');
      toast.success(`Saved ${data.promo.code}`);
      setForm(EMPTY);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const field = 'input-field w-full py-2 text-sm';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <TicketPercent className="h-5 w-5 text-admin" /> Promo codes
        </h2>
        <p className="text-sm text-muted-foreground">
          Codes any customer can type at checkout. The server checks limits and uses each code atomically.
        </p>
      </div>

      <form
        className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save({ ...form, expiresAt: form.expiresAt || null });
        }}
      >
        <label className="text-xs font-semibold text-muted-foreground">
          Code
          <input className={field} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="THINGYAN15" required />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Type
          <select className={field} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Promo['kind'] })}>
            <option value="PERCENT">% off food</option>
            <option value="FLAT">Fixed Ks off</option>
            <option value="FREE_DELIVERY">Free delivery</option>
          </select>
        </label>
        {form.kind !== 'FREE_DELIVERY' && (
          <label className="text-xs font-semibold text-muted-foreground">
            {form.kind === 'PERCENT' ? 'Percent' : 'Amount (Ks)'}
            <input type="number" className={field} value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
          </label>
        )}
        {form.kind === 'PERCENT' && (
          <label className="text-xs font-semibold text-muted-foreground">
            Max discount (Ks, 0 = none)
            <input type="number" className={field} value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })} />
          </label>
        )}
        <label className="text-xs font-semibold text-muted-foreground">
          Minimum order (Ks)
          <input type="number" className={field} value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: Number(e.target.value) })} />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Uses per customer
          <input type="number" min={1} className={field} value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: Number(e.target.value) })} />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Total uses (0 = unlimited)
          <input type="number" min={0} className={field} value={form.totalLimit} onChange={(e) => setForm({ ...form, totalLimit: Number(e.target.value) })} />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Expires
          <input type="date" className={field} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
        </label>
        <label className="text-xs font-semibold text-muted-foreground md:col-span-3">
          Description
          <input className={field} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Shown to customers" />
        </label>
        <label className="flex items-center gap-2 self-end text-sm text-foreground">
          <input type="checkbox" checked={form.firstOrderOnly} onChange={(e) => setForm({ ...form, firstOrderOnly: e.target.checked })} />
          First order only
        </label>
        <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-admin px-4 py-2 text-sm font-bold text-white disabled:opacity-60 md:col-span-4">
          <Plus className="h-4 w-4" /> {saving ? 'Saving…' : 'Save code'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Offer</th>
              <th className="px-4 py-2">Rules</th>
              <th className="px-4 py-2">Used</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.code} className="border-t border-border">
                <td className="px-4 py-2 font-mono font-bold">{p.code}</td>
                <td className="px-4 py-2">
                  {p.label}
                  <span className="block text-xs text-muted-foreground">{p.description}</span>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {p.minSubtotal ? `Min ${p.minSubtotal.toLocaleString()} Ks · ` : ''}
                  {p.perUserLimit || 1}× per customer
                  {p.firstOrderOnly ? ' · first order' : ''}
                  {p.expiresAt ? ` · until ${new Date(p.expiresAt).toLocaleDateString()}` : ''}
                </td>
                <td className="px-4 py-2">
                  {p.usedCount || 0}
                  {p.totalLimit ? ` / ${p.totalLimit}` : ''}
                </td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => void save({ ...p, active: !p.active })}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      p.active ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {p.active ? 'Active' : 'Off'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
