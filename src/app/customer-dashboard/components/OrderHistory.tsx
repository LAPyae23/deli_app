'use client';

import React, { useEffect, useState } from 'react';
import { RotateCcw, Star, ChevronDown, ChevronUp, Receipt } from 'lucide-react';
import { toast } from 'sonner';

type OrderItem = {
  name?: string;
  quantity?: number;
};

type DbOrder = {
  _id: string;
  orderNumber: string;
  restaurantName?: string;
  items?: OrderItem[];
  totals?: { total?: number };
  status?: string;
  createdAt?: string;
  rating?: number | null;
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-warning/10 text-warning',
  PLACED: 'bg-info/10 text-info',
  PREPARING: 'bg-warning/10 text-warning',
  READY: 'bg-success/10 text-success',
  REJECTED: 'bg-danger/10 text-danger',
  CANCELLED: 'bg-danger/10 text-danger',
  OUT_FOR_DELIVERY: 'bg-customer/10 text-customer',
  DELIVERED: 'bg-success/10 text-success',
};

function formatItems(items?: OrderItem[]) {
  if (!items?.length) return 'No items';
  return items
    .map((item) => `${item.quantity ?? 1}x ${item.name || 'Item'}`)
    .join(', ');
}

function formatDate(createdAt?: string) {
  if (!createdAt) return '—';
  try {
    return new Date(createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatStatus(status?: string) {
  if (!status) return 'Unknown';
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchOrders() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to load orders');
        }
        if (!cancelled) {
          setOrders(Array.isArray(data.orders) ? data.orders : []);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setOrders([]);
          toast.error('Failed to load order history');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchOrders();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayed = showAll ? orders : orders.slice(0, 5);

  const handleReorder = (orderId: string, restaurant: string) => {
    toast.success(`Reordering from ${restaurant}!`);
  };

  if (isLoading) {
    return (
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Order History</h2>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card py-16 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-customer border-t-transparent" />
          <p className="text-sm font-medium">Loading orders...</p>
        </div>
      </section>
    );
  }

  if (orders.length === 0) {
    return (
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Order History</h2>
          <span className="text-sm text-muted-foreground">0 orders</span>
        </div>
        <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-bold text-foreground">No orders yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Place an order from Discover and it will show up here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Order History</h2>
        <span className="text-sm text-muted-foreground">{orders.length} orders</span>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 sm:hidden">
        {displayed.map((order) => {
          const status = order.status || 'PLACED';
          const total = Number(order.totals?.total) || 0;
          const restaurant = order.restaurantName || 'Restaurant';
          const itemsLabel = formatItems(order.items);
          const date = formatDate(order.createdAt);

          return (
            <div key={order._id} className="rounded-xl border border-border bg-card p-4 card-shadow">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground font-tabular">{order.orderNumber}</p>
                  <p className="text-sm font-medium text-foreground">{restaurant}</p>
                </div>
                <span className={`status-badge flex-shrink-0 ${STATUS_STYLES[status] || 'bg-muted text-muted-foreground'}`}>
                  {formatStatus(status)}
                </span>
              </div>
              <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{itemsLabel}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-foreground font-tabular">${total.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">{date}</span>
                </div>
                <div className="flex items-center gap-2">
                  {status === 'DELIVERED' && (
                    <button
                      type="button"
                      onClick={() => handleReorder(order._id, restaurant)}
                      className="flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-customer transition-colors hover:bg-orange-100 active:scale-95"
                    >
                      <RotateCcw className="h-3 w-3" /> Reorder
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {orders.length > 5 && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setShowAll((p) => !p)}
              className="flex items-center gap-2 text-sm font-semibold text-customer hover:underline"
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-4 w-4" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" /> Show all {orders.length} orders
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card card-shadow sm:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {['Order', 'Restaurant', 'Items', 'Total', 'Status', 'Date', 'Rating', 'Actions'].map((h) => (
                  <th key={`th-${h}`} className="section-label whitespace-nowrap px-4 py-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayed.map((order) => {
                const status = order.status || 'PLACED';
                const total = Number(order.totals?.total) || 0;
                const restaurant = order.restaurantName || 'Restaurant';
                const itemsLabel = formatItems(order.items);
                const date = formatDate(order.createdAt);
                const rating = order.rating ?? null;

                return (
                  <tr key={order._id} className="group transition-colors hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm font-semibold text-foreground font-tabular">
                      {order.orderNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm font-medium text-foreground">
                      {restaurant}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3.5 text-sm text-muted-foreground">
                      {itemsLabel}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm font-semibold text-foreground font-tabular">
                      ${total.toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <span className={`status-badge ${STATUS_STYLES[status] || 'bg-muted text-muted-foreground'}`}>
                        {formatStatus(status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm text-muted-foreground">{date}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      {rating ? (
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, si) => (
                            <Star
                              key={`star-${order._id}-${si}`}
                              className={`h-3.5 w-3.5 ${
                                si < rating ? 'fill-warning text-warning' : 'fill-border text-border'
                              }`}
                            />
                          ))}
                        </div>
                      ) : status === 'DELIVERED' ? (
                        <button type="button" className="text-xs font-semibold text-customer hover:underline">
                          Rate order
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        {status === 'DELIVERED' && (
                          <button
                            type="button"
                            onClick={() => handleReorder(order._id, restaurant)}
                            className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-customer transition-colors hover:bg-orange-100 active:scale-95"
                          >
                            <RotateCcw className="h-3 w-3" /> Reorder
                          </button>
                        )}
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {orders.length > 5 && (
          <div className="flex justify-center border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={() => setShowAll((p) => !p)}
              className="flex items-center gap-2 text-sm font-semibold text-customer hover:underline"
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-4 w-4" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" /> Show all {orders.length} orders
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
