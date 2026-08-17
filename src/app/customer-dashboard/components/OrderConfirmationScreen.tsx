'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  MapPin,
  CreditCard,
  Wallet,
  Banknote,
  ShieldCheck,
  Receipt,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import AddressPickerModal, { type PickedAddress } from './AddressPickerModal';
import { placeOrder } from '../services/orderService';
import { formatKyat } from '@/lib/currency';
import type { CartItem, DeliveryAddressInfo, OrderTotals } from '../types';

const PAYMENT_METHODS = [
  { id: 'card', label: 'Credit / Debit Card', sub: 'Visa •••• 4242', icon: CreditCard },
  { id: 'wallet', label: 'FoodDash Wallet', sub: `Balance: ${formatKyat(24.5)}`, icon: Wallet },
  { id: 'cash', label: 'Cash on Delivery', sub: 'Pay when delivered', icon: Banknote },
];

interface OrderConfirmationScreenProps {
  items: CartItem[];
  totals: OrderTotals;
  deliveryAddress: DeliveryAddressInfo;
  onDeliveryAddressChange: (address: DeliveryAddressInfo) => void;
  savedAddresses?: DeliveryAddressInfo[];
  restaurantName?: string;
  onBack: () => void;
  onOrderSuccess: (orderId: string) => void;
}

export default function OrderConfirmationScreen({
  items,
  totals,
  deliveryAddress,
  onDeliveryAddressChange,
  savedAddresses = [],
  restaurantName,
  onBack,
  onOrderSuccess,
}: OrderConfirmationScreenProps) {
  const [selectedPayment, setSelectedPayment] = useState('card');
  const [isPlacing, setIsPlacing] = useState(false);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  const handleAddressConfirm = (picked: PickedAddress) => {
    onDeliveryAddressChange({
      label: picked.label,
      address: picked.address,
      detail: 'Yangon, Myanmar',
      lat: picked.lat,
      lng: picked.lng,
    });
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setIsPlacing(true);
    try {
      const result = await placeOrder({
        items,
        totals,
        deliveryAddress,
        paymentMethod: selectedPayment,
        restaurantName,
        restaurantId: items.find((i) => i.restaurantId)?.restaurantId,
        tipAmount: Number(totals.tipAmount) || 0,
      });

      toast.success(`${result.orderNumber} placed — ETA ~${result.estimatedDeliveryMinutes} min`);
      onOrderSuccess(result.orderId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setIsPlacing(false);
    }
  };

  const feeRows = [
    { label: 'Subtotal', value: totals.subtotal },
    { label: 'Delivery fee', value: totals.deliveryFee },
    { label: 'Platform fee', value: totals.platformFee },
    ...(totals.discount > 0 ? [{ label: 'Discount (DASH10)', value: -totals.discount }] : []),
    { label: 'Tax (8%)', value: totals.tax },
  ];

  return (
    <>
      <section className="max-w-2xl mx-auto w-full animate-fade-in">
        <div className="flex items-center gap-3 mb-5">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Back to cart"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Confirm Order</h1>
            <p className="text-sm text-muted-foreground">Review your invoice before placing</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden card-shadow-md">
          {/* Invoice header */}
          <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-customer" />
              <div>
                <p className="font-bold text-foreground">Order Invoice</p>
                {restaurantName && (
                  <p className="text-xs text-muted-foreground">{restaurantName}</p>
                )}
              </div>
            </div>
            <span className="text-xs font-semibold bg-orange-50 text-customer px-2.5 py-1 rounded-full">
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </span>
          </div>

          {/* Delivery */}
          <div className="px-5 sm:px-6 py-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Delivery Address
            </p>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-customer" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{deliveryAddress.label}</p>
                <p className="text-xs text-muted-foreground">{deliveryAddress.address}</p>
                {savedAddresses.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {savedAddresses.map((a) => {
                      const isActive =
                        a.lat === deliveryAddress.lat &&
                        a.lng === deliveryAddress.lng &&
                        a.label === deliveryAddress.label;
                      return (
                        <button
                          key={`${a.label}-${a.lat}-${a.lng}`}
                          type="button"
                          onClick={() => onDeliveryAddressChange(a)}
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                            isActive
                              ? 'border-customer bg-orange-50 text-customer'
                              : 'border-border bg-card text-muted-foreground hover:border-customer/40'
                          }`}
                        >
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setAddressPickerOpen(true)}
                  className="text-xs font-semibold text-customer mt-1.5 hover:underline"
                >
                  Change on map
                </button>
              </div>
            </div>
          </div>

          {/* Itemized list */}
          <div className="px-5 sm:px-6 py-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Items
            </p>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-orange-50 text-customer text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {item.quantity}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight">{item.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.options}</p>
                      <p className="text-xs text-muted-foreground font-tabular mt-0.5">
                        {formatKyat(item.unitPrice)} each
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold font-tabular text-foreground flex-shrink-0">
                    {formatKyat(item.unitPrice * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="px-5 sm:px-6 py-4 border-b border-border space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Price Breakdown
            </p>
            {feeRows.map((row) => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className={row.value < 0 ? 'text-success' : 'text-muted-foreground'}>
                  {row.label}
                </span>
                <span
                  className={`font-semibold font-tabular ${
                    row.value < 0 ? 'text-success' : 'text-foreground'
                  }`}
                >
                  {row.value < 0
                    ? `-${formatKyat(Math.abs(row.value))}`
                    : formatKyat(row.value)}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <span className="text-base font-bold text-foreground">Grand Total</span>
              <span className="text-xl font-bold font-tabular text-customer">
                {formatKyat(totals.total)}
              </span>
            </div>
          </div>

          {/* Payment */}
          <div className="px-5 sm:px-6 py-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Payment Method
            </p>
            <div className="space-y-2.5">
              {PAYMENT_METHODS.map((method) => {
                const isSelected = selectedPayment === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedPayment(method.id)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-150 text-left ${
                      isSelected
                        ? 'border-customer bg-orange-50/60'
                        : 'border-border bg-muted/30 hover:border-border/80'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-customer text-white' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <method.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold leading-tight ${
                          isSelected ? 'text-customer' : 'text-foreground'
                        }`}
                      >
                        {method.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{method.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="px-5 sm:px-6 py-4 border-t border-border bg-muted/20">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Secured checkout · Yangon delivery</span>
            </div>
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={isPlacing || items.length === 0}
              className="btn-primary w-full py-3.5 justify-between disabled:opacity-70"
            >
              {isPlacing ? (
                <span className="flex items-center gap-2 justify-center w-full">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Placing your order…
                </span>
              ) : (
                <>
                  <span>Place Order</span>
                  <span className="flex items-center gap-1 font-tabular">
                    {formatKyat(totals.total)} <ChevronRight className="w-4 h-4" />
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      <AddressPickerModal
        isOpen={addressPickerOpen}
        onClose={() => setAddressPickerOpen(false)}
        onConfirm={handleAddressConfirm}
        initialPosition={
          deliveryAddress.lat && deliveryAddress.lng
            ? { lat: deliveryAddress.lat, lng: deliveryAddress.lng }
            : undefined
        }
        initialLabel={deliveryAddress.label}
      />
    </>
  );
}
