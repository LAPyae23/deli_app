'use client';

import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, TriangleAlert, Clock, Star, Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import AddMenuModal from './AddMenuModal';
import EditMenuModal, { type EditableMenuItem } from './EditMenuModal';

interface MenuAddon {
  name: string;
  extraPrice: number;
}

interface MenuItem {
  _id: string;
  category: string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  prepTime?: number;
  stockQuantity: number;
  isAvailable: boolean;
  isPopular: boolean;
  dietaryTags: string[];
  addons?: MenuAddon[];
  ordersToday?: number;
  image?: string;
  imageAlt?: string;
}

const DIETARY_COLORS: Record<string, string> = {
  VEGAN: 'bg-success/10 text-success',
  VEGETARIAN: 'bg-green-100 text-green-700',
  HALAL: 'bg-blue-100 text-blue-700',
  GLUTEN_FREE: 'bg-yellow-100 text-yellow-700',
  SPICY: 'bg-red-100 text-red-700',
};

export default function MenuManagement() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditableMenuItem | null>(null);
  const [stockUpdatingId, setStockUpdatingId] = useState<string | null>(null);

  const fetchMenu = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/menu');
      const data = await res.json();
      if (data.success) setItems(data.items);
    } catch {
      toast.error('Failed to load menu items');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const categories = ['All', ...Array.from(new Set(items.map((i) => i.category)))];

  const filtered = items.filter((item) => {
    const safeName = item.name || '';
    const safeCategory = item.category || '';
    const matchSearch = safeName.toLowerCase().includes((search || '').toLowerCase());
    const matchCat = selectedCategory === 'All' || safeCategory === selectedCategory;
    return matchSearch && matchCat;
  });

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/menu/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !currentStatus }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) => (i._id === id ? { ...i, isAvailable: !currentStatus } : i))
        );
        toast.success(`Marked as ${!currentStatus ? 'In Stock' : 'Out of Stock'}`);
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const adjustStock = async (item: MenuItem, delta: number) => {
    const nextQty = Math.max(0, (item.stockQuantity ?? 0) + delta);
    if (nextQty === (item.stockQuantity ?? 0)) return;

    // Optimistic local update
    setItems((prev) =>
      prev.map((i) =>
        i._id === item._id
          ? { ...i, stockQuantity: nextQty, isAvailable: nextQty > 0 ? i.isAvailable || true : false }
          : i
      )
    );
    setStockUpdatingId(item._id);

    try {
      const res = await fetch(`/api/menu/${item._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockQuantity: nextQty,
          isAvailable: nextQty > 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error('Stock update failed');
      if (data.item) {
        setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, ...data.item } : i)));
      }
    } catch {
      toast.error('Failed to update stock');
      fetchMenu();
    } finally {
      setStockUpdatingId(null);
    }
  };

  const deleteItem = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i._id !== id));
        toast.error(`${name} removed from menu`);
      }
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const outOfStockCount = items.filter((i) => !i.isAvailable).length;

  return (
    <div className="flex min-h-[400px] flex-col overflow-hidden rounded-xl border border-border bg-card card-shadow">
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold">Menu Management</h2>
          {outOfStockCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger">
              <TriangleAlert className="h-3 w-3" />
              {outOfStockCount} out of stock
            </span>
          )}
        </div>
        <button type="button" onClick={() => setIsAddModalOpen(true)} className="btn-primary py-2 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Item
        </button>
      </div>

      <div className="flex flex-wrap gap-3 border-b border-border px-5 py-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search menu items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field py-2 pl-9 text-sm"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={`cat-${cat}`}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                selectedCategory === cat
                  ? 'bg-restaurant text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">Loading menu...</div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            No menu items found. Add a new item!
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {['Item', 'Category', 'Price', 'Tags', 'Availability', 'Actions'].map((h) => (
                  <th key={`mh-${h}`} className="section-label whitespace-nowrap px-4 py-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item._id} className="group transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image}
                            alt={item.imageAlt || item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                            No img
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground">{item.name}</span>
                          {item.isPopular && (
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                          )}
                        </div>
                        <p className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground">
                          {item.description}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {typeof item.prepTime === 'number' && item.prepTime > 0 && (
                            <span className="inline-flex items-center gap-0.5 font-medium">
                              <Clock className="h-3 w-3" />
                              {item.prepTime} min
                            </span>
                          )}
                          {typeof item.discountPrice === 'number' && item.discountPrice > 0 && (
                            <span className="font-semibold text-customer font-tabular">
                              Sale ${item.discountPrice.toFixed(2)}
                            </span>
                          )}
                          {item.addons && item.addons.length > 0 && (
                            <span>
                              +{item.addons.length} add-on{item.addons.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-sm text-muted-foreground">
                    {item.category}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-sm font-bold text-foreground font-tabular">
                    <div className="flex flex-col">
                      {typeof item.discountPrice === 'number' && item.discountPrice > 0 ? (
                        <>
                          <span className="text-customer">${item.discountPrice.toFixed(2)}</span>
                          <span className="text-xs font-medium text-muted-foreground line-through">
                            ${item.price.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span>${item.price.toFixed(2)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {item.dietaryTags?.map((tag) => (
                        <span
                          key={`tag-${item._id}-${tag}`}
                          className={`status-badge text-xs ${DIETARY_COLORS[tag] || 'bg-muted text-muted-foreground'}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <div className="flex flex-col items-start gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleAvailability(item._id, item.isAvailable)}
                        className="flex items-center gap-2 text-sm font-semibold transition-colors"
                        title={item.isAvailable ? 'Mark as out of stock' : 'Mark as in stock'}
                      >
                        {item.isAvailable ? (
                          <>
                            <ToggleRight className="h-6 w-6 text-success" />
                            <span className="text-success">In Stock</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                            <span className="text-muted-foreground">Out of Stock</span>
                          </>
                        )}
                      </button>
                      <div className="flex items-center gap-1.5 pl-1">
                        <button
                          type="button"
                          onClick={() => adjustStock(item, -1)}
                          disabled={stockUpdatingId === item._id || (item.stockQuantity ?? 0) <= 0}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                          aria-label="Decrease stock"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[4.5rem] text-center text-xs font-semibold text-foreground font-tabular">
                          {item.stockQuantity ?? 0} in stock
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustStock(item, 1)}
                          disabled={stockUpdatingId === item._id}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                          aria-label="Increase stock"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Edit item"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(item._id, item.name)}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                        title="Remove item from menu"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AddMenuModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchMenu}
      />
      <EditMenuModal
        isOpen={!!editingItem}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSuccess={fetchMenu}
      />
    </div>
  );
}
