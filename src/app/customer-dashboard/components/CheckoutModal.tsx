'use client';

import React, { useState } from 'react';
import { X, CreditCard, Wallet, Banknote, ChevronRight, ShieldCheck, MapPin, Clock } from 'lucide-react';
import { formatMMK } from '@/lib/currency';
import OrderReceiptModal from './OrderReceiptModal';
import AddressPickerModal, { type PickedAddress } from './AddressPickerModal';
import type { CartItem, DeliveryAddressInfo } from '../types';

export type { DeliveryAddressInfo };

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  discount: number;
  tax: number;
  total: number;
  promoApplied: boolean;
  clearCart: () => void;
  deliveryAddress: DeliveryAddressInfo;
  onDeliveryAddressChange: (address: DeliveryAddressInfo) => void;
  savedAddresses?: DeliveryAddressInfo[];
}

const PAYMENT_METHODS = [
  { id: 'card', label: 'Credit / Debit Card', sub: 'Visa •••• 4242', icon: CreditCard },
  { id: 'wallet', label: 'FoodDash Wallet', sub: `Balance: ${formatMMK(24.5)}`, icon: Wallet },
  { id: 'cash', label: 'Cash on Delivery', sub: 'Pay when delivered', icon: Banknote },
];

export default function CheckoutModal({
  isOpen,
  onClose,
  items,
  subtotal,
  deliveryFee,
  platformFee,
  discount,
  tax,
  total,
  promoApplied,
  clearCart,
  deliveryAddress,
  onDeliveryAddressChange,
  savedAddresses = [],
}: CheckoutModalProps) {
  const [selectedPayment, setSelectedPayment] = useState('card');
  const [isPlacing, setIsPlacing] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [receiptItems, setReceiptItems] = useState<CartItem[]>([]);
  const [receiptTotals, setReceiptTotals] = useState({
    subtotal: 0,
    deliveryFee: 0,
    platformFee: 0,
    tax: 0,
    total: 0,
  });
  const [receiptAddress, setReceiptAddress] = useState(deliveryAddress);
  const [receiptPayment, setReceiptPayment] = useState<'cash' | 'bank'>('cash');

  if (!isOpen && !receiptOpen) return null;

  const handlePlaceOrder = async () => {
    setIsPlacing(true);
    await new Promise((r) => setTimeout(r, 1800));
    setReceiptItems([...items]);
    setReceiptTotals({ subtotal, deliveryFee, platformFee, tax, total });
    setReceiptAddress({ ...deliveryAddress });
    setReceiptPayment(selectedPayment === 'cash' ? 'cash' : 'bank');
    setIsPlacing(false);
    onClose();
    setReceiptOpen(true);
  };

  const handleConfirmPayment = async (): Promise<string | null> => {
    clearCart();
    setReceiptOpen(false);
    return `#FP-${Math.floor(1000 + Math.random() * 9000)}`;
  };

  const handleAddressConfirm = (picked: PickedAddress) => {
    onDeliveryAddressChange({
      label: picked.label,
      address: picked.address,
      detail: `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}`,
      lat: picked.lat,
      lng: picked.lng,
    });
  };

  const feeRows = [
    { label: 'Subtotal', value: subtotal, color: '' },
    { label: 'Delivery fee', value: deliveryFee, color: '' },
    { label: 'Platform fee', value: platformFee, color: '' },
    ...(discount > 0 ? [{ label: 'Promo (DASH10)', value: -discount, color: 'text-emerald-600' }] : []),
    { label: 'Tax (8%)', value: tax, color: '' },
  ];

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <div className="relative w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-foreground">Checkout</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Review your order before placing</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="px-6 py-4 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Delivery Details</p>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
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
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-lg">
                    <Clock className="w-3.5 h-3.5" />
                    <span>25–35 min</span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Order Summary · {items.reduce((s, i) => s + i.quantity, 0)} items
                </p>
                <div className="space-y-2.5">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-orange-50 text-customer text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {item.quantity}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground leading-tight">{item.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.options}</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold font-tabular text-foreground flex-shrink-0">
                        {formatMMK(item.unitPrice * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-6 py-4 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Price Breakdown</p>
                <div className="space-y-2">
                  {feeRows.map((row) => (
                    <div key={`checkout-fee-${row.label}`} className="flex justify-between items-center">
                      <span className={`text-sm text-muted-foreground ${row.color}`}>{row.label}</span>
                      <span className={`text-sm font-semibold font-tabular ${row.color || 'text-foreground'}`}>
                        {row.value < 0
                          ? `-${formatMMK(Math.abs(row.value))}`
                          : formatMMK(row.value)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                  <span className="text-base font-bold text-foreground">Total</span>
                  <span className="text-base font-bold font-tabular text-foreground">{formatMMK(total)}</span>
                </div>
              </div>

              <div className="px-6 py-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Payment Method</p>
                <div className="space-y-2.5">
                  {PAYMENT_METHODS.map((method) => {
                    const isSelected = selectedPayment === method.id;
                    return (
                      <button
                        key={method.id}
                        onClick={() => setSelectedPayment(method.id)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-150 text-left ${
                          isSelected
                            ? 'border-customer bg-orange-50/60' :'border-border bg-muted/30 hover:border-border/80'
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
                          <p className={`text-sm font-semibold leading-tight ${isSelected ? 'text-customer' : 'text-foreground'}`}>
                            {method.label}
                          </p>
                          <p className="text-xs text-muted-foreground">{method.sub}</p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${
                            isSelected ? 'border-customer bg-customer' : 'border-border'
                          }`}
                        >
                          {isSelected && (
                            <div className="w-full h-full rounded-full flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border bg-card flex-shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Secured & encrypted payment</span>
              </div>
              <button
                onClick={handlePlaceOrder}
                disabled={isPlacing}
                className="btn-primary w-full py-3.5 justify-between disabled:opacity-70"
              >
                {isPlacing ? (
                  <span className="flex items-center gap-2 justify-center w-full">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Placing your order…
                  </span>
                ) : (
                  <>
                    <span>Place Order</span>
                    <span className="flex items-center gap-1 font-tabular">
                      {formatMMK(total)} <ChevronRight className="w-4 h-4" />
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <OrderReceiptModal
        isOpen={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        items={receiptItems}
        subtotal={receiptTotals.subtotal}
        deliveryFee={receiptTotals.deliveryFee}
        platformFee={receiptTotals.platformFee}
        tax={receiptTotals.tax}
        total={receiptTotals.total}
        deliveryAddress={receiptAddress}
        paymentMethod={receiptPayment}
        onPaymentMethodChange={setReceiptPayment}
        isPlacing={false}
        onConfirmPayment={handleConfirmPayment}
      />

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
