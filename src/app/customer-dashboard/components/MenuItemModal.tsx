'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Star, Minus, Plus } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import type { MenuItem } from '../types';

interface MenuItemModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: MenuItem, quantity: number) => void;
}

export default function MenuItemModal({ item, isOpen, onClose, onAddToCart }: MenuItemModalProps) {
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (isOpen) setQuantity(1);
  }, [isOpen, item?.id]);

  if (!item) return null;

  const total = item.price * quantity;

  const handleAdd = () => {
    onAddToCart(item, quantity);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-item-title"
            className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            {/* Image */}
            <div className="relative h-52 sm:h-56 w-full flex-shrink-0">
              <AppImage
                src={item.image}
                alt={item.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 28rem"
                priority
              />
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors shadow-sm"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-2">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2 id="menu-item-title" className="text-xl font-bold text-foreground leading-tight">
                  {item.name}
                </h2>
                <p className="text-lg font-bold font-tabular text-customer flex-shrink-0">
                  ${item.price.toFixed(2)}
                </p>
              </div>

              <div className="flex items-center gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${
                      i < Math.round(item.rating)
                        ? 'text-warning fill-warning'
                        : 'text-border'
                    }`}
                  />
                ))}
                <span className="text-xs font-semibold text-muted-foreground ml-1">
                  {item.rating.toFixed(1)}
                </span>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {item.description}
              </p>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border flex-shrink-0 space-y-3">
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center text-lg font-bold font-tabular">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button onClick={handleAdd} className="btn-primary w-full py-3.5 justify-between">
                <span>Add to Cart</span>
                <span className="font-tabular">${total.toFixed(2)}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
