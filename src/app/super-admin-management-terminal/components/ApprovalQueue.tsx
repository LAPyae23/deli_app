'use client';

import React, { useState } from 'react';
import { Check, X, Eye, FileText, Store, Bike, Clock, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

type ApprovalType = 'VENDOR' | 'RIDER';
type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface ApprovalItem {
  id: string;
  type: ApprovalType;
  name: string;
  submittedBy: string;
  email: string;
  submittedAt: string;
  documents: number;
  status: ApprovalStatus;
  commissionRate?: number;
  vehicleType?: string;
  flagged?: boolean;
}

const INITIAL_QUEUE: ApprovalItem[] = [
  { id: 'appr-001', type: 'VENDOR', name: 'Dragon Palace', submittedBy: 'Wei Zhang', email: 'wei@dragonpalace.com', submittedAt: '07/29 09:14', documents: 4, status: 'PENDING', commissionRate: 18, flagged: false },
  { id: 'appr-002', type: 'RIDER', name: 'Marcus Johnson', submittedBy: 'Marcus Johnson', email: 'marcus.j@riders.com', submittedAt: '07/29 10:32', documents: 3, status: 'PENDING', vehicleType: 'Motorcycle', flagged: true },
  { id: 'appr-003', type: 'VENDOR', name: 'Sunrise Diner', submittedBy: 'Elena Kowalski', email: 'elena@sunrisediner.com', submittedAt: '07/29 11:05', documents: 5, status: 'PENDING', commissionRate: 20, flagged: false },
  { id: 'appr-004', type: 'RIDER', name: 'Fatima Al-Hassan', submittedBy: 'Fatima Al-Hassan', email: 'fatima.alh@riders.com', submittedAt: '07/29 11:48', documents: 3, status: 'PENDING', vehicleType: 'Scooter', flagged: false },
  { id: 'appr-005', type: 'VENDOR', name: 'The Curry House', submittedBy: 'Raj Patel', email: 'raj@curryhouse.com', submittedAt: '07/29 12:20', documents: 4, status: 'PENDING', commissionRate: 18, flagged: false },
  { id: 'appr-006', type: 'RIDER', name: 'Tyler Brooks', submittedBy: 'Tyler Brooks', email: 'tyler.b@riders.com', submittedAt: '07/29 13:11', documents: 2, status: 'PENDING', vehicleType: 'Bicycle', flagged: true },
  { id: 'appr-007', type: 'VENDOR', name: 'Noodle Republic', submittedBy: 'Mei Lin', email: 'mei@noodlerepublic.com', submittedAt: '07/29 14:03', documents: 5, status: 'PENDING', commissionRate: 22, flagged: false },
  { id: 'appr-008', type: 'RIDER', name: 'Kwame Asante', submittedBy: 'Kwame Asante', email: 'kwame.a@riders.com', submittedAt: '07/29 14:55', documents: 3, status: 'PENDING', vehicleType: 'Motorcycle', flagged: false },
  { id: 'appr-009', type: 'VENDOR', name: 'Bella Italia', submittedBy: 'Sofia Romano', email: 'sofia@bellaitalia.com', submittedAt: '07/29 15:22', documents: 4, status: 'PENDING', commissionRate: 19, flagged: false },
  { id: 'appr-010', type: 'RIDER', name: 'Jin-ho Park', submittedBy: 'Jin-ho Park', email: 'jinho.p@riders.com', submittedAt: '07/29 15:44', documents: 3, status: 'PENDING', vehicleType: 'Scooter', flagged: false },
];

const STATUS_STYLES: Record<ApprovalStatus, string> = {
  PENDING: 'bg-warning/10 text-warning',
  APPROVED: 'bg-success/10 text-success',
  REJECTED: 'bg-danger/10 text-danger',
};

export default function ApprovalQueue() {
  const [items, setItems] = useState(INITIAL_QUEUE);
  const [filter, setFilter] = useState<'ALL' | ApprovalType>('ALL');

  const filtered = filter === 'ALL' ? items : items.filter(i => i.type === filter);
  const pendingCount = items.filter(i => i.status === 'PENDING').length;

  const approve = (id: string, name: string) => {
    // BACKEND INTEGRATION: POST /api/admin/approvals/:id/approve
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'APPROVED' } : i));
    toast.success(`${name} approved successfully`);
  };

  const reject = (id: string, name: string) => {
    // BACKEND INTEGRATION: POST /api/admin/approvals/:id/reject
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'REJECTED' } : i));
    toast.error(`${name} application rejected`);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-base text-white">Approval Queue</h2>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-warning/10 text-warning text-xs font-bold rounded-full">
              <Clock className="w-3 h-3" />
              {pendingCount} pending
            </span>
          )}
        </div>
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
      </div>

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
            {filtered.map((item) => (
              <tr key={item.id} className={`hover:bg-zinc-800/50 transition-colors group ${item.flagged ? 'bg-danger/5' : ''}`}>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    {item.flagged && <TriangleAlert className="w-3.5 h-3.5 text-danger flex-shrink-0" title="Document irregularity flagged" />}
                    <span className="text-sm font-semibold text-white">{item.name}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{item.email}</p>
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
                    ? <span className="font-tabular">{item.commissionRate}% commission</span>
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
                    <button className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 transition-colors" title="View documents">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {item.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => approve(item.id, item.name)}
                          className="p-1.5 rounded-lg hover:bg-success/10 text-zinc-500 hover:text-success transition-colors"
                          title="Approve application"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => reject(item.id, item.name)}
                          className="p-1.5 rounded-lg hover:bg-danger/10 text-zinc-500 hover:text-danger transition-colors"
                          title="Reject application — applicant will be notified"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}