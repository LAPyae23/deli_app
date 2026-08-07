'use client';

import React, { useEffect, useState } from 'react';
import { Clock, Check, X, ChevronDown, AlertCircle, Bell } from 'lucide-react';
import { toast } from 'sonner';

type OrderStatus = 'PENDING' | 'PREPARING' | 'READY';

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

const PREP_TIMES = [15, 20, 25, 30, 45];

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-warning/10 text-warning',
  PREPARING: 'bg-info/10 text-info',
  READY: 'bg-success/10 text-success',
};

function toVendorStatus(status: string): OrderStatus | null {
  if (status === 'PLACED' || status === 'PENDING') return 'PENDING';
  if (status === 'PREPARING') return 'PREPARING';
  if (status === 'READY' || status === 'OUT_FOR_DELIVERY') return 'READY';
  return null;
}

export default function OrderQueue() {
  const [orders, setOrders] = useState<IncomingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [prepTimeSelects, setPrepTimeSelects] = useState<Record<string, number>>({});
  const [openPrepSelect, setOpenPrepSelect] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load orders');
      }

      const mapped: IncomingOrder[] = (data.orders || [])
        .map((order: {
          id: string;
          orderNumber: string;
          customerName: string;
          itemsList: string[];
          total: number;
          status: string;
          vendorStatus: string;
          receivedAt: string;
          prepTime?: number;
        }) => {
          const status = toVendorStatus(order.vendorStatus || order.status);
          if (!status) return null;
          return {
            id: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            items: order.itemsList || [],
            total: order.total,
            status,
            receivedAt: order.receivedAt,
            prepTime: order.prepTime,
          };
        })
        .filter(Boolean) as IncomingOrder[];

      setOrders(mapped);
    } catch {
      toast.error('Could not load orders from MongoDB');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const updateOrderStatus = async (orderId: string, status: string, prepTime?: number) => {
    const res = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, status, prepTime }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to update order');
    }
  };

  const acceptOrder = async (orderId: string) => {
    const prepTime = prepTimeSelects[orderId] || 25;
    try {
      await updateOrderStatus(orderId, 'PREPARING', prepTime);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'PREPARING', prepTime } : o))
      );
      toast.success(`Order accepted — ${prepTime} min prep time set`);
      setOpenPrepSelect(null);
    } catch {
      toast.error('Could not accept order');
    }
  };

  const rejectOrder = async (orderId: string, orderNumber: string) => {
    try {
      await updateOrderStatus(orderId, 'CANCELLED');
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.error(`Order ${orderNumber} rejected`);
    } catch {
      toast.error('Could not reject order');
    }
  };

  const markReady = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, 'READY');
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'READY' } : o))
      );
      toast.success('Order marked ready for pickup');
    } catch {
      toast.error('Could not update order');
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
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">Loading orders from MongoDB...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingBagIcon />
            <p className="font-semibold text-foreground mt-3">No active orders</p>
            <p className="text-sm text-muted-foreground">New orders will appear here from MongoDB</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className={`p-4 transition-colors ${order.status === 'PENDING' ? 'bg-warning/5' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{order.orderNumber}</span>
                    <span className={`status-badge ${STATUS_STYLES[order.status]}`}>{order.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{order.customerName} · {order.receivedAt}</p>
                </div>
                <span className="text-sm font-bold font-tabular text-foreground">${order.total.toFixed(2)}</span>
              </div>

              <ul className="space-y-0.5 mb-3">
                {order.items.map((item, ii) => (
                  <li key={`item-${order.id}-${ii}`} className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              {order.status === 'PENDING' && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <button
                      onClick={() => setOpenPrepSelect(openPrepSelect === order.id ? null : order.id)}
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
                            onClick={() => { setPrepTimeSelects((p) => ({ ...p, [order.id]: t })); setOpenPrepSelect(null); }}
                            className={`w-full px-3 py-2 text-xs font-semibold text-left hover:bg-muted transition-colors ${(prepTimeSelects[order.id] || 25) === t ? 'bg-teal-50 text-restaurant' : ''}`}
                          >
                            {t} minutes
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => acceptOrder(order.id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" /> Accept
                  </button>
                  <button
                    onClick={() => rejectOrder(order.id, order.orderNumber)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-danger/10 text-danger rounded-lg hover:bg-danger/20 transition-colors active:scale-95"
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
                    onClick={() => markReady(order.id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors active:scale-95"
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
