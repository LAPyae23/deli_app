'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Receipt,
  MapPin,
  Banknote,
  Building2,
  Circle,
  CheckCircle2,
  Printer,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatKyat } from '@/lib/currency';
import type { CartItem, DeliveryAddressInfo } from '../types';

export type PaymentMethod = 'cash' | 'bank';

interface OrderReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  tax: number;
  total: number;
  deliveryAddress: DeliveryAddressInfo;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  isPlacing: boolean;
  /** Returns order number on success, null on failure */
  onConfirmPayment: () => Promise<string | null>;
  restaurantName?: string;
  formatMoney?: (amount: number) => string;
  onDoneRedirect?: () => void;
  savedAddresses?: DeliveryAddressInfo[];
  onDeliveryAddressChange?: (address: DeliveryAddressInfo) => void;
  onOpenAddressPicker?: () => void;
}

function defaultMoney(n: number) {
  return formatKyat(n);
}

export default function OrderReceiptModal({
  isOpen,
  onClose,
  items,
  subtotal,
  deliveryFee,
  platformFee,
  tax,
  total,
  deliveryAddress,
  paymentMethod,
  onPaymentMethodChange,
  isPlacing,
  onConfirmPayment,
  restaurantName,
  formatMoney = defaultMoney,
  onDoneRedirect,
  savedAddresses = [],
  onDeliveryAddressChange,
  onOpenAddressPicker,
}: OrderReceiptModalProps) {
  const [step, setStep] = useState<'checkout' | 'slip'>('checkout');
  const [orderNumber, setOrderNumber] = useState('');
  const [slipItems, setSlipItems] = useState<CartItem[]>([]);
  const [slipTotal, setSlipTotal] = useState(0);
  const [slipPayment, setSlipPayment] = useState<PaymentMethod>('cash');
  const [locating, setLocating] = useState(false);
  const [slipMeta, setSlipMeta] = useState({
    subtotal: 0,
    deliveryFee: 0,
    platformFee: 0,
    tax: 0,
    restaurantName: '',
    addressLabel: '',
    addressLine: '',
  });

  useEffect(() => {
    if (isOpen) {
      setStep('checkout');
      setOrderNumber('');
      setLocating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const addressOptions =
    savedAddresses.length > 0
      ? savedAddresses.some((a) => a.label === deliveryAddress.label)
        ? savedAddresses
        : [deliveryAddress, ...savedAddresses]
      : [deliveryAddress];

  const useCurrentLocation = () => {
    if (!onDeliveryAddressChange) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocation is not supported on this device');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        try {
          const res = await fetch(
            'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' +
              lat +
              '&lon=' +
              lng,
            { headers: { Accept: 'application/json' } }
          );
          const data = await res.json();
          const address =
            (data && data.display_name) ||
            `Current location · ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

          onDeliveryAddressChange({
            label: 'CURRENT',
            address,
            detail: 'Detected via GPS',
            lat,
            lng,
          });
          toast.success('Using your current location');
        } catch {
          onDeliveryAddressChange({
            label: 'CURRENT',
            address: `Current location · ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            detail: 'Detected via GPS',
            lat,
            lng,
          });
          toast.success('Location set from GPS coordinates');
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        console.warn(error);
        setLocating(false);
        toast.error('Unable to get current location. Check browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const handleAddressSelect = (value: string) => {
    if (value === 'MAP_PICK') {
      onOpenAddressPicker?.();
      return;
    }
    if (value === 'CURRENT_LOC') {
      useCurrentLocation();
      return;
    }

    const match = addressOptions.find((a) => a.label === value);
    if (match && onDeliveryAddressChange) {
      onDeliveryAddressChange(match);
    }
  };

  const handleConfirm = async () => {
    // Snapshot before parent clears cart
    const snapshot = {
      items: [...items],
      total,
      subtotal,
      deliveryFee,
      platformFee,
      tax,
      payment: paymentMethod,
      restaurantName: restaurantName || '',
      addressLabel: deliveryAddress.label,
      addressLine: deliveryAddress.address,
    };

    const number = await onConfirmPayment();
    if (!number) return;

    setOrderNumber(number);
    setSlipItems(snapshot.items);
    setSlipTotal(snapshot.total);
    setSlipPayment(snapshot.payment);
    setSlipMeta({
      subtotal: snapshot.subtotal,
      deliveryFee: snapshot.deliveryFee,
      platformFee: snapshot.platformFee,
      tax: snapshot.tax,
      restaurantName: snapshot.restaurantName,
      addressLabel: snapshot.addressLabel,
      addressLine: snapshot.addressLine,
    });
    setStep('slip');
  };

  const handleDone = () => {
    setStep('checkout');
    setOrderNumber('');
    onDoneRedirect?.();
    onClose();
  };

  const handleClose = () => {
    if (step === 'slip') {
      handleDone();
      return;
    }
    onClose();
  };

  // ——— Order Slip (after successful place order) ———
  if (step === 'slip') {
    const placedAt = new Date().toLocaleString('en-MM', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleDone} />

        <div className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-customer" />
              <h2 className="text-lg font-bold text-foreground">Order Slip</h2>
            </div>
            <button
              onClick={handleDone}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-5">
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 mb-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-lg font-bold text-foreground">အော်ဒါအောင်မြင်ပါသည်</p>
              <p className="text-sm text-muted-foreground mt-1">Keep this slip for your records</p>
            </div>

            <div className="border-2 border-dashed border-border rounded-xl p-4 bg-muted/20 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order No.</span>
                <span className="font-bold font-tabular text-customer">{orderNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{placedAt}</span>
              </div>
              {slipMeta.restaurantName && (
                <div className="flex justify-between text-sm gap-3">
                  <span className="text-muted-foreground">Shop</span>
                  <span className="font-medium text-right">{slipMeta.restaurantName}</span>
                </div>
              )}
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground">Payment</span>
                <span className="font-medium">
                  {slipPayment === 'cash' ? 'Cash on Delivery' : 'Bank Pay (KBZPay / KPay)'}
                </span>
              </div>

              <div className="border-t border-dashed border-border pt-3 space-y-2">
                {slipItems.map((item) => (
                  <div key={item.id} className="flex justify-between gap-2 text-sm">
                    <span className="text-foreground">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-tabular font-semibold flex-shrink-0">
                      {formatMoney(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-border pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-tabular">{formatMoney(slipMeta.subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery</span>
                  <span className="font-tabular">{formatMoney(slipMeta.deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Fees + Tax</span>
                  <span className="font-tabular">
                    {formatMoney(slipMeta.platformFee + slipMeta.tax)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold">Grand Total</span>
                  <span className="text-lg font-bold font-tabular text-customer">
                    {formatMoney(slipTotal)}
                  </span>
                </div>
              </div>

              <div className="border-t border-dashed border-border pt-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Deliver to
                </p>
                <p className="text-sm font-semibold">{slipMeta.addressLabel}</p>
                <p className="text-xs text-muted-foreground">{slipMeta.addressLine}</p>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-border flex-shrink-0 flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary flex-1 py-3 justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print Slip
            </button>
            <button type="button" onClick={handleDone} className="btn-primary flex-1 py-3 justify-center">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ——— Checkout / invoice before place order ———
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-customer" />
            <div>
              <h2 className="text-lg font-bold text-foreground">Order Invoice</h2>
              {restaurantName && (
                <p className="text-xs text-muted-foreground">{restaurantName}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-4 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-xl border border-border">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              {locating ? (
                <Loader2 className="w-4 h-4 text-customer animate-spin" />
              ) : (
                <MapPin className="w-4 h-4 text-customer" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Delivery
              </p>
              <select
                className="input-field w-full py-2.5 text-sm"
                value={
                  addressOptions.some((a) => a.label === deliveryAddress.label)
                    ? deliveryAddress.label
                    : deliveryAddress.label || addressOptions[0]?.label || ''
                }
                disabled={locating || isPlacing}
                onChange={(e) => handleAddressSelect(e.target.value)}
              >
                {addressOptions.map((addr) => (
                  <option key={`${addr.label}-${addr.lat}-${addr.lng}`} value={addr.label}>
                    {addr.label} - {addr.address}
                  </option>
                ))}
                <option value="CURRENT_LOC">📍 Use Current Location</option>
                <option value="MAP_PICK">➕ Pick from Map</option>
              </select>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {locating ? 'Detecting your location…' : deliveryAddress.address}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Selected Items · {itemCount}
            </p>
            <div className="space-y-2.5">
              {items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-orange-50 text-customer text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {item.quantity}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground leading-tight">{item.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.options}</p>
                      {item.note && (
                        <p className="text-xs text-customer truncate">Note: {item.note}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold font-tabular text-foreground flex-shrink-0">
                    {formatMoney(item.unitPrice * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 text-sm border-t border-border pt-3">
            {[
              { label: 'Subtotal', value: subtotal },
              { label: 'Delivery fee', value: deliveryFee },
              { label: 'Platform fee', value: platformFee },
              { label: 'Tax (8%)', value: tax },
            ].map((row) => (
              <div key={row.label} className="flex justify-between">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-semibold font-tabular">{formatMoney(row.value)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-base font-bold text-foreground">Grand Total</span>
              <span className="text-lg font-bold font-tabular text-customer">
                {formatMoney(total)}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Payment Method
            </p>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => onPaymentMethodChange('cash')}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-customer bg-orange-50/60'
                    : 'border-border bg-muted/30'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    paymentMethod === 'cash'
                      ? 'bg-customer text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      paymentMethod === 'cash' ? 'text-customer' : 'text-foreground'
                    }`}
                  >
                    Cash on Delivery
                  </p>
                  <p className="text-xs text-muted-foreground">Pay when your order arrives</p>
                </div>
                {paymentMethod === 'cash' ? (
                  <CheckCircle2 className="w-5 h-5 text-customer" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onPaymentMethodChange('bank')}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                  paymentMethod === 'bank'
                    ? 'border-customer bg-orange-50/60'
                    : 'border-border bg-muted/30'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    paymentMethod === 'bank'
                      ? 'bg-customer text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      paymentMethod === 'bank' ? 'text-customer' : 'text-foreground'
                    }`}
                  >
                    Bank Pay
                  </p>
                  <p className="text-xs text-muted-foreground">KBZPay / KPay / Mobile Banking</p>
                </div>
                {paymentMethod === 'bank' ? (
                  <CheckCircle2 className="w-5 h-5 text-customer" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex-shrink-0">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPlacing || items.length === 0}
            className="btn-primary w-full py-3.5 justify-center disabled:opacity-70"
          >
            {isPlacing ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Placing order…
              </span>
            ) : (
              `Confirm Payment & Place Order · ${formatMoney(total)}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
