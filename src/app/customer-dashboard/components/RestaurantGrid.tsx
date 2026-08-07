'use client';

import React from 'react';
import { Star, Clock, Bike } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import type { Restaurant } from '../types';

export const RESTAURANTS: Restaurant[] = [
  {
    id: 'burger-bliss-id',
    name: 'Burger Bliss',
    cuisine: 'American · Burgers',
    rating: 4.8,
    reviews: 2341,
    deliveryTime: '18-25 min',
    deliveryFee: 1.99,
    minOrder: 12,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_197cceb39-1772091574254.png',
    imageAlt: 'Juicy smash burger with melted cheese and fresh toppings on a brioche bun',
    tags: ['POPULAR', 'TOP_RATED'],
    isOpen: true,
    discount: '20% OFF',
  },
];

interface RestaurantGridProps {
  onSelectRestaurant?: (restaurant: Restaurant) => void;
}

export default function RestaurantGrid({ onSelectRestaurant }: RestaurantGridProps) {
  return (
    <section>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-foreground">Restaurants Near You</h2>
        <p className="text-sm text-muted-foreground">Delivering to 123 Maple Street</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {RESTAURANTS.map((r) => (
          <div
            key={r.id}
            role="button"
            tabIndex={0}
            onClick={() => r.isOpen && onSelectRestaurant?.(r)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && r.isOpen) {
                e.preventDefault();
                onSelectRestaurant?.(r);
              }
            }}
            className={`group cursor-pointer overflow-hidden rounded-xl border border-border bg-card card-shadow transition-all duration-200 hover:card-shadow-md ${
              !r.isOpen ? 'cursor-not-allowed opacity-70' : ''
            }`}
          >
            <div className="relative h-40 overflow-hidden">
              <AppImage
                src={r.image}
                alt={r.imageAlt}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
              {r.discount && (
                <div className="absolute left-2 top-2 rounded-lg bg-customer px-2 py-1 text-xs font-bold text-white">
                  {r.discount}
                </div>
              )}
              {!r.isOpen && (
                <div className="absolute inset-0 flex items-center justify-center bg-foreground/50">
                  <span className="rounded-full bg-card px-3 py-1.5 text-xs font-bold text-foreground">
                    Closed Now
                  </span>
                </div>
              )}
            </div>
            <div className="p-3.5">
              <h3 className="mb-0.5 text-sm font-bold text-foreground">{r.name}</h3>
              <p className="mb-2 text-xs text-muted-foreground">{r.cuisine}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <Star className="h-3 w-3 fill-warning text-warning" />
                  {r.rating}
                  <span className="font-normal text-muted-foreground">
                    ({r.reviews.toLocaleString()})
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {r.deliveryTime}
                </span>
                <span className="flex items-center gap-1">
                  <Bike className="h-3 w-3" />
                  {r.deliveryFee === 0 ? 'Free' : `$${r.deliveryFee.toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
