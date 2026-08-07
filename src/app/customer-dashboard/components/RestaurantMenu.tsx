'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Star, Clock, Bike, Plus, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import AppImage from '@/components/ui/AppImage';
import MenuItemDetail from './MenuItemDetail';
import type { CartItem, MenuItem as SharedMenuItem, Restaurant } from '../types';

/** Local menu shape aligned with MongoDB /api/menu schema */
interface MenuItem {
  _id: string;
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  imageAlt: string;
  restaurantId: string;
  rating: number;
  popular?: boolean;
  addons?: { name: string; extraPrice: number }[];
}

interface RestaurantMenuProps {
  restaurant: Restaurant;
  onBack: () => void;
  onAddToCart: (item: Omit<CartItem, 'quantity'> & { quantity: number }) => void;
}

export default function RestaurantMenu({ restaurant, onBack, onAddToCart }: RestaurantMenuProps) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMenuItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/menu');
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch menu');
      }

      const allItems: MenuItem[] = (data.items || []).map((raw: Record<string, unknown>) => {
        const _id = String(raw._id ?? '');
        const rawAddons = Array.isArray(raw.addons) ? raw.addons : [];
        return {
          _id,
          id: _id,
          name: String(raw.name || 'Untitled item'),
          description: String(raw.description || ''),
          price: Number(raw.price) || 0,
          category: String(raw.category || 'Main Menu'),
          image: String(raw.image || ''),
          imageAlt: String(raw.imageAlt || raw.name || 'Menu item'),
          restaurantId: String(raw.restaurantId || ''),
          rating: raw.isPopular ? 4.8 : 4.5,
          popular: Boolean(raw.isPopular),
          addons: rawAddons.map((a: { name?: string; extraPrice?: number }) => ({
            name: String(a?.name || ''),
            extraPrice: Number(a?.extraPrice) || 0,
          })).filter((a: { name: string }) => a.name),
        };
      });

      // Strictly show items for this restaurant only (matches vendor portal restaurantId)
      const filtered = allItems.filter((item) => item.restaurantId === restaurant.id);
      setMenuItems(filtered);
    } catch (error) {
      console.error(error);
      setMenuItems([]);
      toast.error('Failed to load menu items');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when restaurant changes
  }, [restaurant.id]);

  const categories = useMemo(
    () => Array.from(new Set(menuItems.map((i) => i.category).filter(Boolean))),
    [menuItems]
  );

  const handleAddToCart = (
    item: SharedMenuItem,
    quantity: number,
    selectedOptionsString: string,
    unitPrice: number
  ) => {
    const mongoId = (item as MenuItem)._id || item._id || item.id;
    // Distinct cart line when add-ons differ
    const cartLineId = selectedOptionsString
      ? `${mongoId}__${selectedOptionsString}`
      : mongoId;

    onAddToCart({
      id: cartLineId,
      name: item.name,
      options: selectedOptionsString || item.category,
      unitPrice,
      quantity,
      restaurantName: restaurant.name,
      image: item.image,
      imageAlt: item.imageAlt,
    });
    toast.success(`${item.name} added to cart`);
  };

  const openItem = (item: MenuItem) => {
    setSelectedItem(item);
  };

  return (
    <section className="min-w-0">
      {selectedItem ? (
        <MenuItemDetail
          item={selectedItem as SharedMenuItem}
          onClose={() => setSelectedItem(null)}
          onAddToCart={handleAddToCart}
        />
      ) : (
        <>
          {/* Cover + header */}
          <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="relative h-44 sm:h-56 md:h-64">
              <AppImage
                src={restaurant.image}
                alt={restaurant.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 70vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <button
                type="button"
                onClick={onBack}
                className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-2 text-sm font-semibold text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-card sm:left-4 sm:top-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Shop
              </button>
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                <h1 className="mb-1 text-2xl font-bold text-white drop-shadow-sm sm:text-3xl">
                  {restaurant.name}
                </h1>
                <p className="mb-2 text-sm text-white/85">{restaurant.cuisine}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-white/90 sm:text-sm">
                  <span className="flex items-center gap-1 font-semibold">
                    <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                    {restaurant.rating}
                    <span className="font-normal opacity-80">({restaurant.reviews.toLocaleString()})</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {restaurant.deliveryTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bike className="h-3.5 w-3.5" />
                    {restaurant.deliveryFee === 0
                      ? 'Free delivery'
                      : `$${restaurant.deliveryFee.toFixed(2)} delivery`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card py-16 text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-customer border-t-transparent" />
              <p className="text-sm font-medium">Loading menu…</p>
            </div>
          )}

          {/* Empty */}
          {!isLoading && menuItems.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-center">
              <UtensilsCrossed className="h-10 w-10 text-muted-foreground" />
              <h2 className="text-lg font-bold text-foreground">No menu items available</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                This restaurant has not published any dishes yet. Add items from the vendor Menu Management panel.
              </p>
            </div>
          )}

          {/* Categorized menu from MongoDB */}
          {!isLoading && menuItems.length > 0 && (
            <div className="space-y-8">
              {categories.map((category) => {
                const items = menuItems.filter((i) => i.category === category);
                return (
                  <div key={category}>
                    <h2 className="mb-3 text-lg font-bold text-foreground">{category}</h2>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <button
                          key={item._id}
                          type="button"
                          onClick={() => openItem(item)}
                          className="group flex w-full items-stretch gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all duration-200 hover:border-customer/40 hover:card-shadow-md sm:p-4"
                        >
                          <div className="min-w-0 flex-1 py-0.5">
                            <h3 className="mb-0.5 text-sm font-bold text-foreground transition-colors group-hover:text-customer sm:text-base">
                              {item.name}
                            </h3>
                            <p className="mb-2 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                              {item.description || 'No description'}
                            </p>
                            <p className="text-sm font-bold font-tabular text-foreground">
                              ${item.price.toFixed(2)}
                            </p>
                          </div>

                          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-28">
                            {item.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.image}
                                alt={item.imageAlt || item.name}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                No image
                              </div>
                            )}
                            <span
                              role="presentation"
                              className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-customer shadow-sm transition-colors group-hover:border-customer group-hover:bg-customer group-hover:text-white"
                            >
                              <Plus className="h-4 w-4" />
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
