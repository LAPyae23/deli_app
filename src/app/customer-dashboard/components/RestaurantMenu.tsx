'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Star, Clock, Bike, Plus } from 'lucide-react';
import { toast } from 'sonner';
import AppImage from '@/components/ui/AppImage';
import MenuItemModal from './MenuItemModal';
import type { CartItem, MenuItem, Restaurant } from '../types';

const MENU_BY_RESTAURANT: Record<string, MenuItem[]> = {
  'rest-001': [
    {
      id: 'menu-001-1',
      name: 'Smash Burger',
      description: 'Double smashed beef patties, American cheese, pickles, onions, and special sauce on a toasted brioche bun.',
      price: 13.99,
      rating: 4.9,
      image: 'https://img.rocket.new/generatedImages/rocket_gen_img_197cceb39-1772091574254.png',
      imageAlt: 'Juicy smash burger with melted cheese',
      category: 'Popular',
      popular: true,
    },
    {
      id: 'menu-001-2',
      name: 'Truffle Fries',
      description: 'Crispy shoestring fries tossed in truffle oil, parmesan, and fresh herbs.',
      price: 6.49,
      rating: 4.7,
      image: 'https://images.unsplash.com/photo-1576107233129-db4d6d4c4c0a',
      imageAlt: 'Crispy truffle fries with parmesan',
      category: 'Popular',
      popular: true,
    },
    {
      id: 'menu-001-3',
      name: 'Classic Cheeseburger',
      description: 'Angus beef patty, cheddar, lettuce, tomato, and house mayo on a soft sesame bun.',
      price: 11.99,
      rating: 4.6,
      image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd',
      imageAlt: 'Classic cheeseburger with fresh toppings',
      category: 'Main Menu',
    },
    {
      id: 'menu-001-4',
      name: 'BBQ Bacon Burger',
      description: 'Smoky BBQ sauce, crispy bacon, cheddar, and onion rings stacked high.',
      price: 14.49,
      rating: 4.8,
      image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b',
      imageAlt: 'BBQ bacon burger with onion rings',
      category: 'Main Menu',
    },
    {
      id: 'menu-001-5',
      name: 'Crispy Chicken Sandwich',
      description: 'Buttermilk fried chicken, spicy mayo, pickles, and slaw on a brioche bun.',
      price: 12.49,
      rating: 4.5,
      image: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086',
      imageAlt: 'Crispy fried chicken sandwich',
      category: 'Main Menu',
    },
    {
      id: 'menu-001-6',
      name: 'Coke Zero',
      description: 'Ice-cold Coke Zero — refreshingly crisp with zero sugar.',
      price: 2.99,
      rating: 4.3,
      image: 'https://images.unsplash.com/photo-1629203851129-c62c4c7f5d5e',
      imageAlt: 'Cold Coke Zero drink',
      category: 'Drinks',
    },
  ],
  'rest-002': [
    {
      id: 'menu-002-1',
      name: 'Tonkotsu Ramen',
      description: 'Rich pork bone broth, chashu, soft-boiled egg, nori, and fresh scallions.',
      price: 15.99,
      rating: 4.9,
      image: 'https://img.rocket.new/generatedImages/rocket_gen_img_16fa22663-1772767892756.png',
      imageAlt: 'Tonkotsu ramen bowl',
      category: 'Popular',
      popular: true,
    },
    {
      id: 'menu-002-2',
      name: 'Spicy Miso Ramen',
      description: 'Bold miso broth with chili oil, corn, butter, and ground pork.',
      price: 14.99,
      rating: 4.7,
      image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624',
      imageAlt: 'Spicy miso ramen',
      category: 'Popular',
      popular: true,
    },
    {
      id: 'menu-002-3',
      name: 'Gyoza (6 pcs)',
      description: 'Pan-fried pork and cabbage dumplings with ponzu dipping sauce.',
      price: 7.99,
      rating: 4.6,
      image: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c',
      imageAlt: 'Pan-fried gyoza dumplings',
      category: 'Main Menu',
    },
    {
      id: 'menu-002-4',
      name: 'Chicken Katsu Curry',
      description: 'Crispy chicken cutlet over rice with mild Japanese curry sauce.',
      price: 13.49,
      rating: 4.5,
      image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d',
      imageAlt: 'Chicken katsu curry over rice',
      category: 'Main Menu',
    },
  ],
  'rest-003': [
    {
      id: 'menu-003-1',
      name: 'Harvest Grain Bowl',
      description: 'Quinoa, roasted veggies, avocado, chickpeas, and tahini lemon dressing.',
      price: 12.99,
      rating: 4.8,
      image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1d6965a2e-1772054986882.png',
      imageAlt: 'Colorful vegan grain bowl',
      category: 'Popular',
      popular: true,
    },
    {
      id: 'menu-003-2',
      name: 'Kale Caesar Salad',
      description: 'Massaged kale, crispy chickpeas, vegan parmesan, and cashew Caesar.',
      price: 10.99,
      rating: 4.5,
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd',
      imageAlt: 'Fresh kale Caesar salad',
      category: 'Popular',
      popular: true,
    },
    {
      id: 'menu-003-3',
      name: 'Sweet Potato Wrap',
      description: 'Roasted sweet potato, black beans, greens, and chipotle aioli in a spinach wrap.',
      price: 11.49,
      rating: 4.4,
      image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f',
      imageAlt: 'Vegan sweet potato wrap',
      category: 'Main Menu',
    },
  ],
  'rest-004': [
    {
      id: 'menu-004-1',
      name: 'Chicken Biryani',
      description: 'Fragrant basmati rice layered with spiced chicken, saffron, and caramelized onions.',
      price: 16.99,
      rating: 4.9,
      image: 'https://images.unsplash.com/photo-1680359870819-22556317ce22',
      imageAlt: 'Aromatic chicken biryani',
      category: 'Popular',
      popular: true,
    },
    {
      id: 'menu-004-2',
      name: 'Butter Chicken',
      description: 'Tender chicken in a creamy tomato butter sauce, served with basmati rice.',
      price: 15.49,
      rating: 4.8,
      image: 'https://images.unsplash.com/photo-1603894584372-c69e32b9f8e1',
      imageAlt: 'Butter chicken curry',
      category: 'Popular',
      popular: true,
    },
    {
      id: 'menu-004-3',
      name: 'Garlic Naan',
      description: 'Soft tandoor-baked flatbread brushed with garlic butter and cilantro.',
      price: 3.99,
      rating: 4.7,
      image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950',
      imageAlt: 'Fresh garlic naan bread',
      category: 'Main Menu',
    },
  ],
  'rest-005': [
    {
      id: 'menu-005-1',
      name: 'Truffle Tagliatelle',
      description: 'House-made tagliatelle in truffle cream sauce with shaved parmesan.',
      price: 17.99,
      rating: 4.7,
      image: 'https://images.unsplash.com/photo-1600028035416-b778fabc4f73',
      imageAlt: 'Tagliatelle with truffle cream',
      category: 'Popular',
      popular: true,
    },
    {
      id: 'menu-005-2',
      name: 'Margherita Pizza',
      description: 'San Marzano tomato, fresh mozzarella, basil, and extra virgin olive oil.',
      price: 14.99,
      rating: 4.6,
      image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002',
      imageAlt: 'Margherita pizza',
      category: 'Main Menu',
    },
  ],
  'rest-006': [
    {
      id: 'menu-006-1',
      name: 'Gochujang Wings',
      description: 'Twice-fried wings glazed in spicy-sweet gochujang sauce.',
      price: 13.99,
      rating: 4.8,
      image: 'https://img.rocket.new/generatedImages/rocket_gen_img_123eb88d3-1783610009334.png',
      imageAlt: 'Korean fried chicken wings',
      category: 'Popular',
      popular: true,
    },
    {
      id: 'menu-006-2',
      name: 'Yangnyeom Chicken',
      description: 'Crispy boneless chicken coated in sweet and spicy Korean glaze.',
      price: 14.49,
      rating: 4.7,
      image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec',
      imageAlt: 'Yangnyeom fried chicken',
      category: 'Main Menu',
    },
  ],
  'rest-007': [
    {
      id: 'menu-007-1',
      name: 'Mezze Platter',
      description: 'Hummus, falafel, tabbouleh, baba ganoush, and warm pita bread.',
      price: 18.99,
      rating: 4.7,
      image: 'https://images.unsplash.com/photo-1589926195968-5ec48a3ec91d',
      imageAlt: 'Assorted mezze platter',
      category: 'Popular',
      popular: true,
    },
    {
      id: 'menu-007-2',
      name: 'Chicken Shawarma Wrap',
      description: 'Marinated chicken, pickles, garlic sauce, and fries wrapped in lavash.',
      price: 11.99,
      rating: 4.6,
      image: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783',
      imageAlt: 'Chicken shawarma wrap',
      category: 'Main Menu',
    },
  ],
  'rest-008': [
    {
      id: 'menu-008-1',
      name: 'Carne Asada Tacos',
      description: 'Three street tacos with grilled steak, cilantro, onion, and salsa verde.',
      price: 12.99,
      rating: 4.6,
      image: 'https://images.unsplash.com/photo-1726165441626-9c5bec68b947',
      imageAlt: 'Carne asada street tacos',
      category: 'Popular',
      popular: true,
    },
    {
      id: 'menu-008-2',
      name: 'Burrito Bowl',
      description: 'Cilantro rice, black beans, grilled chicken, pico, guac, and chipotle crema.',
      price: 13.49,
      rating: 4.5,
      image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f',
      imageAlt: 'Loaded burrito bowl',
      category: 'Main Menu',
    },
  ],
};

const FALLBACK_MENU: MenuItem[] = [
  {
    id: 'menu-fallback-1',
    name: 'Chef Special',
    description: 'A seasonal favorite prepared fresh by our kitchen.',
    price: 12.99,
    rating: 4.5,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
    imageAlt: 'Chef special dish',
    category: 'Popular',
    popular: true,
  },
];

interface RestaurantMenuProps {
  restaurant: Restaurant;
  onBack: () => void;
  onAddToCart: (item: Omit<CartItem, 'quantity'> & { quantity: number }) => void;
}

export default function RestaurantMenu({ restaurant, onBack, onAddToCart }: RestaurantMenuProps) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(
    () => MENU_BY_RESTAURANT[restaurant.id] ?? FALLBACK_MENU
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      try {
        const res = await fetch(`/api/menu-items?restaurantId=${encodeURIComponent(restaurant.id)}`);
        const data = await res.json();
        if (!res.ok || !data.success || !data.items?.length) {
          if (!cancelled) {
            setMenuItems(MENU_BY_RESTAURANT[restaurant.id] ?? FALLBACK_MENU);
          }
          return;
        }
        if (cancelled) return;
        const mapped: MenuItem[] = data.items
          .filter((item: { isAvailable?: boolean }) => item.isAvailable !== false)
          .map((item: {
            id: string;
            name: string;
            description: string;
            price: number;
            rating?: number;
            image: string;
            imageAlt: string;
            category: string;
            popular?: boolean;
            isPopular?: boolean;
          }) => ({
            id: item.id,
            name: item.name,
            description: item.description || '',
            price: item.price,
            rating: item.rating ?? 4.5,
            image: item.image || restaurant.image,
            imageAlt: item.imageAlt || item.name,
            category: item.category || 'Main Menu',
            popular: Boolean(item.popular || item.isPopular),
          }));
        setMenuItems(mapped.length ? mapped : (MENU_BY_RESTAURANT[restaurant.id] ?? FALLBACK_MENU));
      } catch {
        if (!cancelled) {
          setMenuItems(MENU_BY_RESTAURANT[restaurant.id] ?? FALLBACK_MENU);
        }
      }
    }

    loadMenu();
    return () => {
      cancelled = true;
    };
  }, [restaurant.id, restaurant.image]);

  const categories = useMemo(() => {
    const order = ['Popular', 'Main Menu', 'Drinks'];
    const present = [...new Set(menuItems.map((i) => i.category))];
    return [
      ...order.filter((c) => present.includes(c)),
      ...present.filter((c) => !order.includes(c)),
    ];
  }, [menuItems]);

  const handleAddToCart = (item: MenuItem, quantity: number) => {
    onAddToCart({
      id: item.id,
      name: item.name,
      options: item.category,
      unitPrice: item.price,
      quantity,
      restaurantName: restaurant.name,
      image: item.image,
      imageAlt: item.imageAlt,
    });
    toast.success(`${item.name} added to cart`);
  };

  return (
    <section className="min-w-0">
      {/* Cover + header */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-6">
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
            onClick={onBack}
            className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center gap-1.5 px-3 py-2 rounded-full bg-card/95 backdrop-blur-sm text-sm font-semibold text-foreground hover:bg-card transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Shop
          </button>
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 drop-shadow-sm">
              {restaurant.name}
            </h1>
            <p className="text-sm text-white/85 mb-2">{restaurant.cuisine}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-white/90">
              <span className="flex items-center gap-1 font-semibold">
                <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                {restaurant.rating}
                <span className="font-normal opacity-80">({restaurant.reviews.toLocaleString()})</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {restaurant.deliveryTime}
              </span>
              <span className="flex items-center gap-1">
                <Bike className="w-3.5 h-3.5" />
                {restaurant.deliveryFee === 0 ? 'Free delivery' : `$${restaurant.deliveryFee.toFixed(2)} delivery`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Categorized menu */}
      <div className="space-y-8">
        {categories.map((category) => {
          const items = menuItems.filter((i) => i.category === category);
          return (
            <div key={category}>
              <h2 className="text-lg font-bold text-foreground mb-3">{category}</h2>
              <div className="space-y-3">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="w-full flex items-stretch gap-3 p-3 sm:p-4 bg-card border border-border rounded-xl text-left hover:border-customer/40 hover:card-shadow-md transition-all duration-200 group"
                  >
                    <div className="flex-1 min-w-0 py-0.5">
                      <h3 className="font-bold text-sm sm:text-base text-foreground mb-0.5 group-hover:text-customer transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-2">
                        {item.description}
                      </p>
                      <p className="text-sm font-bold font-tabular text-foreground">
                        ${item.price.toFixed(2)}
                      </p>
                    </div>
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-xl overflow-hidden">
                      <AppImage
                        src={item.image}
                        alt={item.imageAlt}
                        fill
                        className="object-cover"
                        sizes="112px"
                      />
                      <span
                        role="presentation"
                        className="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-customer group-hover:bg-customer group-hover:text-white group-hover:border-customer transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <MenuItemModal
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onAddToCart={handleAddToCart}
      />
    </section>
  );
}
