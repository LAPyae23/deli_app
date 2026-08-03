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
  orderNumber: string;
  estimatedDeliveryMinutes: number;
  message: string;
};

export async function placeOrder(payload: PlaceOrderPayload): Promise<PlaceOrderResponse> {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.message || 'Failed to place order. Please try again.');
  }

  return res.json() as Promise<PlaceOrderResponse>;
}
