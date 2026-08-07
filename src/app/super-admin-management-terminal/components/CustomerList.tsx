'use client';

import React, { useEffect, useState } from 'react';
import { Eye, User, Search } from 'lucide-react';
import { toast } from 'sonner';

interface CustomerItem {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  role: 'CUSTOMER';
  createdAt: string;
  createdAtIso: string;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-zinc-800 last:border-0">
      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-white text-right break-all">{value || '—'}</span>
    </div>
  );
}

export default function CustomerList() {
  const [items, setItems] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CustomerItem | null>(null);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load customers');
      }
      setItems((data.customers as CustomerItem[]) || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load customers');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? items.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query) ||
          c.phone.toLowerCase().includes(query)
      )
    : items;

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-base text-white">Customers</h2>
            <span className="px-2 py-0.5 bg-customer/10 text-customer text-xs font-bold rounded-full">
              {items.length} registered
            </span>
          </div>
          <div className="relative w-72 max-w-full">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone"
              className="w-full !pl-9 !pr-3 py-2 text-xs rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-admin"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-sm text-zinc-400">Loading customers from MongoDB...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/50">
                  {['Customer', 'Type', 'Phone', 'Joined', 'Actions'].map((h) => (
                    <th
                      key={`ch-${h}`}
                      className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase text-zinc-600 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-400">
                      {query ? 'No customers match your search.' : 'No customers registered yet.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr
                      key={`customer-${item.id}`}
                      className="hover:bg-zinc-800/50 transition-colors group"
                    >
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-semibold text-white">{item.name}</span>
                        <p className="text-xs text-zinc-500 mt-0.5">{item.email}</p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="status-badge bg-orange-500/10 text-customer">
                          <User className="w-3 h-3" />
                          CUSTOMER
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-zinc-400 whitespace-nowrap">
                        {item.phone || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-zinc-500 whitespace-nowrap font-tabular">
                        {item.createdAt}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => setSelected(item)}
                          className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors"
                          title="View customer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Customer Details</h3>
              <button
                onClick={() => setSelected(null)}
                className="text-zinc-500 hover:text-white text-sm font-semibold"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4 space-y-1">
              <DetailRow label="Type" value="CUSTOMER" />
              <DetailRow label="Name" value={selected.name} />
              <DetailRow label="Email" value={selected.email} />
              <DetailRow label="Phone" value={selected.phone} />
              <DetailRow label="Joined" value={selected.createdAt} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
