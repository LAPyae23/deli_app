'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Clock, Check, X, ChevronDown, AlertCircle, Bell } from 'lucide-react';
import { toast } from 'sonner';

type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'REJECTED';

interface IncomingOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  items: string[];
  total: number;
  status: OrderStatus;
  receivedAt: string;
  prepTime?: number;
}

const RESTAURANT_NAME = 'Burger Bliss';
const PREP_TIMES = [15, 20, 25, 30, 45];
const POLL_MS = 10_000;

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-warning/10 text-warning',
  PREPARING: 'bg-info/10 text-info',
  READY: 'bg-success/10 text-success',
  REJECTED: 'bg-danger/10 text-danger',
};

function formatReceivedAt(createdAt?: string) {
  if (!createdAt) return '—';
  try {
    return new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function mapApiOrder(raw: Record<string, unknown>): IncomingOrder | null {
  const status = String(raw.status || '').toUpperCase() as OrderStatus;
  if (status === 'REJECTED' || status === 'DELIVERED' || status === 'CANCELLED') {
    return null;
  }
  if (!['PENDING', 'PREPARING', 'READY'].includes(status)) {
    return null;
  }

  const items = Array.isArray(raw.items)
    ? (raw.items as Array<{ name?: string; quantity?: number; options?: string }>).map((item) => {
        const qty = item.quantity ?? 1;
        const opts = item.options ? ` (${item.options})` : '';
        return `${item.name || 'Item'} × ${qty}${opts}`;
      })
    : [];

  const totals = (raw.totals || {}) as { total?: number };
  const id = String(raw._id ?? '');

  return {
    id,
    orderNumber: String(raw.orderNumber || `#${id.slice(-4)}`),
    customerName: String(raw.customerName || 'Customer'),
    items,
    total: Number(totals.total) || 0,
    status: status as OrderStatus,
    receivedAt: formatReceivedAt(raw.createdAt as string | undefined),
    prepTime: raw.prepTime != null ? Number(raw.prepTime) : undefined,
  };
}

export default function OrderQueue() {
  const [orders, setOrders] = useState<IncomingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [prepTimeSelects, setPrepTimeSelects] = useState<Record<string, number>>({});
  const [openPrepSelect, setOpenPrepSelect] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const res = await fetch(
        `/api/orders?restaurantName=${encodeURIComponent(RESTAURANT_NAME)}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to fetch');

      const mapped = (Array.isArray(data.orders) ? data.orders : [])
        .map((raw: Record<string, unknown>) => mapApiOrder(raw))
        .filter(Boolean) as IncomingOrder[];

      setOrders(mapped);
    } catch (error) {
      console.error(error);
      if (showSpinner) toast.error('Failed to load order queue');
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(true);
    const interval = setInterval(() => fetchOrders(false), POLL_MS);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const patchOrder = async (
    orderId: string,
    body: { status: string; prepTime?: number }
  ) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to update order');
    }
    return data.order as Record<string, unknown>;
  };

  const acceptOrder = async (orderId: string) => {
    const prepTime = prepTimeSelects[orderId] || 25;
    setUpdatingId(orderId);
    try {
      await patchOrder(orderId, { status: 'PREPARING', prepTime });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'PREPARING', prepTime } : o))
      );
      toast.success(`Order accepted — ${prepTime} min prep time set`);
      setOpenPrepSelect(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept order');
    } finally {
      setUpdatingId(null);
    }
  };

  const rejectOrder = async (orderId: string, orderNumber: string) => {
    setUpdatingId(orderId);
    try {
      await patchOrder(orderId, { status: 'REJECTED' });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.error(`Order ${orderNumber} rejected`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject order');
    } finally {
      setUpdatingId(null);
    }
  };

  const markReady = async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      await patchOrder(orderId, { status: 'READY' });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'READY' } : o))
      );
      toast.success('Order marked ready for pickup');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark ready');
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden card-shadow h-full flex flex-col">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-base">Order Queue</h2>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-warning/10 text-warning text-xs font-bold rounded-full">
              <Bell className="w-3 h-3" />
              {pendingCount} new
            </span>
          )}
        </div>
        <span className="text-sm text-muted-foreground">{orders.length} active</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide divide-y divide-border">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-restaurant border-t-transparent" />
            <p className="text-sm font-medium">Loading orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingBagIcon />
            <p className="font-semibold text-foreground mt-3">No active orders</p>
            <p className="text-sm text-muted-foreground">New orders will appear here in real-time</p>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className={`p-4 transition-colors ${order.status === 'PENDING' ? 'bg-warning/5' : ''}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{order.orderNumber}</span>
                    <span className={`status-badge ${STATUS_STYLES[order.status]}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {order.customerName} · {order.receivedAt}
                  </p>
                </div>
                <span className="text-sm font-bold font-tabular text-foreground">
                  ${order.total.toFixed(2)}
                </span>
              </div>

              <ul className="space-y-0.5 mb-3">
                {order.items.map((item, ii) => (
                  <li
                    key={`item-${order.id}-${ii}`}
                    className="text-xs text-muted-foreground flex items-center gap-1"
                  >
                    <span className="w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              {order.status === 'PENDING' && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenPrepSelect(openPrepSelect === order.id ? null : order.id)
                      }
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold bg-muted rounded-lg hover:bg-border transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {prepTimeSelects[order.id] || 25} min
                      </div>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {openPrepSelect === order.id && (
                      <div className="absolute bottom-full left-0 mb-1 bg-card border border-border rounded-lg card-shadow-md z-20 overflow-hidden min-w-full">
                        {PREP_TIMES.map((t) => (
                          <button
                            key={`prep-${order.id}-${t}`}
                            type="button"
                            onClick={() => {
                              setPrepTimeSelects((p) => ({ ...p, [order.id]: t }));
                              setOpenPrepSelect(null);
                            }}
                            className={`w-full px-3 py-2 text-xs font-semibold text-left hover:bg-muted transition-colors ${
                              (prepTimeSelects[order.id] || 25) === t
                                ? 'bg-teal-50 text-restaurant'
                                : ''
                            }`}
                          >
                            {t} minutes
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={updatingId === order.id}
                    onClick={() => acceptOrder(order.id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors active:scale-95 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> Accept
                  </button>
                  <button
                    type="button"
                    disabled={updatingId === order.id}
                    onClick={() => rejectOrder(order.id, order.orderNumber)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-danger/10 text-danger rounded-lg hover:bg-danger/20 transition-colors active:scale-95 disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              )}

              {order.status === 'PREPARING' && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-info font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    {order.prepTime} min prep time
                  </div>
                  <button
                    type="button"
                    disabled={updatingId === order.id}
                    onClick={() => markReady(order.id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors active:scale-95 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> Mark Ready
                  </button>
                </div>
              )}

              {order.status === 'READY' && (
                <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Waiting for rider pickup
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ShoppingBagIcon() {
  return (
    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
      <Clock className="w-6 h-6 text-muted-foreground" />
    </div>
  );
}
