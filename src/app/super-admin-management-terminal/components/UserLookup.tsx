'use client';

import React, { FormEvent, useState } from 'react';
import {
  Bike,
  Hash,
  Loader2,
  Mail,
  Search,
  Shield,
  ShieldAlert,
  Store,
  UserRound,
  Wallet,
} from 'lucide-react';
import { formatKyat } from '@/lib/currency';

type LookupUser = {
  id?: string;
  _id?: string;
  displayId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  walletBalance?: number;
  isBlocked?: boolean;
  profileImage?: string;
  township?: string;
  vehicleType?: string;
  status?: string;
};

type LookupOrder = {
  _id?: string;
  orderNumber?: string;
  restaurantName?: string;
  status?: string;
  createdAt?: string;
  totals?: {
    total?: number;
    totalAmount?: number;
  };
};

type LookupResponse = {
  success: boolean;
  message?: string;
  user?: LookupUser;
  orderHistory?: LookupOrder[];
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-warning/10 text-warning',
  PLACED: 'bg-info/10 text-info',
  PREPARING: 'bg-warning/10 text-warning',
  READY: 'bg-success/10 text-success',
  ASSIGNED: 'bg-admin/10 text-admin',
  PICKED_UP: 'bg-customer/10 text-customer',
  OUT_FOR_DELIVERY: 'bg-customer/10 text-customer',
  DELIVERED: 'bg-success/10 text-success',
  REJECTED: 'bg-danger/10 text-danger',
  CANCELLED: 'bg-danger/10 text-danger',
};

function RoleAvatar({ role, image }: { role: string; image?: string }) {
  if (image) {
    return (
      <img
        src={image}
        alt=""
        className="h-16 w-16 rounded-2xl object-cover ring-2 ring-border"
      />
    );
  }

  const iconClass = 'h-8 w-8';
  let wrap = 'bg-muted text-muted-foreground';
  let Icon = UserRound;

  if (role === 'RIDER') {
    wrap = 'bg-customer/15 text-customer';
    Icon = Bike;
  } else if (role === 'CUSTOMER') {
    wrap = 'bg-admin/15 text-admin';
    Icon = UserRound;
  } else if (role === 'RESTAURANT') {
    wrap = 'bg-warning/15 text-warning';
    Icon = Store;
  } else if (role === 'ADMIN') {
    wrap = 'bg-admin/15 text-admin';
    Icon = Shield;
  }

  return (
    <div
      className={`flex h-16 w-16 items-center justify-center rounded-2xl ${wrap}`}
    >
      <Icon className={iconClass} />
    </div>
  );
}

function orderTotal(order: LookupOrder) {
  return Number(order.totals?.total ?? order.totals?.totalAmount ?? 0);
}

function formatOrderDate(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function UserLookup() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<LookupUser | null>(null);
  const [orders, setOrders] = useState<LookupOrder[]>([]);
  const [searched, setSearched] = useState(false);

  async function handleSearch(event?: FormEvent) {
    event?.preventDefault();
    const id = query.trim();
    if (!id) {
      setError('Enter a Customer or Rider ID to search.');
      setUser(null);
      setOrders([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`);
      const data = (await res.json()) as LookupResponse;

      if (res.status === 404 || !data.success || !data.user) {
        setUser(null);
        setOrders([]);
        setError(data.message || 'User not found');
        return;
      }

      setUser(data.user);
      setOrders(Array.isArray(data.orderHistory) ? data.orderHistory : []);
    } catch {
      setUser(null);
      setOrders([]);
      setError('Failed to look up user. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const role = String(user?.role || '').toUpperCase();
  const displayName =
    user?.name ||
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
    'Unknown user';
  const displayId = user?.displayId || user?.id || user?._id || '—';
  const isSuspended = Boolean(user?.isBlocked);
  const wallet = Number(user?.walletBalance || 0);

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Search className="h-5 w-5 text-admin" />
          <h2 className="text-xl font-bold text-foreground">User Lookup</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Look up a customer or rider by ID to view wallet status and order history.
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:p-5"
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Customer or Rider ID..."
            className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none ring-admin/30 placeholder:text-muted-foreground focus:ring-2"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-admin px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-admin" />
          <p className="text-sm font-medium">Looking up user…</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-danger">{error}</p>
        </div>
      )}

      {!loading && !error && !user && !searched && (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
          <UserRound className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">
            Enter a Customer or Rider ID to load their profile.
          </p>
        </div>
      )}

      {!loading && user && (
        <>
          <div
            className={`rounded-2xl border bg-card p-5 sm:p-6 ${
              isSuspended ? 'border-danger/40' : 'border-border'
            }`}
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <RoleAvatar role={role} image={user.profileImage} />
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">{displayName}</h3>
                    <span className="rounded-full bg-admin/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-admin">
                      {role || 'USER'}
                    </span>
                  </div>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{user.email || '—'}</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground font-tabular">
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{displayId}</span>
                  </p>
                  {user.phone ? (
                    <p className="text-xs text-muted-foreground">{user.phone}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[22rem]">
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" />
                    Smart Wallet
                  </div>
                  <p
                    className={`text-lg font-bold font-tabular ${
                      wallet < 0 ? 'text-danger' : 'text-foreground'
                    }`}
                  >
                    {formatKyat(wallet)}
                  </p>
                </div>
                <div
                  className={`rounded-xl border p-4 ${
                    isSuspended
                      ? 'border-danger/40 bg-danger/10'
                      : 'border-border bg-background/60'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {isSuspended ? (
                      <ShieldAlert className="h-3.5 w-3.5 text-danger" />
                    ) : (
                      <Shield className="h-3.5 w-3.5 text-success" />
                    )}
                    Account Status
                  </div>
                  <p
                    className={`text-lg font-bold ${
                      isSuspended ? 'text-danger' : 'text-success'
                    }`}
                  >
                    {isSuspended ? 'Suspended' : 'Active'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-sm font-bold text-foreground">Order History</h3>
              <p className="text-xs text-muted-foreground">
                {orders.length} {orders.length === 1 ? 'order' : 'orders'}
              </p>
            </div>
            {orders.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                No orders found for this user.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Order ID</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map((order) => {
                      const status = String(order.status || 'PENDING').toUpperCase();
                      const statusClass =
                        STATUS_STYLES[status] || 'bg-muted text-muted-foreground';
                      return (
                        <tr key={String(order._id || order.orderNumber)} className="hover:bg-muted/30">
                          <td className="px-5 py-3 font-semibold font-tabular text-foreground">
                            {order.orderNumber || String(order._id || '—').slice(-8).toUpperCase()}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap text-muted-foreground font-tabular">
                            {formatOrderDate(order.createdAt)}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusClass}`}
                            >
                              {status.replaceAll('_', ' ')}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold font-tabular text-foreground">
                            {formatKyat(orderTotal(order))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
