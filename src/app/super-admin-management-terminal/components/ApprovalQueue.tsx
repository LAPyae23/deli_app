'use client';

import React, { useEffect, useState } from 'react';
import { Check, X, Eye, FileText, Store, Bike, Clock, TriangleAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type ApprovalType = 'VENDOR' | 'RIDER';
type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface ApprovalItem {
  _id?: string;
  id?: string;
  type: ApprovalType;
  name: string;
  submittedBy: string;
  email: string;
  submittedAt?: string;
  createdAt?: string;
  documents: number;
  status: ApprovalStatus;
  commissionRate?: number;
  vehicleType?: string;
  flagged?: boolean;
  township?: string;
}

const STATUS_STYLES: Record<ApprovalStatus, string> = {
  PENDING: 'bg-warning/10 text-warning',
  APPROVED: 'bg-success/10 text-success',
  REJECTED: 'bg-danger/10 text-danger',
};

function itemKey(item: ApprovalItem) {
  return String(item._id || item.id || '');
}

function formatSubmittedAt(item: ApprovalItem) {
  if (item.submittedAt) return item.submittedAt;
  if (!item.createdAt) return '—';
  try {
    return new Date(item.createdAt).toLocaleString(undefined, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function ApprovalQueue() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | ApprovalType>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadApprovals() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/admin/approvals');
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load');
        if (!cancelled) {
          setItems(Array.isArray(data.approvals) ? data.approvals : []);
        }
      } catch (error) {
        console.warn(error);
        if (!cancelled) toast.error('Failed to load approval queue');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadApprovals();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = filter === 'ALL' ? items : items.filter((i) => i.type === filter);
  const pendingCount = items.filter((i) => i.status === 'PENDING').length;

  const approve = async (id: string, name: string, type: ApprovalType) => {
    try {
      const res = await fetch(`/api/admin/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED', type }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i._id === id || i.id === id ? { ...i, status: 'APPROVED' } : i
          )
        );
        toast.success(`${name} approved successfully`);
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Failed to approve');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve');
    }
  };

  const reject = async (id: string, name: string, type: ApprovalType) => {
    try {
      const res = await fetch(`/api/admin/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', type }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i._id === id || i.id === id ? { ...i, status: 'REJECTED' } : i
          )
        );
        toast.error(`${name} application rejected`);
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Failed to reject');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject');
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-base text-foreground">Approval Queue</h2>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-warning/10 text-warning text-xs font-bold rounded-full">
              <Clock className="w-3 h-3" />
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="flex bg-muted rounded-lg p-1 gap-1">
          {(['ALL', 'VENDOR', 'RIDER'] as const).map((f) => (
            <button
              key={`filter-${f}`}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${
                filter === f ? 'bg-admin text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'ALL' ? 'All' : f === 'VENDOR' ? 'Vendors' : 'Riders'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-admin" />
          <p className="text-sm font-medium">Loading approvals…</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {[
                  'Applicant',
                  'Type',
                  'Submitted By',
                  'Date',
                  'Documents',
                  'Details',
                  'Status',
                  'Actions',
                ].map((h) => (
                  <th
                    key={`ah-${h}`}
                    className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    No applications in this filter. Re-seed to generate pending Myanmar vendors/riders.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                const id = itemKey(item);
                return (
                  <tr
                    key={id || `${item.type}-${item.name}`}
                    className={`hover:bg-muted/50 transition-colors group ${
                      item.flagged ? 'bg-danger/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {item.flagged && (
                          <TriangleAlert
                            className="w-3.5 h-3.5 text-danger flex-shrink-0"
                            title="Document irregularity flagged"
                          />
                        )}
                        <span className="text-sm font-semibold text-foreground">{item.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.email}</p>
                      {item.township ? (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.township}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`status-badge ${
                          item.type === 'VENDOR'
                            ? 'bg-teal-500/10 text-restaurant'
                            : 'bg-rider/10 text-rider'
                        }`}
                      >
                        {item.type === 'VENDOR' ? (
                          <Store className="w-3 h-3" />
                        ) : (
                          <Bike className="w-3 h-3" />
                        )}
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                      {item.submittedBy}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap font-tabular">
                      {formatSubmittedAt(item)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm text-foreground/80 font-semibold font-tabular">
                          {item.documents} docs
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                      {item.type === 'VENDOR' ? (
                        <span className="font-tabular">{item.commissionRate}% commission</span>
                      ) : (
                        <span>{item.vehicleType}</span>
                      )}
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
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="View documents"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {item.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => approve(id, item.name, item.type)}
                              className="p-1.5 rounded-lg hover:bg-success/10 text-muted-foreground hover:text-success transition-colors"
                              title="Approve application"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => reject(id, item.name, item.type)}
                              className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"
                              title="Reject application — applicant will be notified"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
