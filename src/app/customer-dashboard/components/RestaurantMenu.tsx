'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Star, Clock, Bike, Plus, UtensilsCrossed, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import AppImage from '@/components/ui/AppImage';
import { formatMMK } from '@/lib/currency';
import { formatRating } from '@/lib/formatRating';
import MenuItemDetail from './MenuItemDetail';
import RestaurantReviews from './RestaurantReviews';
import type { CartItem, MenuItem as SharedMenuItem, Restaurant } from '../types';

type PastOrder = {
  _id: string;
  restaurantName?: string;
  status?: string;
  restaurantRating?: number | null;
  createdAt?: string;
};

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
  rating: number | null;
  popular?: boolean;
  isAvailable?: boolean;
  stockQuantity?: number;
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
  const [pastOrders, setPastOrders] = useState<PastOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [restaurantRating, setRestaurantRating] = useState(5);
  const [foodComment, setFoodComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const fetchMenuItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/menu?restaurantId=${encodeURIComponent(restaurant.id)}`
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch menu');
      }

      const allItems: MenuItem[] = (data.items || []).map((raw: Record<string, unknown>) => {
        const _id = String(raw._id ?? '');
        const rawAddons = Array.isArray(raw.addons) ? raw.addons : [];
        const stockQuantity = Number(raw.stockQuantity);
        const isAvailable =
          raw.isAvailable !== false &&
          (Number.isFinite(stockQuantity) ? stockQuantity > 0 : true);
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
          rating: (() => {
            const n = Number(raw.rating);
            return Number.isFinite(n) && n > 0 ? n : null;
          })(),
          popular: Boolean(raw.isPopular),
          isAvailable,
          stockQuantity: Number.isFinite(stockQuantity) ? stockQuantity : undefined,
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
    setReviewSubmitted(false);
    setRestaurantRating(5);
    setFoodComment('');
    fetchMenuItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when restaurant changes
  }, [restaurant.id]);

  useEffect(() => {
    let cancelled = false;

    async function fetchOrders() {
      setOrdersLoading(true);
      try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load orders');
        if (!cancelled) {
          setPastOrders(Array.isArray(data.orders) ? data.orders : []);
        }
      } catch {
        if (!cancelled) setPastOrders([]);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    }

    fetchOrders();
    return () => {
      cancelled = true;
    };
  }, [restaurant.id]);

  const deliveredOrdersForRestaurant = useMemo(
    () =>
      pastOrders.filter(
        (o) =>
          String(o.status || '').toUpperCase() === 'DELIVERED' &&
          o.restaurantName === restaurant.name
      ),
    [pastOrders, restaurant.name]
  );

  const hasDeliveredOrder = deliveredOrdersForRestaurant.length > 0;

  const latestDeliveredOrder = useMemo(() => {
    return [...deliveredOrdersForRestaurant].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    })[0];
  }, [deliveredOrdersForRestaurant]);

  const alreadyRated =
    reviewSubmitted ||
    (typeof latestDeliveredOrder?.restaurantRating === 'number' &&
      latestDeliveredOrder.restaurantRating > 0);

  const categories = useMemo(
    () => Array.from(new Set(menuItems.map((i) => i.category).filter(Boolean))),
    [menuItems]
  );

  const submitRestaurantReview = async () => {
    if (!latestDeliveredOrder?._id) {
      toast.error('No delivered order found for this restaurant');
      return;
    }
    setIsSubmittingReview(true);
    try {
      const res = await fetch(`/api/orders/${latestDeliveredOrder._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantRating,
          reviewComment: foodComment,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to submit review');
      setReviewSubmitted(true);
      toast.success('Thank you for your restaurant review!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleAddToCart = (
    item: SharedMenuItem,
    quantity: number,
    selectedOptionsString: string,
    unitPrice: number
  ) => {
    if (item.isAvailable === false) {
      toast.error(`${item.name} is out of stock`);
      return;
    }
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
      restaurantId: restaurant.id,
      image: item.image,
      imageAlt: item.imageAlt,
    });
    toast.success(`${item.name} added to cart`);
  };

  const openItem = (item: MenuItem) => {
    if (item.isAvailable === false) {
      toast.error(`${item.name} is out of stock`);
      return;
    }
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
                src={restaurant.coverImage || restaurant.image}
                alt={restaurant.imageAlt}
                fill
                fallbackSrc="/assets/images/no_image.png"
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
              {restaurant.logoImage ? (
                <div className="absolute bottom-16 right-4 h-14 w-14 overflow-hidden rounded-xl border-2 border-white/90 bg-card shadow-md sm:bottom-20 sm:right-5">
                  <AppImage
                    src={restaurant.logoImage}
                    alt={`${restaurant.name} logo`}
                    fill
                    fallbackSrc="/assets/images/no_image.png"
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
              ) : null}
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                <h1 className="mb-1 text-2xl font-bold text-white drop-shadow-sm sm:text-3xl">
                  {restaurant.name}
                </h1>
                <p className="mb-2 text-sm text-white/85">{restaurant.cuisine}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-white/90 sm:text-sm">
                  <span className="flex items-center gap-1 font-semibold">
                    <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                    {formatRating(restaurant.rating)}
                    {restaurant.reviews > 0 && (
                      <span className="font-normal opacity-80">
                        ({restaurant.reviews.toLocaleString()})
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {restaurant.deliveryTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bike className="h-3.5 w-3.5" />
                    {restaurant.deliveryFee === 0
                      ? 'Free delivery'
                      : `${formatMMK(restaurant.deliveryFee)} delivery`}
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
                      {items.map((item) => {
                        const outOfStock = item.isAvailable === false;
                        return (
                        <button
                          key={item._id}
                          type="button"
                          disabled={outOfStock}
                          onClick={() => openItem(item)}
                          className={`group flex w-full items-stretch gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all duration-200 sm:p-4 ${
                            outOfStock
                              ? 'cursor-not-allowed opacity-60 grayscale'
                              : 'hover:border-customer/40 hover:card-shadow-md'
                          }`}
                        >
                          <div className="min-w-0 flex-1 py-0.5">
                            <div className="mb-0.5 flex flex-wrap items-center gap-2">
                              <h3
                                className={`text-sm font-bold sm:text-base ${
                                  outOfStock
                                    ? 'text-muted-foreground'
                                    : 'text-foreground transition-colors group-hover:text-customer'
                                }`}
                              >
                                {item.name}
                              </h3>
                              {outOfStock && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                  Out of Stock
                                </span>
                              )}
                            </div>
                            <p className="mb-2 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                              {item.description || 'No description'}
                            </p>
                            <p className="text-sm font-bold font-tabular text-foreground">
                              {formatMMK(item.price)}
                            </p>
                          </div>

                          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-28">
                            <AppImage
                              src={item.image}
                              alt={item.imageAlt || item.name}
                              fill
                              fallbackSrc="/assets/images/no_image.png"
                              className="object-cover"
                              sizes="112px"
                            />
                            {outOfStock ? (
                              <span className="absolute inset-0 flex items-center justify-center bg-foreground/50">
                                <span className="rounded-full bg-card px-2 py-1 text-[10px] font-bold text-foreground">
                                  Out of Stock
                                </span>
                              </span>
                            ) : (
                              <span
                                role="presentation"
                                className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-customer shadow-sm transition-colors group-hover:border-customer group-hover:bg-customer group-hover:text-white"
                              >
                                <Plus className="h-4 w-4" />
                              </span>
                            )}
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Verified restaurant ratings */}
          {!selectedItem && (
            <div className="mt-8 rounded-2xl border border-border bg-card p-5 card-shadow sm:p-6">
              <h2 className="mb-1 text-lg font-bold text-foreground">
                Restaurant Ratings & Reviews
              </h2>
              <p className="mb-5 text-sm text-muted-foreground">
                Only customers with a delivered order can rate this restaurant.
              </p>

              {ordersLoading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-customer" />
                  Checking purchase history…
                </div>
              ) : hasDeliveredOrder ? (
                alreadyRated ? (
                  <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-5 text-center">
                    <p className="text-sm font-semibold text-foreground">
                      Thanks — your review for {restaurant.name} is saved.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Verified purchase review from your latest delivered order.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-foreground">Your rating</p>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            disabled={isSubmittingReview}
                            onClick={() => setRestaurantRating(n)}
                            className="rounded-md p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
                            aria-label={`Rate ${n} stars`}
                          >
                            <Star
                              className={`h-7 w-7 sm:h-8 sm:w-8 ${
                                n <= restaurantRating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'fill-transparent text-border'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="food-review"
                        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Food review
                      </label>
                      <textarea
                        id="food-review"
                        value={foodComment}
                        onChange={(e) => setFoodComment(e.target.value)}
                        disabled={isSubmittingReview}
                        rows={3}
                        placeholder="How was the food and service?"
                        className="input-field w-full resize-none py-2.5 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={submitRestaurantReview}
                      disabled={isSubmittingReview}
                      className="btn-primary flex w-full items-center justify-center gap-2 py-3 disabled:opacity-60 sm:w-auto sm:min-w-[10rem]"
                    >
                      {isSubmittingReview ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Submitting…
                        </>
                      ) : (
                        'Submit Review'
                      )}
                    </button>
                  </div>
                )
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    🔒 You can review this restaurant after your first delivered order.
                  </p>
                </div>
              )}
            </div>
          )}

          <RestaurantReviews
            restaurantId={restaurant.id}
            refreshKey={reviewSubmitted ? 'submitted' : restaurant.id}
          />
        </>
      )}
    </section>
  );
}
