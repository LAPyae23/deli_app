'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Check, X, ChevronDown, AlertCircle, Bell, MessageCircle, Bike, User } from 'lucide-react';
import { toast } from 'sonner';
import { formatMMK } from '@/lib/currency';
import ChatWidget from '@/components/ChatWidget';
import { useNotificationSound } from '@/hooks/useNotificationSound';

type OrderStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'REJECTED'
  | 'DELIVERED'
  | 'CANCELLED';

interface IncomingOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerId: string;
  riderId?: string;
  riderName?: string;
  items: string[];
  total: number;
  status: OrderStatus;
  receivedAt: string;
  createdAtMs: number;
  prepTime?: number;
}

const PREP_TIMES = [15, 20, 25, 30, 45];
const POLL_MS = 10_000;
const ACTIVE_STATUSES: OrderStatus[] = ['PENDING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];
const HISTORY_STATUSES: OrderStatus[] = ['DELIVERED', 'REJECTED', 'CANCELLED'];

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-warning/10 text-warning',
  PREPARING: 'bg-info/10 text-info',
  READY: 'bg-success/10 text-success',
  OUT_FOR_DELIVERY: 'bg-rider/10 text-rider',
  REJECTED: 'bg-danger/10 text-danger',
  DELIVERED: 'bg-success/10 text-success',
  CANCELLED: 'bg-danger/10 text-danger',
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
  if (![...ACTIVE_STATUSES, ...HISTORY_STATUSES].includes(status)) {
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
  const createdAtMs = raw.createdAt ? new Date(raw.createdAt as string).getTime() : 0;

  return {
    id,
    orderNumber: String(raw.orderNumber || `#${id.slice(-4)}`),
    customerName: String(raw.customerName || 'Customer'),
    customerId: String(raw.customerId || ''),
    riderId: raw.riderId ? String(raw.riderId) : undefined,
    riderName: raw.riderName ? String(raw.riderName) : undefined,
    items,
    total: Number(totals.total) || 0,
    status,
    receivedAt: formatReceivedAt(raw.createdAt as string | undefined),
    createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : 0,
    prepTime: raw.prepTime != null ? Number(raw.prepTime) : undefined,
  };
}

export default function OrderQueue() {
  const [orders, setOrders] = useState<IncomingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [prepTimeSelects, setPrepTimeSelects] = useState<Record<string, number>>({});
  const [openPrepSelect, setOpenPrepSelect] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [activeChat, setActiveChat] = useState<{
    orderId: string;
    targetId: string;
    targetName: string;
    targetRole: string;
  } | null>(null);
  const playNotification = useNotificationSound();
  const prevPendingCount = useRef(0);
  const pendingCountSeeded = useRef(false);

  useEffect(() => {
    const sessionId = localStorage.getItem('fooddash_session_id') || '';
    const sessionName = localStorage.getItem('fooddash_session_name') || '';
    setRestaurantId(sessionId);
    setRestaurantName(sessionName);

    if (!sessionId) return;

    let cancelled = false;
    async function loadProfileName() {
      try {
        const res = await fetch(
          `/api/restaurant/profile?restaurantId=${encodeURIComponent(sessionId)}`
        );
        const data = await res.json();
        if (!res.ok || !data.success || cancelled) return;
        if (data.profile?.restaurantName) {
          setRestaurantName(data.profile.restaurantName);
          localStorage.setItem('fooddash_session_name', data.profile.restaurantName);
        }
      } catch {
        // keep session name fallback
      }
    }
    loadProfileName();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchOrders = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const sessionId =
        restaurantId || localStorage.getItem('fooddash_session_id') || '';
      const sessionName =
        restaurantName || localStorage.getItem('fooddash_session_name') || '';

      const params = new URLSearchParams();
      if (sessionId) params.set('restaurantId', sessionId);
      else if (sessionName) params.set('restaurantName', sessionName);
      else {
        setOrders([]);
        return;
      }
      params.set(
        'status',
        (viewMode === 'HISTORY' ? HISTORY_STATUSES : ACTIVE_STATUSES).join(',')
      );
      params.set('limit', '100');

      // Also match by restaurant name when both exist (older orders may only have name)
      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to fetch');

      let mapped = (Array.isArray(data.orders) ? data.orders : [])
        .map((raw: Record<string, unknown>) => mapApiOrder(raw))
        .filter(Boolean) as IncomingOrder[];

      // If filtered by id returned few/no results, also pull by name and merge
      if (sessionId && sessionName) {
        const byNameParams = new URLSearchParams(params);
        byNameParams.delete('restaurantId');
        byNameParams.set('restaurantName', sessionName);
        const byNameRes = await fetch(`/api/orders?${byNameParams.toString()}`);
        const byNameData = await byNameRes.json();
        if (byNameRes.ok && byNameData.success) {
          const byName = (Array.isArray(byNameData.orders) ? byNameData.orders : [])
            .map((raw: Record<string, unknown>) => mapApiOrder(raw))
            .filter(Boolean) as IncomingOrder[];
          const seen = new Set(mapped.map((o) => o.id));
          for (const order of byName) {
            if (!seen.has(order.id)) mapped.push(order);
          }
        }
      }

      // Newest pending / active orders first
      mapped.sort((a, b) => b.createdAtMs - a.createdAtMs);

      setOrders(mapped);

      const newPendingCount = mapped.filter((o) => o.status === 'PENDING').length;
      if (pendingCountSeeded.current && newPendingCount > prevPendingCount.current) {
        playNotification();
      }
      pendingCountSeeded.current = true;
      prevPendingCount.current = newPendingCount;
    } catch (error) {
      console.error(error);
      if (showSpinner) toast.error('Failed to load order queue');
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, [restaurantId, restaurantName, viewMode, playNotification]);

  useEffect(() => {
    if (!restaurantId && !restaurantName) {
      setIsLoading(false);
      return;
    }
    fetchOrders(true);
    const interval = setInterval(() => fetchOrders(false), POLL_MS);
    return () => clearInterval(interval);
  }, [fetchOrders, restaurantId, restaurantName]);

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
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'REJECTED' } : o))
      );
      toast.info(`Order ${orderNumber} has been rejected`);
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

  const activeOrders = orders
    .filter((o) => ACTIVE_STATUSES.includes(o.status))
    .sort((a, b) => {
      // Pending newest-first, then other active by createdAt desc
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (b.status === 'PENDING' && a.status !== 'PENDING') return 1;
      return b.createdAtMs - a.createdAtMs;
    });
  const historyOrders = orders
    .filter((o) => HISTORY_STATUSES.includes(o.status))
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  const pendingCount = activeOrders.filter((o) => o.status === 'PENDING').length;
  const displayedOrders = viewMode === 'ACTIVE' ? activeOrders : historyOrders;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden card-shadow h-full flex flex-col">
      <div className="flex-shrink-0 space-y-3 border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-bold text-base">
              {viewMode === 'ACTIVE' ? 'Order Queue' : 'Order History'}
            </h2>
            {viewMode === 'ACTIVE' && pendingCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-warning/10 text-warning text-xs font-bold rounded-full">
                <Bell className="w-3 h-3" />
                {pendingCount} new
              </span>
            )}
          </div>
          <span className="text-sm text-muted-foreground flex-shrink-0">
            {viewMode === 'ACTIVE'
              ? `${activeOrders.length} active`
              : `${historyOrders.length} past`}
          </span>
        </div>

        <div className="flex rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setViewMode('ACTIVE')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'ACTIVE'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Active Orders
          </button>
          <button
            type="button"
            onClick={() => setViewMode('HISTORY')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'HISTORY'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            History
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide divide-y divide-border">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-restaurant border-t-transparent" />
            <p className="text-sm font-medium">Loading orders…</p>
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingBagIcon />
            <p className="font-semibold text-foreground mt-3">
              {viewMode === 'ACTIVE' ? 'No active orders' : 'No order history yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              {viewMode === 'ACTIVE'
                ? 'New orders will appear here in real-time'
                : 'Delivered, rejected, and cancelled orders will show here'}
            </p>
          </div>
        ) : (
          displayedOrders.map((order) => {
            const isActive = ACTIVE_STATUSES.includes(order.status);
            return (
              <div
                key={order.id}
                className={`p-4 transition-colors ${
                  order.status === 'PENDING' ? 'bg-warning/5' : ''
                }`}
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
                    {formatMMK(order.total)}
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

                {isActive && order.status === 'PENDING' && (
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

                {isActive && order.status === 'PREPARING' && (
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

                {isActive && order.status === 'READY' && (
                  <div className="flex items-center gap-1.5 text-xs text-success font-semibold mb-3">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Waiting for rider pickup
                  </div>
                )}

                {isActive && order.status === 'OUT_FOR_DELIVERY' && (
                  <div className="flex items-center gap-1.5 text-xs text-rider font-semibold mb-3">
                    <Bike className="w-3.5 h-3.5" />
                    Out for delivery
                    {order.riderName ? ` · ${order.riderName}` : ''}
                  </div>
                )}

                {isActive && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {order.customerId && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveChat({
                            orderId: order.id,
                            targetId: order.customerId,
                            targetName: order.customerName || 'Customer',
                            targetRole: 'CUSTOMER',
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        <User className="h-3.5 w-3.5" />
                        Message Customer
                      </button>
                    )}
                    {order.riderId && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveChat({
                            orderId: order.id,
                            targetId: order.riderId!,
                            targetName: order.riderName || 'Rider',
                            targetRole: 'RIDER',
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rider/20 bg-rider/10 px-3 py-2 text-xs font-semibold text-rider transition-colors hover:bg-rider/15"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Message Rider
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {activeChat && restaurantId && (
        <ChatWidget
          currentUserId={restaurantId}
          currentUserRole="RESTAURANT"
          targetUserId={activeChat.targetId}
          targetUserRole={activeChat.targetRole}
          targetName={activeChat.targetName}
          orderId={activeChat.orderId}
          open
          onOpenChange={(open) => {
            if (!open) setActiveChat(null);
          }}
        />
      )}
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
