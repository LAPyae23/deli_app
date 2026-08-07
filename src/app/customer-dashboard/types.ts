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
  discount: string | null;
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
  addons?: { name: string; extraPrice: number }[];
};

export type ParcelStatus = 'DRAFT' | 'SCHEDULED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED';
export type ParcelSize = 'Envelope' | 'Small' | 'Medium';

export type CustomerParcel = {
  id: string;
  ref: string;
  pickupLocation: string;
  pickupAddress: string;
  dropoffLocation: string;
  dropoffAddress: string;
  recipientName: string;
  status: ParcelStatus;
  timeWindow: string;
  fee: number;
  size: ParcelSize;
  notes?: string;
};
