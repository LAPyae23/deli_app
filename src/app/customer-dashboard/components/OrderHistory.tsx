'use client';

import React, { useEffect, useState } from 'react';
import { RotateCcw, Star, ChevronDown, ChevronUp, Receipt } from 'lucide-react';
import { toast } from 'sonner';

type HistoryOrder = {
  id: string;
  orderNumber: string;
  restaurant: string;
  items: string;
  total: number;
  status: string;
  date: string;
  rating: number | null;
};

const STATUS_STYLES: Record<string, string> = {
  DELIVERED: 'bg-success/10 text-success',
  CANCELLED: 'bg-danger/10 text-danger',
  PREPARING: 'bg-warning/10 text-warning',
  PLACED: 'bg-info/10 text-info',
  READY: 'bg-success/10 text-success',
};

export default function OrderHistory() {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to load orders');
        }
        if (cancelled) return;
        const mapped: HistoryOrder[] = (data.orders || []).map(
          (order: {
            id: string;
            orderNumber: string;
            restaurant: string;
            itemsSummary: string;
            total: number;
            status: string;
            date: string;
            rating: number | null;
          }) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            restaurant: order.restaurant,
            items: order.itemsSummary,
            total: order.total,
            status: order.status,
            date: order.date,
            rating: order.rating,
          })
        );
        setOrders(mapped);
      } catch {
        if (!cancelled) {
          toast.error('Could not load orders from MongoDB');
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrders();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayed = showAll ? orders : orders.slice(0, 5);

  const handleReorder = (orderId: string, restaurant: string) => {
    toast.success(`Reordering from ${restaurant}!`);
  };

  if (loading) {
    return (
      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">Order History</h2>
        <p className="text-sm text-muted-foreground">Loading orders from MongoDB...</p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">Order History</h2>
        <span className="text-sm text-muted-foreground">{orders.length} orders</span>
      </div>

      {orders.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center card-shadow">
          <p className="font-semibold text-foreground">No orders yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Place an order and it will appear here from MongoDB.
          </p>
        </div>
      ) : (
        <>
          <div className="sm:hidden space-y-3">
            {displayed.map((order) => (
              <div key={order.id} className="bg-card border border-border rounded-xl p-4 card-shadow">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground font-tabular">{order.orderNumber}</p>
                    <p className="text-sm font-medium text-foreground">{order.restaurant}</p>
                  </div>
                  <span className={`status-badge flex-shrink-0 ${STATUS_STYLES[order.status] || 'bg-muted text-muted-foreground'}`}>
                    {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{order.items}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold font-tabular text-foreground">${order.total.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">{order.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.rating ? (
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, si) => (
                          <Star key={`star-${order.id}-${si}`} className={`w-3 h-3 ${si < order.rating! ? 'text-warning fill-warning' : 'text-border fill-border'}`} />
                        ))}
                      </div>
                    ) : (
                      order.status === 'DELIVERED' ? (
                        <button className="text-xs text-customer font-semibold hover:underline">Rate</button>
                      ) : null
                    )}
                    {order.status === 'DELIVERED' && (
                      <button
                        onClick={() => handleReorder(order.id, order.restaurant)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-orange-50 text-customer rounded-lg hover:bg-orange-100 transition-colors active:scale-95"
                      >
                        <RotateCcw className="w-3 h-3" /> Reorder
                      </button>
                    )}
                    <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <Receipt className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {orders.length > 5 && (
              <div className="flex justify-center pt-1">
                <button
                  onClick={() => setShowAll((p) => !p)}
                  className="flex items-center gap-2 text-sm font-semibold text-customer hover:underline"
                >
                  {showAll ? <><ChevronUp className="w-4 h-4" /> Show less</> : <><ChevronDown className="w-4 h-4" /> Show all {orders.length} orders</>}
                </button>
              </div>
            )}
          </div>

          <div className="hidden sm:block bg-card border border-border rounded-xl overflow-hidden card-shadow">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {['Order', 'Restaurant', 'Items', 'Total', 'Status', 'Date', 'Rating', 'Actions'].map((h) => (
                      <th key={`th-${h}`} className="px-4 py-3 text-left section-label whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayed.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/40 transition-colors group">
                      <td className="px-4 py-3.5 text-sm font-semibold text-foreground font-tabular whitespace-nowrap">{order.orderNumber}</td>
                      <td className="px-4 py-3.5 text-sm font-medium text-foreground whitespace-nowrap">{order.restaurant}</td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground max-w-[200px] truncate">{order.items}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-foreground font-tabular whitespace-nowrap">${order.total.toFixed(2)}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`status-badge ${STATUS_STYLES[order.status] || 'bg-muted text-muted-foreground'}`}>
                          {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{order.date}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {order.rating ? (
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, si) => (
                              <Star key={`star-${order.id}-${si}`} className={`w-3.5 h-3.5 ${si < order.rating! ? 'text-warning fill-warning' : 'text-border fill-border'}`} />
                            ))}
                          </div>
                        ) : (
                          order.status === 'DELIVERED' ? (
                            <button className="text-xs text-customer font-semibold hover:underline">Rate order</button>
                          ) : <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {order.status === 'DELIVERED' && (
                            <button
                              onClick={() => handleReorder(order.id, order.restaurant)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-orange-50 text-customer rounded-lg hover:bg-orange-100 transition-colors active:scale-95"
                            >
                              <RotateCcw className="w-3 h-3" /> Reorder
                            </button>
                          )}
                          <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {orders.length > 5 && (
              <div className="px-4 py-3 border-t border-border flex justify-center">
                <button
                  onClick={() => setShowAll((p) => !p)}
                  className="flex items-center gap-2 text-sm font-semibold text-customer hover:underline"
                >
                  {showAll ? <><ChevronUp className="w-4 h-4" /> Show less</> : <><ChevronDown className="w-4 h-4" /> Show all {orders.length} orders</>}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
