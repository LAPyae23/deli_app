'use client';

import React, { useState } from 'react';
import { Save, Zap, Percent, MapPin, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

interface SurgeZone {
  id: string;
  name: string;
  multiplier: number;
  active: boolean;
  activeOrders: number;
  availableRiders: number;
}

const SURGE_ZONES: SurgeZone[] = [
  { id: 'zone-manhattan', name: 'Manhattan', multiplier: 1.4, active: true, activeOrders: 62, availableRiders: 18 },
  { id: 'zone-brooklyn', name: 'Brooklyn', multiplier: 1.2, active: true, activeOrders: 41, availableRiders: 24 },
  { id: 'zone-queens', name: 'Queens', multiplier: 1.0, active: false, activeOrders: 28, availableRiders: 31 },
  { id: 'zone-bronx', name: 'The Bronx', multiplier: 1.6, active: true, activeOrders: 11, availableRiders: 4 },
];

export default function SystemConfig() {
  const [globalCommission, setGlobalCommission] = useState(18);
  const [platformFee, setPlatformFee] = useState(0.50);
  const [surgeZones, setSurgeZones] = useState(SURGE_ZONES);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSurge, setAutoSurge] = useState(true);

  const updateMultiplier = (id: string, value: number) => {
    setSurgeZones(prev => prev.map(z => z.id === id ? { ...z, multiplier: value } : z));
  };

  const toggleZoneSurge = (id: string) => {
    setSurgeZones(prev => prev.map(z => z.id === id ? { ...z, active: !z.active } : z));
  };

  const handleSave = async () => {
    setIsSaving(true);
    // BACKEND INTEGRATION: PATCH /api/admin/system-config with { globalCommission, platformFee, surgeZones }
    await new Promise(r => setTimeout(r, 1000));
    setIsSaving(false);
    toast.success('System configuration saved');
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
        <h2 className="font-bold text-base text-white">System Config</h2>
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
            <p className="text-sm font-bold text-white">Commission Rates</p>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-400">Global Default Rate</label>
                <span className="text-sm font-bold text-white font-tabular">{globalCommission}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={30}
                step={0.5}
                value={globalCommission}
                onChange={e => setGlobalCommission(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-admin"
              />
              <div className="flex justify-between text-xs text-zinc-600 mt-1">
                <span>10%</span><span>30%</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-400">Platform Fee (per order)</label>
                <span className="text-sm font-bold text-white font-tabular">${platformFee.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.25}
                max={2.00}
                step={0.25}
                value={platformFee}
                onChange={e => setPlatformFee(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-admin"
              />
              <div className="flex justify-between text-xs text-zinc-600 mt-1">
                <span>$0.25</span><span>$2.00</span>
              </div>
            </div>
          </div>
        </div>

        {/* Surge Pricing */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-warning" />
              <p className="text-sm font-bold text-white">Surge Pricing</p>
            </div>
            <button
              onClick={() => setAutoSurge(p => !p)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${autoSurge ? 'bg-warning/20 text-warning' : 'bg-zinc-800 text-zinc-500'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${autoSurge ? 'bg-warning status-pulse' : 'bg-zinc-600'}`} />
              {autoSurge ? 'Auto' : 'Manual'}
            </button>
          </div>

          <div className="space-y-3">
            {surgeZones.map((zone) => {
              const demandRatio = zone.activeOrders / Math.max(zone.availableRiders, 1);
              const isHighDemand = demandRatio > 2;
              return (
                <div key={zone.id} className={`bg-zinc-800 rounded-xl p-3.5 border ${zone.active ? 'border-warning/20' : 'border-zinc-700'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-sm font-semibold text-white">{zone.name}</span>
                      {isHighDemand && <TriangleAlert className="w-3 h-3 text-danger" title="High demand — rider shortage" />}
                    </div>
                    <button
                      onClick={() => toggleZoneSurge(zone.id)}
                      className={`w-9 h-5 rounded-full transition-all duration-200 relative ${zone.active ? 'bg-warning' : 'bg-zinc-600'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${zone.active ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                    <span>{zone.activeOrders} orders · {zone.availableRiders} riders</span>
                    <span className={`font-bold font-tabular ${zone.active ? 'text-warning' : 'text-zinc-500'}`}>
                      {zone.multiplier.toFixed(1)}×
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={3.0}
                    step={0.1}
                    value={zone.multiplier}
                    onChange={e => updateMultiplier(zone.id, Number(e.target.value))}
                    disabled={!zone.active}
                    className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-warning disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-xs text-zinc-700 mt-1">
                    <span>1.0×</span><span>3.0×</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}