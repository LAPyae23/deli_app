const MENU_POOL = [
  'Mohinga',
  'Shan Noodles',
  'Kyay Oh',
  'Ohno Kauk Swe',
  'Lahpet Thoke',
  'Fried Rice',
  'Chicken Burger',
  'Fried Chicken',
  'Milk Tea',
  'Mont Lone Yay Paw',
  'Shwe Yin Aye',
] as const;

export type RestaurantDemoItem = {
  name: string;
  quantity: number;
  revenue: number;
};

export type RestaurantDemoStats = {
  totalRevenue: number;
  totalOrdersCompleted: number;
  averageOrderValue: number;
  topItems: RestaurantDemoItem[];
};

export function hashString(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic, restaurant-specific demo figures for admin View Stats. */
export function mockRestaurantStats(restaurantId: string): RestaurantDemoStats {
  const h = hashString(restaurantId || 'fooddash');
  const totalOrdersCompleted = 48 + (h % 512);
  const averageOrderValue = 6800 + (h % 16200);
  const start = h % MENU_POOL.length;
  const topItems = [0, 1, 2].map((offset) => {
    const name = MENU_POOL[(start + offset) % MENU_POOL.length];
    const quantity = Math.max(12, Math.round(totalOrdersCompleted * (0.28 - offset * 0.07)));
    const unit = 1800 + ((h >> (offset * 4)) % 5200);
    return {
      name,
      quantity,
      revenue: Math.round(quantity * unit * 0.7),
    };
  });

  const totalRevenue = topItems.reduce((sum, item) => sum + item.revenue, 0);

  return {
    totalRevenue,
    totalOrdersCompleted,
    averageOrderValue,
    topItems,
  };
}
