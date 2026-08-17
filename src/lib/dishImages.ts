/** Dish-specific Unsplash photos for seed + AI Picks cards */

const DISH_IMAGES: Record<string, string> = {
  mohinga:
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
  'shan noodles':
    'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'kyay oh':
    'https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=400&q=80',
  'ohno kauk swe':
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
  'lahpet thoke':
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80',
  'fried rice':
    'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
  'chicken burger':
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
  burger:
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
  'fried chicken':
    'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?auto=format&fit=crop&w=400&q=80',
  'milk tea':
    'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=400&q=80',
  'lahpet yay':
    'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=400&q=80',
  cola: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=400&q=80',
  'mont lone yay paw':
    'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=400&q=80',
  'shwe yin aye':
    'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=400&q=80',
  fries:
    'https://images.unsplash.com/photo-1573080494122-bdae4b0c0d4d?auto=format&fit=crop&w=400&q=80',
  fritters:
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=80',
};

const FALLBACK_FOOD =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80';

export function getDishImage(name?: string): string {
  const key = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!key) return FALLBACK_FOOD;
  if (DISH_IMAGES[key]) return DISH_IMAGES[key];
  for (const [dish, url] of Object.entries(DISH_IMAGES)) {
    if (key.includes(dish) || dish.includes(key)) return url;
  }
  return FALLBACK_FOOD;
}

export const AI_PICKS_FALLBACK_ITEMS = [
  {
    name: 'Mohinga',
    category: 'Burmese',
    price: 3500,
    image: getDishImage('Mohinga'),
    reasonTag: 'rain',
  },
  {
    name: 'Kyay Oh',
    category: 'Burmese',
    price: 4500,
    image: getDishImage('Kyay Oh'),
    reasonTag: 'rain',
  },
  {
    name: 'Shan Noodles',
    category: 'Burmese',
    price: 4000,
    image: getDishImage('Shan Noodles'),
    reasonTag: 'hlaing',
  },
  {
    name: 'Lahpet Thoke',
    category: 'Burmese',
    price: 3000,
    image: getDishImage('Lahpet Thoke'),
    reasonTag: 'spicy',
  },
  {
    name: 'Fried Chicken',
    category: 'Fast Food',
    price: 4200,
    image: getDishImage('Fried Chicken'),
    reasonTag: 'spicy',
  },
  {
    name: 'Chicken Burger',
    category: 'Fast Food',
    price: 5000,
    image: getDishImage('Chicken Burger'),
    reasonTag: 'spicy',
  },
  {
    name: 'Cola',
    category: 'Drinks',
    price: 1200,
    image: getDishImage('Cola'),
    reasonTag: 'Sunny',
  },
  {
    name: 'Shwe Yin Aye',
    category: 'Dessert',
    price: 2800,
    image: getDishImage('Shwe Yin Aye'),
    reasonTag: 'Sunny',
  },
  {
    name: 'Milk Tea',
    category: 'Drinks',
    price: 1500,
    image: getDishImage('Milk Tea'),
    reasonTag: 'Sunny',
  },
] as const;
