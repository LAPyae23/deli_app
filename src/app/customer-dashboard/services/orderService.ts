import type { CartItem, DeliveryAddressInfo, OrderTotals } from '../types';

export type PlaceOrderPayload = {
  items: CartItem[];
  totals: OrderTotals;
  deliveryAddress: DeliveryAddressInfo;
  paymentMethod: string;
  restaurantName?: string;
  restaurantId?: string;
  tipAmount?: number;
  discount?: number;
  promoCodeUsed?: string;
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
  const body = {
    ...payload,
    customerId,
    restaurantId: payload.restaurantId || '',
    discount: payload.discount ?? payload.totals?.discount ?? 0,
    promoCodeUsed: payload.promoCodeUsed || payload.totals?.promoCodeUsed || '',
    promoApplied: Boolean(payload.totals?.promoApplied),
  };

  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.message || 'Failed to place order. Please try again.');
  }

  const result = (await res.json()) as PlaceOrderResponse;

  if (payload.totals.promoApplied) {
    try {
      await fetch('/api/customer/consume-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
    } catch (error) {
      console.warn('Failed to consume promo after order', error);
    }
  }

  return result;
}
