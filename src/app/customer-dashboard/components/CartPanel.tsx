'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  HelpCircle,
  Store,
  Pencil,
  Trash2,
  Plus,
  Minus,
  Circle,
  CheckCircle2,
  ShoppingCart,
  MapPin,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import AppImage from '@/components/ui/AppImage';
import { formatMMK } from '@/lib/currency';
import { calculateOrderPricing, DEFAULT_DELIVERY_FEE_KS } from '@/lib/orderPricing';
import OrderReceiptModal, { type PaymentMethod } from './OrderReceiptModal';
import { placeOrder } from '../services/orderService';
import type { CartItem, DeliveryAddressInfo, OrderTotals } from '../types';

interface CartPanelProps {
  items: CartItem[];
  updateQty: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  removePurchasedItems: (ids: string[]) => void;
  addToCart?: (item: Omit<CartItem, 'quantity'> & { quantity: number }) => void;
  restaurantName?: string;
  deliveryAddress: DeliveryAddressInfo;
  savedAddresses?: DeliveryAddressInfo[];
  onDeliveryAddressChange?: (address: DeliveryAddressInfo) => void;
  onOpenAddressPicker?: () => void;
  onBack?: () => void;
  onGoDiscover?: () => void;
  onOrderSuccess?: (orderId: string) => void;
}

type BasketRec = {
  id: string;
  itemId?: string;
  name: string;
  category: string;
  price: number;
  unitPrice: number;
  image?: string;
  restaurantName?: string;
  confidence?: number;
  pairedWith?: string;
  explanation?: string;
};

export default function CartPanel({
  items,
  updateQty,
  removeItem,
  removePurchasedItems,
  addToCart,
  restaurantName,
  deliveryAddress,
  savedAddresses = [],
  onDeliveryAddressChange,
  onOpenAddressPicker,
  onBack,
  onGoDiscover,
  onOrderSuccess,
}: CartPanelProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>(() => items.map((i) => i.id));
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isPlacing, setIsPlacing] = useState(false);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<BasketRec[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [openExplanationId, setOpenExplanationId] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [appliedPercent, setAppliedPercent] = useState(0);
  const [appliedCode, setAppliedCode] = useState('');
  const [grantedPromo, setGrantedPromo] = useState<{
    hasPromo: boolean;
    promoCode: string;
    promoDiscountPercent: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPromo() {
      try {
        const customerId = localStorage.getItem('fooddash_session_id');
        if (!customerId) return;
        const res = await fetch(
          `/api/customer/profile?customerId=${encodeURIComponent(customerId)}`
        );
        const data = await res.json();
        if (!res.ok || !data.success || cancelled) return;
        const profile = data.profile || {};
        setGrantedPromo({
          hasPromo: Boolean(profile.hasPromo),
          promoCode: String(profile.promoCode || ''),
          promoDiscountPercent: Number(profile.promoDiscountPercent) || 0,
        });
      } catch {
        if (!cancelled) setGrantedPromo(null);
      }
    }

    loadPromo();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedItems((prev) => {
      const ids = new Set(items.map((i) => i.id));
      const kept = prev.filter((id) => ids.has(id));
      const added = items.map((i) => i.id).filter((id) => !prev.includes(id));
      if (prev.length === 0 && items.length > 0) return items.map((i) => i.id);
      return [...kept, ...added];
    });
  }, [items]);

  // Market-basket recommendations from current cart items
  useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      if (items.length === 0) {
        setRecommendations([]);
        return;
      }

      const cartNames = Array.from(
        new Set(items.map((i) => i.name.trim()).filter(Boolean))
      );
      if (cartNames.length === 0) {
        setRecommendations([]);
        return;
      }

      setRecsLoading(true);
      try {
        const params = new URLSearchParams({
          items: cartNames.slice(0, 8).join(','),
          limit: '5',
        });
        const res = await fetch(`/api/recommendations?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || !data.success || cancelled) return;

        const cartNameSet = new Set(cartNames.map((n) => n.toLowerCase()));
        const cartIdSet = new Set(items.map((i) => i.id));
        const next = (Array.isArray(data.recommendations) ? data.recommendations : [])
          .filter(
            (r: BasketRec) =>
              r?.name &&
              !cartNameSet.has(String(r.name).toLowerCase()) &&
              !cartIdSet.has(String(r.id))
          )
          .slice(0, 5) as BasketRec[];

        setRecommendations(next);
      } catch (error) {
        console.warn('Failed to load basket recommendations', error);
        if (!cancelled) setRecommendations([]);
      } finally {
        if (!cancelled) setRecsLoading(false);
      }
    }

    const timer = setTimeout(loadRecommendations, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [items]);

  const handleAddSuggestion = (rec: BasketRec) => {
    if (!addToCart) return;
    const id = rec.id?.startsWith('rec-')
      ? rec.id
      : `rec-${rec.name.toLowerCase().replace(/\s+/g, '-')}`;

    addToCart({
      id,
      name: rec.name,
      options: rec.category || 'Suggested',
      unitPrice: Number(rec.unitPrice ?? rec.price) || 0,
      quantity: 1,
      restaurantName: rec.restaurantName || restaurantName || items[0]?.restaurantName,
      restaurantId: items[0]?.restaurantId,
      image: rec.image,
      imageAlt: rec.name,
    });
    toast.success(`Added ${rec.name} to cart`);
  };

  const selectedCartItems = useMemo(
    () => items.filter((i) => selectedItems.includes(i.id)),
    [items, selectedItems]
  );

  const groups = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    for (const item of items) {
      const key = item.restaurantName || restaurantName || 'Restaurant';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [items, restaurantName]);

  const subtotal = selectedCartItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const pricing = calculateOrderPricing({
    subtotal,
    deliveryFee: selectedCartItems.length > 0 ? DEFAULT_DELIVERY_FEE_KS : 0,
  });
  const deliveryFee = selectedCartItems.length > 0 ? pricing.deliveryFee : 0;
  const platformFee = selectedCartItems.length > 0 ? pricing.platformFee : 0;
  const tax = selectedCartItems.length > 0 ? pricing.tax : 0;
  const discountAmount = promoApplied
    ? Math.max(0, Math.round(subtotal * (appliedPercent / 100)))
    : 0;
  const total =
    selectedCartItems.length > 0
      ? Math.max(0, subtotal + tax + deliveryFee - discountAmount)
      : 0;

  const applyCartPromo = (code: string, percent: number) => {
    const clean = String(code || '').trim();
    const pct = Number(percent) || 0;
    if (!clean || pct <= 0) {
      toast.error('Invalid promo code');
      return;
    }
    setPromoInput(clean);
    setAppliedCode(clean);
    setAppliedPercent(pct);
    setPromoApplied(true);
    toast.success(`${pct}% off applied`);
  };

  const tryApplyCartPromo = () => {
    const entered = promoInput.trim().toUpperCase();
    const expected = String(grantedPromo?.promoCode || '').trim().toUpperCase();
    const percent = Number(grantedPromo?.promoDiscountPercent) || 0;
    if (
      grantedPromo?.hasPromo &&
      expected &&
      entered === expected &&
      percent > 0
    ) {
      applyCartPromo(grantedPromo.promoCode, percent);
      return;
    }
    toast.error('Invalid promo code');
    setPromoApplied(false);
    setAppliedPercent(0);
    setAppliedCode('');
  };

  const allSelected = items.length > 0 && selectedItems.length === items.length;

  const toggleItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleShop = (shopItems: CartItem[]) => {
    const ids = shopItems.map((i) => i.id);
    const allShopSelected = ids.every((id) => selectedItems.includes(id));
    if (allShopSelected) {
      setSelectedItems((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedItems((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  const toggleSelectAll = () => {
    setSelectedItems(allSelected ? [] : items.map((i) => i.id));
  };

  const handleConfirmOrder = () => {
    if (selectedItems.length === 0) {
      toast.error('Select at least one item to checkout');
      return;
    }
    setPaymentMethod('cash');
    setReceiptOpen(true);
  };

  const handlePlaceOrder = async (
    tipAmount = 0,
    promo?: { discount: number; promoApplied: boolean; promoCodeUsed?: string }
  ): Promise<string | null> => {
    if (selectedCartItems.length === 0) return null;

    const safeTip = Math.max(0, Math.round(Number(tipAmount) || 0));
    const discountAmount = Math.max(0, Math.round(Number(promo?.discount) || 0));
    const promoApplied = Boolean(promo?.promoApplied && discountAmount > 0);
    const promoCodeUsed = String(promo?.promoCodeUsed || '').trim();

    const totals: OrderTotals = {
      subtotal,
      deliveryFee,
      platformFee,
      discount: discountAmount,
      tax,
      total: Math.max(0, subtotal + tax + deliveryFee - discountAmount + safeTip),
      promoApplied,
      tipAmount: safeTip,
      promoCodeUsed,
    };

    setIsPlacing(true);
    try {
      const result = await placeOrder({
        items: selectedCartItems.map((i) => ({
          ...i,
          note: itemNotes[i.id] || i.note,
        })),
        totals,
        deliveryAddress,
        paymentMethod,
        restaurantName:
          restaurantName || selectedCartItems[0]?.restaurantName,
        restaurantId: selectedCartItems[0]?.restaurantId,
        tipAmount: safeTip,
        discount: discountAmount,
        promoCodeUsed,
      });

      const purchasedIds = selectedCartItems.map((i) => i.id);
      removePurchasedItems(purchasedIds);
      setSelectedItems((prev) => prev.filter((id) => !purchasedIds.includes(id)));

      toast.success(`Order ${result.orderNumber} placed successfully`);
      setPlacedOrderId(result.orderId);
      setPromoApplied(false);
      setAppliedPercent(0);
      setAppliedCode('');
      setPromoInput('');
      if (promoCodeUsed) {
        setGrantedPromo((prev) =>
          prev
            ? { ...prev, hasPromo: false, promoCode: '', promoDiscountPercent: 0 }
            : prev
        );
      }
      return result.orderNumber;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to place order');
      return null;
    } finally {
      setIsPlacing(false);
    }
  };

  return (
    <>
      <aside className="w-full lg:w-[22rem] xl:w-96 bg-[#f5f5f5] lg:bg-card border-t lg:border-t-0 lg:border-l border-border flex flex-col h-[calc(100vh-4rem)] lg:sticky lg:top-16 mt-4 lg:mt-0 rounded-xl lg:rounded-none overflow-hidden min-h-0">
        {/* Header — matches shopping cart reference */}
        <div className="flex-shrink-0 bg-white border-b border-border px-3 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack || onGoDiscover}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="font-bold text-base text-foreground">Cart</h2>
          <button
            type="button"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
            aria-label="Help"
            onClick={() => toast.message('Select items, then confirm to get your order slip.')}
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
            <ShoppingCart className="w-14 h-14 text-border mb-3" />
            <p className="font-semibold text-foreground mb-1">Cart is empty</p>
            <p className="text-sm text-muted-foreground mb-4">
              Discover restaurants and add items to your cart to place an order.
            </p>
            {onGoDiscover && (
              <button type="button" onClick={onGoDiscover} className="btn-primary px-5 py-2.5">
                Go to Discover
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto pb-6 scrollbar-hide min-h-0">
            <div className="border-b border-border bg-white px-3 py-3">
              <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-customer" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {deliveryAddress.label || 'Delivery'}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                    {deliveryAddress.address}
                  </p>
                  {savedAddresses.length > 0 && onDeliveryAddressChange && (
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
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
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
                </div>
                {onOpenAddressPicker && (
                  <button
                    type="button"
                    onClick={onOpenAddressPicker}
                    className="flex-shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-customer hover:bg-orange-50"
                  >
                    Change
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 space-y-3">
              {groups.map(([shopName, shopItems]) => {
                const shopAllSelected = shopItems.every((i) => selectedItems.includes(i.id));
                return (
                  <div
                    key={shopName}
                    className="bg-white rounded-xl border border-border overflow-hidden"
                  >
                    {/* Shop header */}
                    <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/70">
                      <button
                        type="button"
                        onClick={() => toggleShop(shopItems)}
                        aria-pressed={shopAllSelected}
                      >
                        {shopAllSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-customer" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                      <Store className="w-4 h-4 text-customer flex-shrink-0" />
                      <p className="text-sm font-bold text-foreground truncate flex-1">
                        {shopName}
                      </p>
                    </div>

                    {/* Product cards */}
                    <div className="divide-y divide-border/60">
                      {shopItems.map((item) => {
                        const isSelected = selectedItems.includes(item.id);
                        return (
                          <div key={item.id} className="p-3 flex gap-2.5">
                            <button
                              type="button"
                              onClick={() => toggleItem(item.id)}
                              className="mt-8 flex-shrink-0"
                              aria-pressed={isSelected}
                            >
                              {isSelected ? (
                                <CheckCircle2 className="w-5 h-5 text-customer" />
                              ) : (
                                <Circle className="w-5 h-5 text-muted-foreground" />
                              )}
                            </button>

                            <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                              {item.image ? (
                                  <AppImage
                                    src={item.image}
                                    alt={item.imageAlt || item.name}
                                    fill
                                    fallbackSrc="/assets/images/no_image.png"
                                    className="object-cover"
                                    sizes="80px"
                                  />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ShoppingCart className="w-6 h-6 text-border" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2">
                                <p className="text-sm font-semibold text-foreground leading-snug flex-1 line-clamp-2">
                                  {item.name}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => removeItem(item.id)}
                                  className="text-muted-foreground hover:text-danger transition-colors flex-shrink-0"
                                  aria-label={`Remove ${item.name}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <span className="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                                {item.options || 'Standard'}
                              </span>

                              <button
                                type="button"
                                className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-customer"
                                onClick={() => {
                                  const note = window.prompt(
                                    'Leave a note',
                                    itemNotes[item.id] || item.note || ''
                                  );
                                  if (note !== null) {
                                    setItemNotes((prev) => ({ ...prev, [item.id]: note }));
                                  }
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                                <span className="truncate">
                                  {itemNotes[item.id] || item.note || 'Add a note'}
                                </span>
                              </button>

                              <div className="mt-2 flex items-end justify-between gap-2">
                                <p className="text-sm font-bold text-foreground font-tabular">
                                  {formatMMK(item.unitPrice * item.quantity)}
                                </p>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.id, -1)}
                                    className="w-7 h-7 rounded-md bg-muted flex items-center justify-center hover:bg-border transition-colors"
                                  >
                                    <Minus className="w-3.5 h-3.5 text-foreground" />
                                  </button>
                                  <span className="w-6 text-center text-sm font-bold font-tabular">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.id, 1)}
                                    className="w-7 h-7 rounded-md bg-customer flex items-center justify-center hover:opacity-90 transition-opacity"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-white" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Market basket — customers also bought */}
            {(recsLoading || recommendations.length > 0) && (
              <div className="flex-shrink-0 border-t border-border bg-white px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  Customers who bought this also bought…
                </p>
                {recsLoading && recommendations.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Finding pairings…</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {recommendations.map((rec) => {
                      const tipId = `${rec.itemId || rec.id}-${rec.name}`;
                      const explanation =
                        rec.explanation ||
                        (rec.pairedWith
                          ? `Based on your recent purchase of ${rec.pairedWith}${
                              rec.confidence != null
                                ? ` (Apriori Rule: ${Math.round(Number(rec.confidence) * 100)}% Confidence)`
                                : ''
                            }`
                          : 'Suggested from market-basket association rules.');
                      const tipOpen = openExplanationId === tipId;

                      return (
                      <div
                        key={tipId}
                        className="relative min-w-[9.5rem] max-w-[9.5rem] rounded-xl border border-border bg-muted/30 p-2 flex flex-col gap-1.5"
                      >
                        <div className="relative h-14 w-full overflow-hidden rounded-lg bg-muted">
                          {rec.image ? (
                            <AppImage
                              src={rec.image}
                              alt={rec.name}
                              fill
                              fallbackSrc="/assets/images/no_image.png"
                              className="object-cover"
                              sizes="96px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <ShoppingCart className="h-5 w-5 text-border" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-start gap-1">
                          <p className="min-w-0 flex-1 text-[11px] font-semibold text-foreground line-clamp-2 leading-snug">
                            {rec.name}
                          </p>
                          <div className="relative flex-shrink-0">
                            <button
                              type="button"
                              className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-customer/10 hover:text-customer focus:outline-none focus-visible:ring-2 focus-visible:ring-customer/40"
                              aria-label={`Why ${rec.name}?`}
                              aria-expanded={tipOpen}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenExplanationId((prev) =>
                                  prev === tipId ? null : tipId
                                );
                              }}
                              onMouseEnter={() => setOpenExplanationId(tipId)}
                              onMouseLeave={() =>
                                setOpenExplanationId((prev) =>
                                  prev === tipId ? null : prev
                                )
                              }
                              onFocus={() => setOpenExplanationId(tipId)}
                              onBlur={() =>
                                setOpenExplanationId((prev) =>
                                  prev === tipId ? null : prev
                                )
                              }
                            >
                              <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
                            </button>
                            {tipOpen && (
                              <div
                                role="tooltip"
                                className="absolute bottom-full right-0 z-30 mb-1.5 w-48 rounded-lg border border-customer/40 bg-zinc-900 px-2.5 py-2 text-left shadow-lg shadow-black/25"
                              >
                                <p className="text-[9px] font-bold uppercase tracking-wide text-customer">
                                  Why this?
                                </p>
                                <p className="mt-0.5 text-[10px] leading-snug text-white">
                                  {explanation}
                                </p>
                                <span
                                  className="absolute -bottom-1 right-2 h-2 w-2 rotate-45 border-b border-r border-customer/40 bg-zinc-900"
                                  aria-hidden
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {rec.pairedWith
                            ? `Often with ${rec.pairedWith}`
                            : rec.category}
                        </p>
                        <div className="mt-auto flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold font-tabular text-customer">
                            {formatMMK(Number(rec.unitPrice ?? rec.price) || 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddSuggestion(rec)}
                            disabled={!addToCart}
                            className="inline-flex items-center gap-0.5 rounded-md bg-customer px-1.5 py-1 text-[10px] font-bold text-white hover:opacity-90 disabled:opacity-40"
                            aria-label={`Add ${rec.name}`}
                          >
                            <Plus className="h-3 w-3" />
                            Add
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-border bg-white px-3 py-3">
              {grantedPromo?.hasPromo && grantedPromo.promoCode && (
                <button
                  type="button"
                  onClick={() =>
                    applyCartPromo(
                      grantedPromo.promoCode,
                      grantedPromo.promoDiscountPercent
                    )
                  }
                  className="mb-2 w-full rounded-lg border border-fuchsia-300 bg-gradient-to-r from-fuchsia-50 to-amber-50 px-3 py-2 text-left text-[11px] font-bold text-fuchsia-950"
                >
                  🎉 You have a voucher: {grantedPromo.promoCode} (
                  {grantedPromo.promoDiscountPercent}% off) - Click to apply
                </button>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      tryApplyCartPromo();
                    }
                  }}
                  placeholder="Promo Code"
                  className="input-field min-w-0 flex-1 py-2 text-xs uppercase"
                  autoCapitalize="characters"
                />
                <button
                  type="button"
                  onClick={tryApplyCartPromo}
                  className="flex-shrink-0 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-bold text-foreground"
                >
                  Apply
                </button>
              </div>
            </div>
            </div>

            <div className="shrink-0 bg-card border-t border-border p-4 sticky bottom-0 z-20">
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 min-w-0"
                  aria-pressed={allSelected}
                >
                  {allSelected ? (
                    <CheckCircle2 className="w-5 h-5 text-customer flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                    Select All
                  </span>
                </button>
              </div>
              <div className="mb-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold font-tabular text-foreground">
                    {formatMMK(subtotal)}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-semibold font-tabular text-danger">
                      - {formatMMK(discountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-foreground">Total</span>
                  <span className="font-bold font-tabular text-customer">
                    {formatMMK(total)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={selectedItems.length === 0}
                className="w-full rounded-lg py-2.5 text-sm font-bold text-white bg-customer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                Checkout
              </button>
            </div>
          </>
        )}
      </aside>

      <OrderReceiptModal
        isOpen={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        items={selectedCartItems.map((i) => ({
          ...i,
          note: itemNotes[i.id] || i.note,
        }))}
        subtotal={subtotal}
        deliveryFee={deliveryFee}
        platformFee={platformFee}
        tax={tax}
        total={total}
        deliveryAddress={deliveryAddress}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        isPlacing={isPlacing}
        onConfirmPayment={handlePlaceOrder}
        restaurantName={
          restaurantName || selectedCartItems[0]?.restaurantName
        }
        formatMoney={formatMMK}
        initialPromoCode={promoApplied ? appliedCode || promoInput : ''}
        initialPromoPercent={promoApplied ? appliedPercent : 0}
        savedAddresses={savedAddresses}
        onDeliveryAddressChange={onDeliveryAddressChange}
        onOpenAddressPicker={onOpenAddressPicker}
        onDoneRedirect={() => {
          if (placedOrderId && onOrderSuccess) onOrderSuccess(placedOrderId);
          setPlacedOrderId(null);
        }}
      />
    </>
  );
}