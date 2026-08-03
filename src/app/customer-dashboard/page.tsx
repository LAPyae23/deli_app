'use client';

import React, { useState } from 'react';
import { Home, ShoppingCart, ClipboardList, MapPin, Heart, Settings, LogOut, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import AppLogo from '@/components/ui/AppLogo';
import CustomerTopbar from '@/components/CustomerTopbar';
import LiveOrderTracker from './components/LiveOrderTracker';
import RestaurantGrid from './components/RestaurantGrid';
import RestaurantMenu from './components/RestaurantMenu';
import OrderHistory from './components/OrderHistory';
import CartPanel from './components/CartPanel';
import OrderConfirmationScreen from './components/OrderConfirmationScreen';
import AddressPickerModal, { type PickedAddress } from './components/AddressPickerModal';
import type { CartItem, DeliveryAddressInfo, OrderTotals, Restaurant } from './types';

type CustomerTab = 'discover' | 'orders' | 'cart' | 'addresses' | 'favorites';

const INITIAL_CART: CartItem[] = [
  {
    id: 'cart-item-001',
    name: 'Smash Burger',
    options: 'Extra cheese, No pickles',
    unitPrice: 13.99,
    quantity: 2,
    restaurantName: 'Burger Bliss',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_197cceb39-1772091574254.png',
    imageAlt: 'Smash burger',
  },
  {
    id: 'cart-item-002',
    name: 'Truffle Fries',
    options: 'Large size',
    unitPrice: 6.49,
    quantity: 1,
    restaurantName: 'Burger Bliss',
    image: 'https://images.unsplash.com/photo-1576107233129-db4d6d4c4c0a',
    imageAlt: 'Truffle fries',
  },
  {
    id: 'cart-item-003',
    name: 'Coke Zero',
    options: 'No ice',
    unitPrice: 2.99,
    quantity: 2,
    restaurantName: 'Burger Bliss',
    image: 'https://images.unsplash.com/photo-1629203851129-c62c4c7f5d5e',
    imageAlt: 'Coke Zero',
  },
];

const DEFAULT_DELIVERY: DeliveryAddressInfo = {
  label: 'HOME',
  address: 'No. 42, Inya Road, Bahan Township, Yangon',
  detail: 'Yangon, Myanmar',
  lat: 16.8409,
  lng: 96.1735,
};

const DEFAULT_SAVED_ADDRESSES: DeliveryAddressInfo[] = [
  DEFAULT_DELIVERY,
  {
    label: 'WORK',
    address: 'Junction City, Bogyoke Aung San Rd, Pabedan, Yangon',
    detail: 'Yangon, Myanmar',
    lat: 16.7794,
    lng: 96.1566,
  },
];

interface TabContentProps {
  activeTab: CustomerTab;
  selectedRestaurant: Restaurant | null;
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onBackFromMenu: () => void;
  cartItems: CartItem[];
  updateQty: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  addToCart: (item: Omit<CartItem, 'quantity'> & { quantity: number }) => void;
  onGoDiscover: () => void;
  onGoCart: () => void;
  deliveryAddress: DeliveryAddressInfo;
  onDeliveryAddressChange: (address: DeliveryAddressInfo) => void;
  savedAddresses: DeliveryAddressInfo[];
  onAddSavedAddress: (address: DeliveryAddressInfo) => void;
  onSelectSavedAddress: (address: DeliveryAddressInfo) => void;
  removePurchasedItems: (ids: string[]) => void;
  showOrderConfirmation: boolean;
  orderTotals: OrderTotals | null;
  confirmationItems: CartItem[];
  onConfirmOrder: (totals: OrderTotals) => void;
  onBackFromConfirmation: () => void;
  onOrderSuccess: (orderNumber: string) => void;
}

function CustomerTabContent({
  activeTab,
  selectedRestaurant,
  onSelectRestaurant,
  onBackFromMenu,
  cartItems,
  updateQty,
  removeItem,
  addToCart,
  onGoDiscover,
  onGoCart,
  deliveryAddress,
  onDeliveryAddressChange,
  savedAddresses,
  onAddSavedAddress,
  onSelectSavedAddress,
  removePurchasedItems,
  showOrderConfirmation,
  orderTotals,
  confirmationItems,
  onConfirmOrder,
  onBackFromConfirmation,
  onOrderSuccess,
}: TabContentProps) {
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);

  const restaurantName =
    selectedRestaurant?.name || cartItems.find((i) => i.restaurantName)?.restaurantName;

  const cartPanel = (
    <CartPanel
      items={cartItems}
      updateQty={updateQty}
      removeItem={removeItem}
      removePurchasedItems={removePurchasedItems}
      restaurantName={restaurantName}
      deliveryAddress={deliveryAddress}
      onBack={onGoDiscover}
      onGoDiscover={onGoDiscover}
    />
  );

  // Step 2–4: dedicated invoice / confirmation screen
  if (showOrderConfirmation && orderTotals) {
    return (
      <OrderConfirmationScreen
        items={confirmationItems}
        totals={orderTotals}
        deliveryAddress={deliveryAddress}
        onDeliveryAddressChange={onDeliveryAddressChange}
        restaurantName={restaurantName}
        onBack={onBackFromConfirmation}
        onOrderSuccess={onOrderSuccess}
      />
    );
  }

  const handlePickerConfirm = (picked: PickedAddress) => {
    const next: DeliveryAddressInfo = {
      label: picked.label,
      address: picked.address,
      detail: 'Yangon, Myanmar',
      lat: picked.lat,
      lng: picked.lng,
    };
    onAddSavedAddress(next);
    onDeliveryAddressChange(next);
    toast.success('Address saved');
  };

  switch (activeTab) {
    case 'discover':
      if (selectedRestaurant) {
        return (
          <div className="flex flex-col lg:flex-row gap-0 min-w-0 flex-1 -m-4 sm:-m-6 xl:-m-8">
            <div className="flex-1 min-w-0 p-4 sm:p-6 xl:p-8">
              <RestaurantMenu
                restaurant={selectedRestaurant}
                onBack={onBackFromMenu}
                onAddToCart={addToCart}
              />
            </div>
            <div className="hidden lg:block">{cartPanel}</div>
          </div>
        );
      }
      return (
        <>
          <LiveOrderTracker />
          <RestaurantGrid onSelectRestaurant={onSelectRestaurant} />
        </>
      );
    case 'orders':
      return <OrderHistory />;
    case 'cart':
      return (
        <div className="flex flex-col items-stretch max-w-lg mx-auto w-full min-w-0">
          {cartPanel}
        </div>
      );
    case 'addresses':
      return (
        <>
          <div className="bg-card rounded-2xl border border-border p-6 sm:p-8">
            <div className="text-center mb-6">
              <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-1">Saved Addresses</h3>
              <p className="text-muted-foreground text-sm">
                Manage delivery locations around Yangon, Myanmar.
              </p>
            </div>

            <div className="space-y-3 text-left max-w-md mx-auto">
              {savedAddresses.map((a) => {
                const isActive =
                  a.lat === deliveryAddress.lat &&
                  a.lng === deliveryAddress.lng &&
                  a.label === deliveryAddress.label;
                return (
                  <button
                    key={`${a.label}-${a.lat}-${a.lng}`}
                    type="button"
                    onClick={() => {
                      onSelectSavedAddress(a);
                      toast.success(`Delivering to ${a.label}`);
                    }}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'bg-orange-50 border-customer'
                        : 'bg-muted/50 border-border hover:border-customer/40'
                    }`}
                  >
                    <MapPin className="w-4 h-4 flex-shrink-0 text-customer" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-muted-foreground">{a.label}</p>
                      <p className="text-sm font-medium truncate">{a.address}</p>
                    </div>
                    {isActive && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-customer bg-white px-2 py-1 rounded-full border border-customer/30">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setAddressPickerOpen(true)}
                className="btn-primary w-full py-3 justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Address on Map
              </button>
            </div>
          </div>

          <AddressPickerModal
            isOpen={addressPickerOpen}
            onClose={() => setAddressPickerOpen(false)}
            onConfirm={handlePickerConfirm}
            initialPosition={
              deliveryAddress.lat && deliveryAddress.lng
                ? { lat: deliveryAddress.lat, lng: deliveryAddress.lng }
                : undefined
            }
          />
        </>
      );
    case 'favorites':
      return (
        <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 text-center">
          <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-1">Favorite Restaurants</h3>
          <p className="text-muted-foreground text-sm">Your saved restaurants will appear here.</p>
        </div>
      );
    default:
      return null;
  }
}

export default function CustomerDashboardPage() {
  const [activeTab, setActiveTab] = useState<CustomerTab>('discover');
  const [collapsed, setCollapsed] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>(INITIAL_CART);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressInfo>(DEFAULT_DELIVERY);
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddressInfo[]>(DEFAULT_SAVED_ADDRESSES);
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
  const [orderTotals, setOrderTotals] = useState<OrderTotals | null>(null);
  const [confirmationItems, setConfirmationItems] = useState<CartItem[]>([]);

  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  const updateQty = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (id: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  };

  const addToCart = (item: Omit<CartItem, 'quantity'> & { quantity: number }) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
        );
      }
      return [...prev, item];
    });
    setActiveTab('cart');
    setShowOrderConfirmation(false);
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const removePurchasedItems = (ids: string[]) => {
    setCartItems((prev) => prev.filter((i) => !ids.includes(i.id)));
  };

  const handleConfirmOrder = (totals: OrderTotals) => {
    setConfirmationItems([...cartItems]);
    setOrderTotals(totals);
    setShowOrderConfirmation(true);
  };

  const handleBackFromConfirmation = () => {
    setShowOrderConfirmation(false);
  };

  const handleOrderSuccess = (_orderNumber: string) => {
    clearCart();
    setShowOrderConfirmation(false);
    setOrderTotals(null);
    setConfirmationItems([]);
    setSelectedRestaurant(null);
    setActiveTab('discover');
  };

  const handleAddSavedAddress = (address: DeliveryAddressInfo) => {
    setSavedAddresses((prev) => {
      const exists = prev.some((a) => a.lat === address.lat && a.lng === address.lng);
      if (exists) return prev;
      return [...prev, address];
    });
  };

  const navItems: {
    key: string;
    tab: CustomerTab;
    icon: React.ElementType;
    label: string;
    badge: string | null;
  }[] = [
    { key: 'nav-home', tab: 'discover', icon: Home, label: 'Discover', badge: null },
    { key: 'nav-orders', tab: 'orders', icon: ClipboardList, label: 'My Orders', badge: '1' },
    {
      key: 'nav-cart',
      tab: 'cart',
      icon: ShoppingCart,
      label: 'Cart',
      badge: cartCount > 0 ? String(cartCount) : null,
    },
    { key: 'nav-addresses', tab: 'addresses', icon: MapPin, label: 'Addresses', badge: null },
    { key: 'nav-favorites', tab: 'favorites', icon: Heart, label: 'Favorites', badge: null },
  ];

  const handleTabChange = (tab: CustomerTab) => {
    setActiveTab(tab);
    setShowOrderConfirmation(false);
    if (tab !== 'discover' && tab !== 'cart') {
      setSelectedRestaurant(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={`hidden md:flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-60'
        } min-h-screen relative flex-shrink-0`}
      >
        <div
          className={`flex items-center border-b border-border h-16 px-4 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {!collapsed && (
            <div className="flex items-center gap-2">
              <AppLogo size={28} />
              <span className="font-bold text-base tracking-tight">FoodDash</span>
            </div>
          )}
          {collapsed && <AppLogo size={28} />}
          <button
            onClick={() => setCollapsed((p) => !p)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
          {!collapsed && <p className="section-label px-3 mb-2 mt-1">Menu</p>}
          {navItems.map((item) => {
            const isActive = activeTab === item.tab && !showOrderConfirmation;
            return (
              <button
                key={item.key}
                onClick={() => handleTabChange(item.tab)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive ? 'nav-item-active bg-orange-50 text-customer' : 'nav-item'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className="min-w-[20px] h-5 flex items-center justify-center bg-customer text-white text-xs font-bold rounded-full px-1.5">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={() => handleTabChange('discover')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium nav-item ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Settings</span>}
          </button>
          <a
            href="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium nav-item ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </a>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <CustomerTopbar />
        <main
          className={`flex-1 overflow-y-auto min-w-0 pb-20 md:pb-6 ${
            activeTab === 'discover' && selectedRestaurant && !showOrderConfirmation
              ? ''
              : 'p-4 sm:p-6 xl:p-8 space-y-6 sm:space-y-8'
          }`}
        >
          <CustomerTabContent
            activeTab={activeTab}
            selectedRestaurant={selectedRestaurant}
            onSelectRestaurant={setSelectedRestaurant}
            onBackFromMenu={() => setSelectedRestaurant(null)}
            cartItems={cartItems}
            updateQty={updateQty}
            removeItem={removeItem}
            addToCart={addToCart}
            onGoDiscover={() => {
              setActiveTab('discover');
              setShowOrderConfirmation(false);
            }}
            onGoCart={() => {
              setActiveTab('cart');
              setShowOrderConfirmation(false);
            }}
            deliveryAddress={deliveryAddress}
            onDeliveryAddressChange={setDeliveryAddress}
            savedAddresses={savedAddresses}
            onAddSavedAddress={handleAddSavedAddress}
            onSelectSavedAddress={setDeliveryAddress}
            removePurchasedItems={removePurchasedItems}
            showOrderConfirmation={showOrderConfirmation}
            orderTotals={orderTotals}
            confirmationItems={confirmationItems}
            onConfirmOrder={handleConfirmOrder}
            onBackFromConfirmation={handleBackFromConfirmation}
            onOrderSuccess={handleOrderSuccess}
          />
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex items-center justify-around px-2 py-1 safe-area-pb">
        {navItems.map((item) => {
          const isActive = activeTab === item.tab && !showOrderConfirmation;
          return (
            <button
              key={`mobile-${item.key}`}
              onClick={() => handleTabChange(item.tab)}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-150 min-w-0 flex-1 ${
                isActive ? 'text-customer' : 'text-muted-foreground'
              }`}
            >
              <div className="relative">
                <item.icon
                  className={`w-5 h-5 ${isActive ? 'text-customer' : 'text-muted-foreground'}`}
                />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center bg-customer text-white text-[10px] font-bold rounded-full px-1">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-semibold leading-tight truncate w-full text-center ${
                  isActive ? 'text-customer' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-customer rounded-full" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
