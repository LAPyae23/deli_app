'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Star, Minus, Plus } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import { formatMMK } from '@/lib/currency';
import type { MenuItem } from '../types';

interface MenuItemDetailProps {
  item: MenuItem;
  onClose: () => void;
  onAddToCart: (
    item: MenuItem,
    quantity: number,
    selectedOptionsString: string,
    unitPrice: number
  ) => void;
}

export default function MenuItemDetail({ item, onClose, onAddToCart }: MenuItemDetailProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  useEffect(() => {
    setQuantity(1);
    setSelectedAddons([]);
  }, [item.id]);

  const addonsTotal = selectedAddons.reduce((sum, addonName) => {
    const addon = item.addons?.find((a) => a.name === addonName);
    return sum + (addon?.extraPrice || 0);
  }, 0);

  const unitPrice = item.price + addonsTotal;
  const total = unitPrice * quantity;

  const toggleAddon = (name: string) => {
    setSelectedAddons((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleAdd = () => {
    if (item.isAvailable === false) return;
    const selectedOptionsString = selectedAddons.length > 0 ? selectedAddons.join(', ') : '';
    onAddToCart(item, quantity, selectedOptionsString, unitPrice);
    onClose();
  };

  const outOfStock = item.isAvailable === false;

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card animate-fade-in">
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Menu
        </button>
      </div>

      <div className="relative h-52 w-full bg-muted sm:h-64 md:h-72">
        {item.image?.startsWith('data:') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.imageAlt || item.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : item.image ? (
          <AppImage
            src={item.image}
            alt={item.imageAlt || item.name}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 70vw"
            priority
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        )}
      </div>

      <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="menu-item-title" className="text-xl font-bold leading-tight text-foreground sm:text-2xl">
            {item.name}
          </h2>
          <p className="flex-shrink-0 text-lg font-bold text-customer font-tabular sm:text-xl">
            {formatMMK(item.price)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${
                i < Math.round(item.rating || 0) ? 'fill-warning text-warning' : 'text-border'
              }`}
            />
          ))}
          <span className="ml-1 text-xs font-semibold text-muted-foreground">
            {(item.rating || 0).toFixed(1)}
          </span>
          {item.category && (
            <span className="ml-2 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {item.category}
            </span>
          )}
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          {item.description || 'No description available.'}
        </p>

        {item.addons && item.addons.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-foreground">Add-ons</p>
            <div className="space-y-2">
              {item.addons.map((addon) => {
                const checked = selectedAddons.includes(addon.name);
                return (
                  <label
                    key={addon.name}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                      checked
                        ? 'border-customer/40 bg-orange-50'
                        : 'border-border bg-card hover:border-customer/30'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAddon(addon.name)}
                        className="h-4 w-4 accent-customer"
                      />
                      <span className="truncate text-sm font-medium text-foreground">{addon.name}</span>
                    </span>
                    <span className="flex-shrink-0 text-sm font-semibold text-customer font-tabular">
                      +{formatMMK(Number(addon.extraPrice || 0))}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-colors hover:bg-border"
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-lg font-bold font-tabular">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-colors hover:bg-border"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock}
            className={`w-full justify-between py-3.5 ${
              outOfStock
                ? 'inline-flex cursor-not-allowed items-center rounded-lg bg-muted px-4 text-sm font-semibold text-muted-foreground'
                : 'btn-primary'
            }`}
          >
            <span>{outOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
            {!outOfStock && <span className="font-tabular">{formatMMK(total)}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
