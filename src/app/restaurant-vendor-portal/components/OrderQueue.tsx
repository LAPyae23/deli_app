'use client';

import React, { useState } from 'react';
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

const INITIAL_ORDERS: IncomingOrder[] = [
  { id: 'ord-q-001', orderNumber: '#FP-8943', customerName: 'Maya Chen', items: ['Smash Burger × 2', 'Truffle Fries × 1', 'Coke Zero × 2'], total: 40.44, status: 'PENDING', receivedAt: '16:11' },
  { id: 'ord-q-002', orderNumber: '#FP-8944', customerName: 'David Okonkwo', items: ['BBQ Bacon Burger × 1', 'Onion Rings × 2'], total: 24.97, status: 'PENDING', receivedAt: '16:12' },
  { id: 'ord-q-003', orderNumber: '#FP-8939', customerName: 'Priya Sharma', items: ['Veggie Burger × 2', 'Sweet Potato Fries × 1'], total: 31.47, status: 'PREPARING', receivedAt: '15:58', prepTime: 25 },
  { id: 'ord-q-004', orderNumber: '#FP-8935', customerName: 'Tom Fitzgerald', items: ['Double Smash × 1', 'Loaded Fries × 1', 'Milkshake × 1'], total: 38.96, status: 'PREPARING', receivedAt: '15:44', prepTime: 30 },
  { id: 'ord-q-005', orderNumber: '#FP-8928', customerName: 'Aisha Mensah', items: ['Chicken Burger × 2', 'Coleslaw × 2'], total: 33.98, status: 'READY', receivedAt: '15:30', prepTime: 20 },
];

const PREP_TIMES = [15, 20, 25, 30, 45];

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-warning/10 text-warning',
  PREPARING: 'bg-info/10 text-info',
  READY: 'bg-success/10 text-success',
};

export default function OrderQueue() {
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [prepTimeSelects, setPrepTimeSelects] = useState<Record<string, number>>({});
  const [openPrepSelect, setOpenPrepSelect] = useState<string | null>(null);

  const acceptOrder = (orderId: string) => {
    const prepTime = prepTimeSelects[orderId] || 25;
    // BACKEND INTEGRATION: Socket.io emit 'restaurant:accept_order'
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'PREPARING', prepTime } : o));
    toast.success(`Order accepted — ${prepTime} min prep time set`);
    setOpenPrepSelect(null);
  };

  const rejectOrder = (orderId: string, orderNumber: string) => {
    // BACKEND INTEGRATION: Socket.io emit order rejection
    setOrders(prev => prev.filter(o => o.id !== orderId));
    toast.error(`Order ${orderNumber} rejected`);
  };

  const markReady = (orderId: string) => {
    // BACKEND INTEGRATION: Socket.io emit 'restaurant:order_ready'
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'READY' } : o));
    toast.success('Order marked ready for pickup');
  };

  const pendingCount = orders.filter(o => o.status === 'PENDING').length;

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
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingBagIcon />
            <p className="font-semibold text-foreground mt-3">No active orders</p>
            <p className="text-sm text-muted-foreground">New orders will appear here in real-time</p>
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
                            onClick={() => { setPrepTimeSelects(p => ({ ...p, [order.id]: t })); setOpenPrepSelect(null); }}
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