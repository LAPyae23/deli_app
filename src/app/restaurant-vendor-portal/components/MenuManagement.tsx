'use client';

import React, { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

interface MenuItem {
  id: string;
  category: string;
  name: string;
  description: string;
  price: number;
  isAvailable: boolean;
  isPopular: boolean;
  dietaryTags: string[];
  ordersToday: number;
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const loadItems = async () => {
    try {
      const res = await fetch('/api/menu-items');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load menu items');
      }
      setItems(data.items || []);
    } catch {
      toast.error('Could not load menu from MongoDB');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const categories = ['All', ...Array.from(new Set(items.map((i) => i.category)))];

  const filtered = items.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const toggleAvailability = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const next = !item.isAvailable;
    try {
      const res = await fetch('/api/menu-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isAvailable: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Update failed');
      }
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isAvailable: next } : i)));
      toast.success(`${item.name} marked as ${next ? 'In Stock' : 'Out of Stock'}`);
    } catch {
      toast.error('Could not update menu item');
    }
  };

  const deleteItem = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/menu-items?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Delete failed');
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.error(`${name} removed from menu`);
    } catch {
      toast.error('Could not delete menu item');
    }
  };

  const addItem = async () => {
    const name = window.prompt('New menu item name');
    if (!name?.trim()) return;
    const priceRaw = window.prompt('Price (e.g. 9.99)', '9.99');
    const price = Number(priceRaw);
    if (Number.isNaN(price)) {
      toast.error('Invalid price');
      return;
    }

    try {
      const res = await fetch('/api/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          price,
          category: 'food',
          description: '',
          restaurantId: 'burger-bliss-id',
          isAvailable: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Create failed');
      }
      await loadItems();
      toast.success(`${name.trim()} added to MongoDB`);
    } catch {
      toast.error('Could not add menu item');
    }
  };

  const outOfStockCount = items.filter((i) => !i.isAvailable).length;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden card-shadow flex flex-col">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-base">Menu Management</h2>
          {outOfStockCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-danger/10 text-danger text-xs font-bold rounded-full">
              <TriangleAlert className="w-3 h-3" />
              {outOfStockCount} out of stock
            </span>
          )}
        </div>
        <button type="button" onClick={addItem} className="btn-primary text-xs py-2">
          <Plus className="w-3.5 h-3.5" /> Add Item
        </button>
      </div>

      <div className="px-5 py-3 border-b border-border flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search menu items..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-9 py-2 text-sm" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={`cat-${cat}`}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${selectedCategory === cat ? 'bg-restaurant text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading menu from MongoDB...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No menu items in MongoDB yet. Click Add Item.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {['Item', 'Category', 'Price', 'Tags', 'Orders Today', 'Availability', 'Actions'].map((h) => (
                  <th key={`mh-${h}`} className="px-4 py-3 text-left section-label whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/40 transition-colors group">
                  <td className="px-4 py-3.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground">{item.name}</span>
                        {item.isPopular && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-customer">POPULAR</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{item.category}</td>
                  <td className="px-4 py-3.5 text-sm font-semibold font-tabular whitespace-nowrap">${item.price.toFixed(2)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1 flex-wrap">
                      {item.dietaryTags.map((tag) => (
                        <span key={`${item.id}-${tag}`} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${DIETARY_COLORS[tag] || 'bg-muted text-muted-foreground'}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm font-tabular text-muted-foreground">{item.ordersToday}</td>
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleAvailability(item.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold"
                    >
                      {item.isAvailable ? (
                        <>
                          <ToggleRight className="w-5 h-5 text-success" /> In Stock
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-5 h-5 text-danger" /> Out
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(item.id, item.name)}
                        className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
