'use client';

import React, { useEffect, useState } from 'react';
import { Save, Zap, Percent, MapPin, Lock, UserPlus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatKyat } from '@/lib/currency';

interface SurgeZone {
  id: string;
  name: string;
  multiplier: number;
  active: boolean;
  activeOrders: number;
  availableRiders: number;
  totalOrders?: number;
  totalRiders?: number;
  customers?: number;
  demandRatio?: number;
  demandScore?: number;
  imbalance?: boolean;
  autoActivated?: boolean;
  suggestedFeeNote?: string;
}

export default function SystemConfig() {
  const [globalCommission, setGlobalCommission] = useState(18);
  const [platformFee, setPlatformFee] = useState(0.5);
  const [surgeZones, setSurgeZones] = useState<SurgeZone[]>([]);
  const [surgeLoading, setSurgeLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSurge, setAutoSurge] = useState(true);
  const [surgeSummary, setSurgeSummary] = useState('');
  const [imbalanceThreshold, setImbalanceThreshold] = useState(2);
  const [isLoading, setIsLoading] = useState(true);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/admin/config');
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load');
        if (cancelled || !data.config) return;

        if (data.config.globalCommission != null) {
          setGlobalCommission(Number(data.config.globalCommission));
        }
        if (data.config.platformFee != null) {
          setPlatformFee(Number(data.config.platformFee));
        }
        if (data.config.autoSurge != null) {
          setAutoSurge(Boolean(data.config.autoSurge));
        }
        if (data.config.surgeImbalanceThreshold != null) {
          setImbalanceThreshold(Number(data.config.surgeImbalanceThreshold));
        }
      } catch (error) {
        console.warn(error);
        if (!cancelled) toast.error('Failed to load system config');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    async function loadSurge() {
      setSurgeLoading(true);
      try {
        const res = await fetch('/api/admin/surge');
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load surge');
        if (!cancelled) {
          setSurgeZones(Array.isArray(data.zones) ? data.zones : []);
          if (data.summary) setSurgeSummary(String(data.summary));
          if (data.surgeImbalanceThreshold != null) {
            setImbalanceThreshold(Number(data.surgeImbalanceThreshold));
          }
          if (data.autoSurge != null) setAutoSurge(Boolean(data.autoSurge));
        }
      } catch (error) {
        console.warn(error);
        if (!cancelled) {
          setSurgeZones([]);
          toast.error('Failed to load township surge data');
        }
      } finally {
        if (!cancelled) setSurgeLoading(false);
      }
    }

    loadConfig();
    loadSurge();
    const interval = setInterval(loadSurge, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const updateMultiplier = (id: string, value: number) => {
    setSurgeZones((prev) => prev.map((z) => (z.id === id ? { ...z, multiplier: value } : z)));
  };

  const toggleZoneSurge = (id: string) => {
    setSurgeZones((prev) => prev.map((z) => (z.id === id ? { ...z, active: !z.active } : z)));
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const adminSessionId = localStorage.getItem('fooddash_session_id');
    if (!adminSessionId) {
      toast.error('Please sign in again');
      return;
    }
    if (
      !adminForm.firstName.trim() ||
      !adminForm.lastName.trim() ||
      !adminForm.email.trim() ||
      !adminForm.phone.trim() ||
      !adminForm.password
    ) {
      toast.error('All fields are required');
      return;
    }

    setCreatingAdmin(true);
    try {
      const res = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminSessionId,
          firstName: adminForm.firstName.trim(),
          lastName: adminForm.lastName.trim(),
          email: adminForm.email.trim(),
          phone: adminForm.phone.trim(),
          password: adminForm.password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create admin');
      }
      toast.success(
        `Admin created${data.user?.displayId ? ` (${data.user.displayId})` : ''}`
      );
      setAdminForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create admin');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const toggleAutoSurge = async () => {
    const next = !autoSurge;
    setAutoSurge(next);
    try {
      await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSurge: next }),
      });
      const res = await fetch('/api/admin/surge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSurge: next, forceRebalance: next }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(next ? 'Auto-surge balancer enabled' : 'Manual surge mode');
      }
      // Refresh live zones
      const surgeRes = await fetch('/api/admin/surge');
      const surgeData = await surgeRes.json();
      if (surgeRes.ok && surgeData.success) {
        setSurgeZones(Array.isArray(surgeData.zones) ? surgeData.zones : []);
        if (surgeData.summary) setSurgeSummary(String(surgeData.summary));
      }
    } catch {
      toast.error('Failed to toggle auto-surge');
      setAutoSurge(!next);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          globalCommission,
          platformFee,
          autoSurge,
          surgeImbalanceThreshold: imbalanceThreshold,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Save failed');

      if (!autoSurge) {
        await fetch('/api/admin/surge', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            autoSurge: false,
            zones: surgeZones.map((z) => ({
              id: z.id,
              name: z.name,
              multiplier: z.multiplier,
              active: z.active,
            })),
          }),
        });
      } else {
        await fetch('/api/admin/surge', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            autoSurge: true,
            surgeImbalanceThreshold: imbalanceThreshold,
            forceRebalance: true,
          }),
        });
      }

      toast.success('System configuration saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save config');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="font-bold text-base text-foreground">System Config</h2>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-admin/20 text-admin border border-admin/30 rounded-lg hover:bg-admin/30 transition-colors active:scale-95 disabled:opacity-50"
        >
          {isSaving ? (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <Save className="w-3 h-3" />
          )}
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-5 space-y-6">
        {/* Global Commission */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Percent className="w-4 h-4 text-customer" />
            <p className="text-sm font-bold text-foreground">Commission Rates</p>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Global Default Rate</label>
                <span className="text-sm font-bold text-foreground font-tabular">{globalCommission}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={30}
                step={0.5}
                value={globalCommission}
                onChange={e => setGlobalCommission(Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-admin"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>10%</span><span>30%</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Platform Fee (per order)</label>
                <span className="text-sm font-bold text-foreground font-tabular">{formatKyat(platformFee)}</span>
              </div>
              <input
                type="range"
                min={0.25}
                max={2.00}
                step={0.25}
                value={platformFee}
                onChange={e => setPlatformFee(Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-admin"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{formatKyat(0.25)}</span><span>{formatKyat(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Surge Pricing */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-warning" />
              <p className="text-sm font-bold text-foreground">Auto Surge Balancer</p>
            </div>
            <button
              type="button"
              onClick={toggleAutoSurge}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${autoSurge ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${autoSurge ? 'bg-warning status-pulse' : 'bg-muted-foreground'}`} />
              {autoSurge ? 'Auto' : 'Manual'}
            </button>
          </div>

          <p className="mb-2 text-xs text-muted-foreground">
            When active orders exceed available riders by {imbalanceThreshold}×, surge activates
            at 1.5×+ delivery multiplier.
          </p>
          {surgeSummary && (
            <p className="mb-3 rounded-lg border border-warning/20 bg-warning/10 px-2.5 py-1.5 text-[11px] font-semibold text-warning">
              {surgeSummary}
            </p>
          )}

          <div className="space-y-3">
            {surgeLoading ? (
              <div className="rounded-xl border border-border bg-muted px-4 py-8 text-center text-xs text-muted-foreground">
                Computing Yangon township surge…
              </div>
            ) : surgeZones.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/50 px-4 py-8 text-center text-xs text-muted-foreground">
                No township surge data yet. Run the seeder to populate Yangon zones.
              </div>
            ) : (
              surgeZones.map((zone) => {
                const demandRatio =
                  zone.demandRatio ??
                  zone.activeOrders / Math.max(zone.availableRiders, 1);
                const isHighDemand =
                  zone.imbalance || demandRatio >= imbalanceThreshold || zone.multiplier >= 1.5;
                return (
                  <div
                    key={zone.id}
                    className={`bg-muted rounded-xl p-3.5 border ${
                      isHighDemand
                        ? 'border-danger/40 bg-danger/5'
                        : zone.active
                          ? 'border-warning/20'
                          : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-semibold text-foreground truncate">
                          {zone.name}
                        </span>
                        {isHighDemand && (
                          <span className="rounded-full bg-danger/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-danger">
                            Imbalance
                          </span>
                        )}
                        {zone.autoActivated && autoSurge && (
                          <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-warning">
                            Auto
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => !autoSurge && toggleZoneSurge(zone.id)}
                        disabled={autoSurge}
                        className={`w-9 h-5 rounded-full transition-all duration-200 relative shrink-0 disabled:opacity-70 ${
                          zone.active ? 'bg-warning' : 'bg-muted-foreground'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                            zone.active ? 'left-4' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 gap-2">
                      <span>
                        {zone.activeOrders} active · {zone.availableRiders} riders
                        {demandRatio != null ? ` · ${Number(demandRatio).toFixed(1)}×` : ''}
                      </span>
                      <span
                        className={`font-bold font-tabular ${
                          zone.active ? 'text-warning' : 'text-muted-foreground'
                        }`}
                      >
                        {Number(zone.multiplier).toFixed(1)}×
                      </span>
                    </div>
                    {zone.suggestedFeeNote && (
                      <p className="mb-2 text-[10px] text-muted-foreground">
                        {zone.suggestedFeeNote}
                      </p>
                    )}
                    <input
                      type="range"
                      min={1.0}
                      max={3.0}
                      step={0.1}
                      value={zone.multiplier}
                      onChange={(e) => updateMultiplier(zone.id, Number(e.target.value))}
                      disabled={autoSurge}
                      className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-warning disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>1.0×</span>
                      <span>3.0×</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Create New Admin */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-admin" />
            <p className="text-sm font-bold text-foreground">Create New Admin</p>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Register a Super Admin account. The password is hashed before it is stored.
          </p>
          <form onSubmit={handleCreateAdmin} className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                className="input-field py-2 text-sm"
                placeholder="First name"
                value={adminForm.firstName}
                onChange={(e) => setAdminForm({ ...adminForm, firstName: e.target.value })}
                autoComplete="off"
              />
              <input
                type="text"
                className="input-field py-2 text-sm"
                placeholder="Last name"
                value={adminForm.lastName}
                onChange={(e) => setAdminForm({ ...adminForm, lastName: e.target.value })}
                autoComplete="off"
              />
            </div>
            <input
              type="email"
              className="input-field py-2 text-sm"
              placeholder="Email"
              value={adminForm.email}
              onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
              autoComplete="off"
            />
            <input
              type="tel"
              className="input-field py-2 text-sm"
              placeholder="Phone"
              value={adminForm.phone}
              onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
              autoComplete="off"
            />
            <input
              type="password"
              className="input-field py-2 text-sm"
              placeholder="Password (8+ chars, mixed case, number, symbol)"
              value={adminForm.password}
              onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
              autoComplete="new-password"
            />
            <button
              type="submit"
              disabled={creatingAdmin}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-admin/30 bg-admin/20 px-3 py-2.5 text-xs font-bold text-admin transition-colors hover:bg-admin/30 disabled:opacity-60"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {creatingAdmin ? 'Creating…' : 'Create Admin Account'}
            </button>
          </form>
        </div>

        {/* Security / Change Password */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Lock className="h-4 w-4 text-admin" />
            <p className="text-sm font-bold text-foreground">Security</p>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Protect the admin terminal with a strong password.
          </p>
          <Link
            href="/change-password"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-admin/30 bg-admin/20 px-3 py-2.5 text-xs font-bold text-admin transition-colors hover:bg-admin/30"
          >
            <Lock className="h-3.5 w-3.5" />
            Change Password
          </Link>
        </div>
      </div>
    </div>
  );
}