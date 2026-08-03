'use client';

import React, { useState } from 'react';
import { RotateCcw, Star, ChevronDown, ChevronUp, Receipt } from 'lucide-react';
import { toast } from 'sonner';

const ORDER_HISTORY = [
  { id: 'ord-FP8901', orderNumber: '#FP-8901', restaurant: 'Burger Bliss', items: 'Smash Burger × 2, Truffle Fries', total: 34.97, status: 'DELIVERED', date: '07/28/2026', rating: 5 },
  { id: 'ord-FP8867', orderNumber: '#FP-8867', restaurant: 'Spice Route', items: 'Chicken Biryani × 1, Mango Lassi × 2', total: 28.50, status: 'DELIVERED', date: '07/26/2026', rating: 4 },
  { id: 'ord-FP8823', orderNumber: '#FP-8823', restaurant: 'Verde Kitchen', items: 'Buddha Bowl × 2, Green Juice × 1', total: 22.80, status: 'DELIVERED', date: '07/24/2026', rating: null },
  { id: 'ord-FP8799', orderNumber: '#FP-8799', restaurant: 'Crispy Seoul', items: 'Yangnyeom Chicken × 1, Kimchi Fried Rice', total: 31.20, status: 'CANCELLED', date: '07/22/2026', rating: null },
  { id: 'ord-FP8751', orderNumber: '#FP-8751', restaurant: 'Sakura Ramen House', items: 'Tonkotsu Ramen × 2, Gyoza × 6', total: 47.60, status: 'DELIVERED', date: '07/20/2026', rating: 5 },
  { id: 'ord-FP8720', orderNumber: '#FP-8720', restaurant: 'The Pasta Lab', items: 'Truffle Tagliatelle × 1, Tiramisu × 2', total: 39.90, status: 'DELIVERED', date: '07/18/2026', rating: 4 },
  { id: 'ord-FP8693', orderNumber: '#FP-8693', restaurant: 'Taco Loco', items: 'Street Tacos × 6, Churros × 2', total: 26.40, status: 'DELIVERED', date: '07/15/2026', rating: null },
  { id: 'ord-FP8651', orderNumber: '#FP-8651', restaurant: 'Mezze & Co.', items: 'Mezze Platter × 1, Shawarma × 2', total: 52.80, status: 'DELIVERED', date: '07/12/2026', rating: 5 },
];

const STATUS_STYLES: Record<string, string> = {
  DELIVERED: 'bg-success/10 text-success',
  CANCELLED: 'bg-danger/10 text-danger',
  PREPARING: 'bg-warning/10 text-warning',
};

export default function OrderHistory() {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? ORDER_HISTORY : ORDER_HISTORY.slice(0, 5);

  const handleReorder = (orderId: string, restaurant: string) => {
    // BACKEND INTEGRATION: POST /api/orders/reorder with { orderId }
    toast.success(`Reordering from ${restaurant}!`);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">Order History</h2>
        <span className="text-sm text-muted-foreground">{ORDER_HISTORY.length} orders</span>
      </div>

      {/* Mobile card list */}
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
        <div className="flex justify-center pt-1">
          <button
            onClick={() => setShowAll(p => !p)}
            className="flex items-center gap-2 text-sm font-semibold text-customer hover:underline"
          >
            {showAll ? <><ChevronUp className="w-4 h-4" /> Show less</> : <><ChevronDown className="w-4 h-4" /> Show all {ORDER_HISTORY.length} orders</>}
          </button>
        </div>
      </div>

      {/* Desktop table */}
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
        <div className="px-4 py-3 border-t border-border flex justify-center">
          <button
            onClick={() => setShowAll(p => !p)}
            className="flex items-center gap-2 text-sm font-semibold text-customer hover:underline"
          >
            {showAll ? <><ChevronUp className="w-4 h-4" /> Show less</> : <><ChevronDown className="w-4 h-4" /> Show all {ORDER_HISTORY.length} orders</>}
          </button>
        </div>
      </div>
    </section>
  );
}