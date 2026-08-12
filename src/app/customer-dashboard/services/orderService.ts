import type { CartItem, DeliveryAddressInfo, OrderTotals } from '../types';

export type PlaceOrderPayload = {
  items: CartItem[];
  totals: OrderTotals;
  deliveryAddress: DeliveryAddressInfo;
  paymentMethod: string;
  restaurantName?: string;
};

export type PlaceOrderResponse = {
  success: boolean;
  orderId: string;
  orderNumber: string;
  estimatedDeliveryMinutes: number;
  message: string;
};

export async function placeOrder(payload: PlaceOrderPayload): Promise<PlaceOrderResponse> {
  const customerId = localStorage.getItem('fooddash_session_id') || '';
  const body = { ...payload, customerId };

  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.message || 'Failed to place order. Please try again.');
  }

  return res.json() as Promise<PlaceOrderResponse>;
}
