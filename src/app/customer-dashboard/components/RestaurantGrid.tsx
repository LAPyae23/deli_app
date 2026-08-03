'use client';

import React, { useState } from 'react';
import { Star, Clock, Bike, Leaf, Funnel, ChevronDown } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import type { Restaurant } from '../types';

const FILTERS = [
{ key: 'filter-all', label: 'All', value: 'all' },
{ key: 'filter-fast', label: 'Fast Delivery', value: 'fast' },
{ key: 'filter-top', label: 'Top Rated', value: 'top' },
{ key: 'filter-vegan', label: 'Vegan', value: 'vegan' },
{ key: 'filter-halal', label: 'Halal', value: 'halal' },
{ key: 'filter-new', label: 'New', value: 'new' }];


export const RESTAURANTS: Restaurant[] = [
{
  id: 'rest-001',
  name: 'Burger Bliss',
  cuisine: 'American · Burgers',
  rating: 4.8,
  reviews: 2341,
  deliveryTime: '18-25 min',
  deliveryFee: 1.99,
  minOrder: 12,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_197cceb39-1772091574254.png",
  imageAlt: 'Juicy smash burger with melted cheese and fresh toppings on a brioche bun',
  tags: ['POPULAR', 'TOP_RATED'],
  isOpen: true,
  discount: '20% OFF'
},
{
  id: 'rest-002',
  name: 'Sakura Ramen House',
  cuisine: 'Japanese · Ramen · Noodles',
  rating: 4.7,
  reviews: 1876,
  deliveryTime: '25-35 min',
  deliveryFee: 2.49,
  minOrder: 15,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_16fa22663-1772767892756.png",
  imageAlt: 'Rich tonkotsu ramen bowl with soft-boiled egg, nori, and chashu pork',
  tags: ['NEW'],
  isOpen: true,
  discount: null
},
{
  id: 'rest-003',
  name: 'Verde Kitchen',
  cuisine: 'Vegan · Bowls · Salads',
  rating: 4.6,
  reviews: 943,
  deliveryTime: '15-20 min',
  deliveryFee: 0.99,
  minOrder: 10,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1d6965a2e-1772054986882.png",
  imageAlt: 'Colorful vegan grain bowl with roasted vegetables, avocado, and tahini dressing',
  tags: ['VEGAN', 'FAST'],
  isOpen: true,
  discount: null
},
{
  id: 'rest-004',
  name: 'Spice Route',
  cuisine: 'Indian · Curry · Biryani',
  rating: 4.9,
  reviews: 3102,
  deliveryTime: '30-40 min',
  deliveryFee: 1.49,
  minOrder: 18,
  image: "https://images.unsplash.com/photo-1680359870819-22556317ce22",
  imageAlt: 'Aromatic chicken biryani served with raita and pickled onions in a clay pot',
  tags: ['HALAL', 'TOP_RATED'],
  isOpen: true,
  discount: 'Free delivery'
},
{
  id: 'rest-005',
  name: 'The Pasta Lab',
  cuisine: 'Italian · Pasta · Pizza',
  rating: 4.5,
  reviews: 1234,
  deliveryTime: '20-30 min',
  deliveryFee: 1.99,
  minOrder: 14,
  image: "https://images.unsplash.com/photo-1600028035416-b778fabc4f73",
  imageAlt: 'Fresh tagliatelle pasta with truffle cream sauce and parmesan shavings',
  tags: ['POPULAR'],
  isOpen: false,
  discount: null
},
{
  id: 'rest-006',
  name: 'Crispy Seoul',
  cuisine: 'Korean · Fried Chicken',
  rating: 4.7,
  reviews: 2088,
  deliveryTime: '22-32 min',
  deliveryFee: 1.49,
  minOrder: 13,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_123eb88d3-1783610009334.png",
  imageAlt: 'Crispy Korean fried chicken wings glazed in spicy gochujang sauce',
  tags: ['POPULAR', 'NEW'],
  isOpen: true,
  discount: '15% OFF'
},
{
  id: 'rest-007',
  name: 'Mezze & Co.',
  cuisine: 'Mediterranean · Lebanese',
  rating: 4.6,
  reviews: 876,
  deliveryTime: '20-28 min',
  deliveryFee: 2.99,
  minOrder: 20,
  image: "https://images.unsplash.com/photo-1589926195968-5ec48a3ec91d",
  imageAlt: 'Assorted mezze platter with hummus, falafel, tabbouleh, and warm pita bread',
  tags: ['HALAL'],
  isOpen: true,
  discount: null
},
{
  id: 'rest-008',
  name: 'Taco Loco',
  cuisine: 'Mexican · Tacos · Burritos',
  rating: 4.4,
  reviews: 1567,
  deliveryTime: '15-22 min',
  deliveryFee: 0.99,
  minOrder: 10,
  image: "https://images.unsplash.com/photo-1726165441626-9c5bec68b947",
  imageAlt: 'Three street tacos with grilled carne asada, fresh cilantro, and lime wedges',
  tags: ['FAST'],
  isOpen: true,
  discount: null
}];


interface RestaurantGridProps {
  onSelectRestaurant?: (restaurant: Restaurant) => void;
}

export default function RestaurantGrid({ onSelectRestaurant }: RestaurantGridProps) {
  const [activeFilter, setActiveFilter] = useState('all');

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Restaurants Near You</h2>
          <p className="text-sm text-muted-foreground">Delivering to 123 Maple Street</p>
        </div>
        <button className="btn-secondary gap-2 text-xs">
          <Funnel className="w-3.5 h-3.5" />
          Filters
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Filter chips */}
      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide pb-1">
        {FILTERS?.map((f) =>
        <button
          key={f?.key}
          onClick={() => setActiveFilter(f?.value)}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-150 ${
          activeFilter === f?.value ?
          'bg-customer text-white' : 'bg-card border border-border text-muted-foreground hover:border-customer hover:text-customer'}`
          }>
          
            {f?.label}
          </button>
        )}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
        {RESTAURANTS?.map((r) =>
        <div
          key={r?.id}
          role="button"
          tabIndex={0}
          onClick={() => r?.isOpen && onSelectRestaurant?.(r)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && r?.isOpen) {
              e.preventDefault();
              onSelectRestaurant?.(r);
            }
          }}
          className={`bg-card border border-border rounded-xl overflow-hidden card-shadow group cursor-pointer hover:card-shadow-md transition-all duration-200 ${!r?.isOpen ? 'opacity-70 cursor-not-allowed' : ''}`}>
          
            <div className="relative h-40 overflow-hidden">
              <AppImage
              src={r?.image}
              alt={r?.imageAlt}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
            
              {r?.discount &&
            <div className="absolute top-2 left-2 bg-customer text-white text-xs font-bold px-2 py-1 rounded-lg">
                  {r?.discount}
                </div>
            }
              {!r?.isOpen &&
            <div className="absolute inset-0 bg-foreground/50 flex items-center justify-center">
                  <span className="bg-card text-foreground text-xs font-bold px-3 py-1.5 rounded-full">Closed Now</span>
                </div>
            }
              {r?.tags?.includes('VEGAN') &&
            <div className="absolute top-2 right-2 w-7 h-7 bg-success rounded-full flex items-center justify-center">
                  <Leaf className="w-3.5 h-3.5 text-white" />
                </div>
            }
            </div>
            <div className="p-3.5">
              <h3 className="font-bold text-sm text-foreground mb-0.5">{r?.name}</h3>
              <p className="text-xs text-muted-foreground mb-2">{r?.cuisine}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <Star className="w-3 h-3 text-warning fill-warning" />
                  {r?.rating}
                  <span className="text-muted-foreground font-normal">({r?.reviews?.toLocaleString()})</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {r?.deliveryTime}
                </span>
                <span className="flex items-center gap-1">
                  <Bike className="w-3 h-3" />
                  {r?.deliveryFee === 0 ? 'Free' : `$${r?.deliveryFee?.toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>);

}