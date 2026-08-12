export type CartItem = {
  id: string;
  name: string;
  options: string;
  unitPrice: number;
  quantity: number;
  restaurantName?: string;
  image?: string;
  imageAlt?: string;
  note?: string;
};

export type DeliveryAddressInfo = {
  label: string;
  address: string;
  detail?: string;
  lat?: number;
  lng?: number;
};

export type OrderTotals = {
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  discount: number;
  tax: number;
  total: number;
  promoApplied: boolean;
};

export type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  reviews: number;
  deliveryTime: string;
  deliveryFee: number;
  minOrder: number;
  image: string;
  imageAlt: string;
  tags: string[];
  isOpen: boolean;
  storeStatus?: 'OPEN' | 'BUSY' | 'CLOSED';
  discount: string | null;
  lat?: number;
  lng?: number;
  location?: { lat?: number; lng?: number };
  distanceKm?: number;
};

export type MenuItem = {
  id: string;
  /** MongoDB document id when loaded from /api/menu */
  _id?: string;
  name: string;
  description: string;
  price: number;
  rating: number;
  image: string;
  imageAlt: string;
  category: string;
  popular?: boolean;
  restaurantId?: string;
  isAvailable?: boolean;
  stockQuantity?: number;
  addons?: { name: string; extraPrice: number }[];
};
