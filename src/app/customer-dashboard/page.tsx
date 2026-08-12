'use client';

import React, { useState, useEffect } from 'react';
import { Home, ShoppingCart, ClipboardList, LogOut, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { toast } from 'sonner';
import AppLogo from '@/components/ui/AppLogo';
import CustomerTopbar from '@/components/CustomerTopbar';
import ThemeToggle from '@/components/ThemeToggle';
import LiveOrderTracker from './components/LiveOrderTracker';
import RestaurantGrid from './components/RestaurantGrid';
import RestaurantMenu from './components/RestaurantMenu';
import OrderHistory from './components/OrderHistory';
import CartPanel from './components/CartPanel';
import OrderConfirmationScreen from './components/OrderConfirmationScreen';
import AddressPickerModal, { type PickedAddress } from './components/AddressPickerModal';
import CustomerProfile from './components/CustomerProfile';
import AIRecommendations, { type AiLane } from './components/AIRecommendations';
import { useRouter } from 'next/navigation';
import type { CartItem, DeliveryAddressInfo, OrderTotals, Restaurant } from './types';

type CustomerTab = 'discover' | 'orders' | 'cart' | 'profile';

const CART_STORAGE_KEY = 'fooddash-customer-cart';

type CustomerUser = {
  firstName: string;
  lastName: string;
  profileImage: string;
};

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Customer', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

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
  onRemoveSavedAddress: (address: DeliveryAddressInfo) => void;
  onSelectSavedAddress: (address: DeliveryAddressInfo) => void;
  removePurchasedItems: (ids: string[]) => void;
  showOrderConfirmation: boolean;
  orderTotals: OrderTotals | null;
  confirmationItems: CartItem[];
  onConfirmOrder: (totals: OrderTotals) => void;
  onBackFromConfirmation: () => void;
  onOrderSuccess: (orderId: string) => void;
  onProfileUpdate: (userData: CustomerUser) => void;
  activeOrderId: string | null;
  onClearActiveOrder: () => void;
  onRateRestaurant: (restaurantName: string) => void;
  searchQuery: string;
  onOpenAiPicks: (lane: AiLane) => void;
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
  onRemoveSavedAddress,
  onSelectSavedAddress,
  removePurchasedItems,
  showOrderConfirmation,
  orderTotals,
  confirmationItems,
  onConfirmOrder,
  onBackFromConfirmation,
  onOrderSuccess,
  onProfileUpdate,
  activeOrderId,
  onClearActiveOrder,
  onRateRestaurant,
  searchQuery,
  onOpenAiPicks,
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
      addToCart={addToCart}
      restaurantName={restaurantName}
      deliveryAddress={deliveryAddress}
      savedAddresses={savedAddresses}
      onDeliveryAddressChange={onDeliveryAddressChange}
      onOpenAddressPicker={() => setAddressPickerOpen(true)}
      onBack={onGoDiscover}
      onGoDiscover={onGoDiscover}
      onOrderSuccess={onOrderSuccess}
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
        savedAddresses={savedAddresses}
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
          {activeOrderId && (
            <LiveOrderTracker
              activeOrderId={activeOrderId}
              onDismiss={onClearActiveOrder}
            />
          )}
          <AIRecommendations
            compactEntry
            onOpenLane={onOpenAiPicks}
          />
          <RestaurantGrid
            onSelectRestaurant={onSelectRestaurant}
            deliveryAddress={deliveryAddress}
            searchQuery={searchQuery}
          />
        </>
      );
    case 'orders':
      return <OrderHistory onRateRestaurant={onRateRestaurant} />;
    case 'cart':
      return (
        <div className="flex flex-col items-stretch max-w-lg mx-auto w-full min-w-0">
          {cartPanel}
        </div>
      );
    case 'profile':
      return (
        <>
          <CustomerProfile
            deliveryAddress={deliveryAddress}
            savedAddresses={savedAddresses}
            onSelectSavedAddress={onSelectSavedAddress}
            onRemoveSavedAddress={onRemoveSavedAddress}
            onOpenAddressPicker={() => setAddressPickerOpen(true)}
            onProfileUpdate={onProfileUpdate}
          />
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
    default:
      return null;
  }
}

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CustomerTab>('discover');
  const [collapsed, setCollapsed] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressInfo>(DEFAULT_DELIVERY);
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddressInfo[]>(DEFAULT_SAVED_ADDRESSES);
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
  const [orderTotals, setOrderTotals] = useState<OrderTotals | null>(null);
  const [confirmationItems, setConfirmationItems] = useState<CartItem[]>([]);
  const [customerUser, setCustomerUser] = useState<CustomerUser>({
    firstName: 'Customer',
    lastName: '',
    profileImage: '',
  });
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const role = localStorage.getItem('fooddash_session_role');
    if (role !== 'CUSTOMER') {
      window.location.href = '/';
    }
  }, []);

  // Hydrate cart from localStorage once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) setCartItems(parsed);
      }
    } catch {
      // ignore corrupt storage
    } finally {
      setCartHydrated(true);
    }
  }, []);

  // Load customer profile for topbar + saved addresses
  useEffect(() => {
    let cancelled = false;

    async function loadCustomerUser() {
      try {
        const sessionId = localStorage.getItem('fooddash_session_id');
        if (!sessionId) return;

        const res = await fetch(
          `/api/customer/profile?customerId=${encodeURIComponent(sessionId)}`
        );
        const data = await res.json();
        if (!res.ok || !data.success || !data.profile || cancelled) return;

        const { firstName, lastName } = splitFullName(data.profile.name || 'Customer');
        setCustomerUser({
          firstName,
          lastName,
          profileImage: data.profile.profileImage || '',
        });

        const dbAddresses = Array.isArray(data.profile.savedAddresses)
          ? (data.profile.savedAddresses as DeliveryAddressInfo[]).filter(
              (a) => a && typeof a.address === 'string' && a.address.trim().length > 0
            )
          : [];

        if (dbAddresses.length > 0) {
          setSavedAddresses(dbAddresses);
          setDeliveryAddress(dbAddresses[0]);
        }
      } catch (error) {
        console.warn(error);
      }
    }

    loadCustomerUser();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist cart whenever it changes (after hydration)
  useEffect(() => {
    if (!cartHydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // storage full / private mode
    }
  }, [cartItems, cartHydrated]);

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

  const handleOrderSuccess = (orderId: string) => {
    clearCart();
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // ignore
    }
    setShowOrderConfirmation(false);
    setOrderTotals(null);
    setConfirmationItems([]);
    setSelectedRestaurant(null);
    if (orderId) {
      setActiveOrderId(orderId);
    }
    setActiveTab('discover');
  };

  const handleAddSavedAddress = async (address: DeliveryAddressInfo) => {
    const updatedAddresses = (() => {
      const sameCoords = savedAddresses.findIndex(
        (a) => a.lat === address.lat && a.lng === address.lng
      );
      if (sameCoords >= 0) {
        return savedAddresses.map((a, i) => (i === sameCoords ? address : a));
      }

      // Replace existing entry with the same custom label (e.g. Home / Work)
      const sameLabel = savedAddresses.findIndex(
        (a) => a.label.trim().toLowerCase() === address.label.trim().toLowerCase()
      );
      if (sameLabel >= 0) {
        return savedAddresses.map((a, i) => (i === sameLabel ? address : a));
      }

      return [...savedAddresses, address];
    })();

    setSavedAddresses(updatedAddresses);
    setDeliveryAddress(address);

    try {
      const sessionId = localStorage.getItem('fooddash_session_id');
      if (!sessionId) {
        toast.error('Address saved locally — please sign in again to sync');
        return;
      }

      const res = await fetch('/api/customer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: sessionId,
          savedAddresses: updatedAddresses,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to save address');
      }
      toast.success(`Saved “${address.label}”`);
    } catch (error) {
      console.warn(error);
      toast.error('Address saved locally, but failed to sync to cloud');
    }
  };

  const handleRemoveSavedAddress = async (address: DeliveryAddressInfo) => {
    const updatedAddresses = savedAddresses.filter(
      (a) =>
        !(
          a.label === address.label &&
          a.lat === address.lat &&
          a.lng === address.lng
        )
    );
    setSavedAddresses(updatedAddresses);

    if (
      deliveryAddress.label === address.label &&
      deliveryAddress.lat === address.lat &&
      deliveryAddress.lng === address.lng
    ) {
      setDeliveryAddress(updatedAddresses[0] || DEFAULT_DELIVERY);
    }

    try {
      const sessionId = localStorage.getItem('fooddash_session_id');
      if (!sessionId) return;

      const res = await fetch('/api/customer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: sessionId,
          savedAddresses: updatedAddresses,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to remove address');
      }
      toast.success(`Removed “${address.label}”`);
    } catch (error) {
      console.warn(error);
      toast.error('Failed to sync address removal');
    }
  };

  const navItems: {
    key: string;
    tab: CustomerTab;
    icon: React.ElementType;
    label: string;
    badge: string | null;
  }[] = [
    { key: 'nav-home', tab: 'discover', icon: Home, label: 'Discover', badge: null },
    { key: 'nav-orders', tab: 'orders', icon: ClipboardList, label: 'My Orders', badge: null },
    {
      key: 'nav-cart',
      tab: 'cart',
      icon: ShoppingCart,
      label: 'Cart',
      badge: cartCount > 0 ? String(cartCount) : null,
    },
    { key: 'nav-profile', tab: 'profile', icon: User, label: 'Profile', badge: null },
  ];

  const handleTabChange = (tab: CustomerTab) => {
    setActiveTab(tab);
    setShowOrderConfirmation(false);
    if (tab !== 'discover' && tab !== 'cart') {
      setSelectedRestaurant(null);
    }
  };

  const handleRateRestaurant = async (restaurantName: string) => {
    try {
      const res = await fetch('/api/restaurants');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load restaurants');

      const profiles = Array.isArray(data.restaurants) ? data.restaurants : [];
      const match = profiles.find(
        (p: { restaurantName?: string }) => p.restaurantName === restaurantName
      );

      if (!match) {
        toast.error(`Could not find ${restaurantName}. Open it from Discover to leave a review.`);
        setActiveTab('discover');
        setSelectedRestaurant(null);
        return;
      }

      const restaurant: Restaurant = {
        id: match.restaurantId || restaurantName,
        name: match.restaurantName || restaurantName,
        cuisine: match.description?.trim() || match.address || 'Local restaurant',
        rating: 4.8,
        reviews: 0,
        deliveryTime: '20-35 min',
        deliveryFee: 1.99,
        minOrder: 0,
        image: match.coverImage || match.logoImage || '/assets/images/no_image.png',
        imageAlt: `${match.restaurantName || restaurantName} cover photo`,
        tags: [],
        isOpen: true,
        discount: null,
      };

      setShowOrderConfirmation(false);
      setActiveTab('discover');
      setSelectedRestaurant(restaurant);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open restaurant');
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
          <ThemeToggle collapsed={collapsed} showLabel />
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
        <CustomerTopbar
          onProfileClick={() => handleTabChange('profile')}
          onSearch={setSearchQuery}
          user={customerUser}
        />
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
            onRemoveSavedAddress={handleRemoveSavedAddress}
            onSelectSavedAddress={setDeliveryAddress}
            removePurchasedItems={removePurchasedItems}
            showOrderConfirmation={showOrderConfirmation}
            orderTotals={orderTotals}
            confirmationItems={confirmationItems}
            onConfirmOrder={handleConfirmOrder}
            onBackFromConfirmation={handleBackFromConfirmation}
            onOrderSuccess={handleOrderSuccess}
      onProfileUpdate={(userData) => {
              setCustomerUser(userData);
              window.dispatchEvent(
                new CustomEvent('fooddash:customer-profile-updated', { detail: userData })
              );
            }}
            activeOrderId={activeOrderId}
            onClearActiveOrder={() => setActiveOrderId(null)}
            onRateRestaurant={handleRateRestaurant}
            searchQuery={searchQuery}
            onOpenAiPicks={(lane) =>
              router.push(`/customer-dashboard/ai-picks?lane=${lane}`)
            }
          />
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex items-center justify-around px-0.5 py-1 safe-area-pb">
        {navItems.map((item) => {
          const isActive = activeTab === item.tab && !showOrderConfirmation;
          return (
            <button
              key={`mobile-${item.key}`}
              onClick={() => handleTabChange(item.tab)}
              className={`relative flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-xl transition-all duration-150 min-w-0 flex-1 ${
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
