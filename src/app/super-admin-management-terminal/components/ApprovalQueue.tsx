'use client';

import React, { useEffect, useState } from 'react';
import { Check, X, Eye, FileText, Store, Bike, Clock, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

type ApprovalType = 'VENDOR' | 'RIDER';
type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type TypeFilter = 'ALL' | ApprovalType;
type StatusFilter = 'ALL' | 'APPROVED' | 'PENDING';

interface ApprovalItem {
  id: string;
  type: ApprovalType;
  name: string;
  submittedBy: string;
  email: string;
  phone?: string;
  cuisine?: string;
  address?: string;
  description?: string;
  submittedAt: string;
  documents: number;
  status: ApprovalStatus;
  commissionRate?: number;
  vehicleType?: string;
  licenseNumber?: string;
  flagged?: boolean;
  source?: 'application' | 'profile';
}

const STATUS_STYLES: Record<ApprovalStatus, string> = {
  PENDING: 'bg-warning/10 text-warning',
  APPROVED: 'bg-success/10 text-success',
  REJECTED: 'bg-danger/10 text-danger',
};

interface ApprovalQueueProps {
  /** When set from sidebar, locks the queue to that type and includes profiles. */
  typeFilter?: TypeFilter;
}

export default function ApprovalQueue({ typeFilter = 'ALL' }: ApprovalQueueProps) {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TypeFilter>(typeFilter);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const locked = typeFilter !== 'ALL';

  useEffect(() => {
    setFilter(typeFilter);
    setStatusFilter('ALL');
  }, [typeFilter]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const loadVendors = typeFilter === 'ALL' || typeFilter === 'VENDOR';
      const loadRiders = typeFilter === 'ALL' || typeFilter === 'RIDER';
      const includeProfiles = typeFilter !== 'ALL';

      const requests: Promise<Response>[] = [];
      const keys: string[] = [];

      if (loadVendors) {
        requests.push(fetch('/api/restaurant-applications?status=PENDING'));
        keys.push('restoApps');
        if (includeProfiles) {
          requests.push(fetch('/api/restaurant-profiles'));
          keys.push('restoProfiles');
        }
      }
      if (loadRiders) {
        requests.push(fetch('/api/driver-applications?status=PENDING'));
        keys.push('driverApps');
        if (includeProfiles) {
          requests.push(fetch('/api/driver-profiles'));
          keys.push('driverProfiles');
        }
      }

      const responses = await Promise.all(requests);
      const payloads = await Promise.all(responses.map((r) => r.json()));

      const byKey: Record<string, { ok: boolean; data: Record<string, unknown> }> = {};
      keys.forEach((key, i) => {
        byKey[key] = { ok: responses[i].ok, data: payloads[i] };
      });

      for (const [key, entry] of Object.entries(byKey)) {
        if (!entry.ok || !entry.data.success) {
          throw new Error((entry.data.message as string) || `Failed to load ${key}`);
        }
      }

      const next: ApprovalItem[] = [];

      if (byKey.restoApps) {
        next.push(
          ...((byKey.restoApps.data.applications as ApprovalItem[]) || []).map((a) => ({
            ...a,
            source: 'application' as const,
          }))
        );
      }
      if (byKey.restoProfiles) {
        next.push(...((byKey.restoProfiles.data.profiles as ApprovalItem[]) || []));
      }
      if (byKey.driverApps) {
        next.push(
          ...((byKey.driverApps.data.applications as ApprovalItem[]) || []).map((a) => ({
            ...a,
            source: 'application' as const,
          }))
        );
      }
      if (byKey.driverProfiles) {
        next.push(...((byKey.driverProfiles.data.profiles as ApprovalItem[]) || []));
      }

      setItems(next);
    } catch {
      toast.error('Could not load data');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when sidebar type changes
  }, [typeFilter]);

  const byType = filter === 'ALL' ? items : items.filter((i) => i.type === filter);
  const filtered = locked
    ? statusFilter === 'ALL'
      ? byType
      : byType.filter((i) => i.status === statusFilter)
    : byType;
  const pendingCount = items.filter((i) => i.status === 'PENDING').length;
  const profileCount = items.filter((i) => i.source === 'profile' || i.status === 'APPROVED').length;

  const title =
    typeFilter === 'VENDOR'
      ? 'Vendors'
      : typeFilter === 'RIDER'
        ? 'Riders'
        : 'Approval Queue';

  const apiFor = (type: ApprovalType) =>
    type === 'VENDOR' ? '/api/restaurant-applications' : '/api/driver-applications';

  const approve = async (item: ApprovalItem) => {
    setActionId(item.id);
    try {
      const res = await fetch(apiFor(item.type), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: 'APPROVED' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Approve failed');
      }
      await loadApplications();
      setSelectedItem(null);
      toast.success(
        item.type === 'RIDER'
          ? `${item.name} approved and moved to driver profiles. They can log in now.`
          : `${item.name} approved and restaurant profile created. They can log in now.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not approve application');
    } finally {
      setActionId(null);
    }
  };

  const reject = async (item: ApprovalItem) => {
    setActionId(item.id);
    try {
      const res = await fetch(`${apiFor(item.type)}?id=${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Reject failed');
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelectedItem(null);
      toast.error(
        `${item.name} rejected — removed from applications (user kept for rejection login message)`
      );
    } catch {
      toast.error('Could not reject application');
    } finally {
      setActionId(null);
    }
  };

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-base text-white">{title}</h2>
            {pendingCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-warning/10 text-warning text-xs font-bold rounded-full">
                <Clock className="w-3 h-3" />
                {pendingCount} pending
              </span>
            )}
            {locked && profileCount > 0 && (
              <span className="px-2 py-0.5 bg-success/10 text-success text-xs font-bold rounded-full">
                {profileCount} active
              </span>
            )}
          </div>
          {locked ? (
            <div className="flex bg-zinc-800 rounded-lg p-1 gap-1">
              {(['ALL', 'APPROVED', 'PENDING'] as const).map((f) => (
                <button
                  key={`status-filter-${f}`}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${statusFilter === f ? 'bg-admin text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  {f === 'ALL' ? 'All' : f === 'APPROVED' ? 'Approved' : 'Pending'}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex bg-zinc-800 rounded-lg p-1 gap-1">
              {(['ALL', 'VENDOR', 'RIDER'] as const).map((f) => (
                <button
                  key={`filter-${f}`}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${filter === f ? 'bg-admin text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  {f === 'ALL' ? 'All' : f === 'VENDOR' ? 'Vendors' : 'Riders'}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="px-5 py-10 text-sm text-zinc-400">Loading from MongoDB...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/50">
                  {['Applicant', 'Type', 'Submitted By', 'Date', 'Documents', 'Details', 'Status', 'Actions'].map((h) => (
                    <th key={`ah-${h}`} className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase text-zinc-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-400">
                      {locked
                        ? statusFilter === 'PENDING'
                          ? 'No pending applications.'
                          : statusFilter === 'APPROVED'
                            ? typeFilter === 'VENDOR'
                              ? 'No approved restaurant profiles yet.'
                              : 'No approved driver profiles yet.'
                            : typeFilter === 'VENDOR'
                              ? 'No vendor applications or restaurant profiles yet.'
                              : 'No rider applications or driver profiles yet.'
                        : 'No pending applications in this filter.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={`${item.source || 'application'}-${item.type}-${item.id}`} className={`hover:bg-zinc-800/50 transition-colors group ${item.flagged ? 'bg-danger/5' : ''}`}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {item.flagged && <TriangleAlert className="w-3.5 h-3.5 text-danger flex-shrink-0" title="Document irregularity flagged" />}
                          <span className="text-sm font-semibold text-white">{item.name}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{item.email}</p>
                        {item.source === 'profile' && (
                          <p className="text-[10px] uppercase tracking-wider text-success mt-0.5 font-semibold">Profile</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`status-badge ${item.type === 'VENDOR' ? 'bg-teal-500/10 text-restaurant' : 'bg-rider/10 text-rider'}`}>
                          {item.type === 'VENDOR' ? <Store className="w-3 h-3" /> : <Bike className="w-3 h-3" />}
                          {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-zinc-400 whitespace-nowrap">{item.submittedBy}</td>
                      <td className="px-4 py-3.5 text-sm text-zinc-500 whitespace-nowrap font-tabular">{item.submittedAt}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="text-sm text-zinc-300 font-semibold font-tabular">{item.documents} docs</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-zinc-400 whitespace-nowrap">
                        {item.type === 'VENDOR'
                          ? <span>{item.cuisine || `${item.commissionRate}% commission`}</span>
                          : <span>{item.vehicleType}</span>
                        }
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`status-badge ${STATUS_STYLES[item.status]}`}>
                          {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedItem(item)}
                            className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 transition-colors"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {item.status === 'PENDING' && item.source !== 'profile' && (
                            <>
                              <button
                                type="button"
                                disabled={actionId === item.id}
                                onClick={() => approve(item)}
                                className="p-1.5 rounded-lg hover:bg-success/10 text-zinc-500 hover:text-success transition-colors disabled:opacity-50"
                                title="Approve application"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={actionId === item.id}
                                onClick={() => reject(item)}
                                className="p-1.5 rounded-lg hover:bg-danger/10 text-zinc-500 hover:text-danger transition-colors disabled:opacity-50"
                                title="Reject application"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {selectedItem.source === 'profile' ? 'Profile Details' : 'Application Details'}
                </h3>
                <p className="text-sm text-zinc-400">{selectedItem.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 text-sm">
              <DetailRow label="Type" value={selectedItem.type} />
              <DetailRow
                label={selectedItem.type === 'VENDOR' ? 'Restaurant' : 'Driver'}
                value={selectedItem.name}
              />
              <DetailRow label={selectedItem.type === 'VENDOR' ? 'Owner' : 'Name'} value={selectedItem.submittedBy} />
              <DetailRow label="Email" value={selectedItem.email} />
              <DetailRow label="Phone" value={selectedItem.phone || 'Not provided'} />
              {selectedItem.type === 'VENDOR' && (
                <>
                  <DetailRow label="Cuisine" value={selectedItem.cuisine || 'Not specified'} />
                  <DetailRow label="Address" value={selectedItem.address || 'Not provided'} />
                </>
              )}
              {selectedItem.type === 'RIDER' && (
                <>
                  <DetailRow label="Vehicle" value={selectedItem.vehicleType || 'Not specified'} />
                  <DetailRow label="License" value={selectedItem.licenseNumber || 'Not provided'} />
                  <DetailRow label="Address" value={selectedItem.address || 'Not provided'} />
                </>
              )}
              <DetailRow label="Submitted" value={selectedItem.submittedAt} />
              <DetailRow label="Documents" value={`${selectedItem.documents} uploaded`} />
              <DetailRow label="Status" value={selectedItem.status} />
            </div>
            {selectedItem.status === 'PENDING' && selectedItem.source !== 'profile' && (
              <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={actionId === selectedItem.id}
                  onClick={() => reject(selectedItem)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={actionId === selectedItem.id}
                  onClick={() => approve(selectedItem)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-success/10 text-success hover:bg-success/20 disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-zinc-500 font-medium">{label}</span>
      <span className="text-zinc-200 text-right">{value}</span>
    </div>
  );
}
