'use client';

import React, { useState } from 'react';
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

const MENU_ITEMS: MenuItem[] = [
  { id: 'menu-001', category: 'Burgers', name: 'Smash Burger', description: 'Double smash patty, American cheese, pickles, special sauce', price: 13.99, isAvailable: true, isPopular: true, dietaryTags: [], ordersToday: 28 },
  { id: 'menu-002', category: 'Burgers', name: 'BBQ Bacon Burger', description: 'Angus beef, smoked bacon, cheddar, BBQ sauce, caramelized onions', price: 15.99, isAvailable: true, isPopular: false, dietaryTags: [], ordersToday: 14 },
  { id: 'menu-003', category: 'Burgers', name: 'Veggie Burger', description: 'Black bean patty, avocado, lettuce, tomato, chipotle mayo', price: 12.99, isAvailable: true, isPopular: false, dietaryTags: ['VEGAN'], ordersToday: 7 },
  { id: 'menu-004', category: 'Burgers', name: 'Chicken Crispy Burger', description: 'Buttermilk fried chicken, coleslaw, pickles, honey mustard', price: 13.49, isAvailable: false, isPopular: false, dietaryTags: [], ordersToday: 0 },
  { id: 'menu-005', category: 'Sides', name: 'Truffle Fries', description: 'Hand-cut fries, truffle oil, parmesan, fresh herbs', price: 6.49, isAvailable: true, isPopular: true, dietaryTags: ['VEGAN'], ordersToday: 41 },
  { id: 'menu-006', category: 'Sides', name: 'Onion Rings', description: 'Beer-battered onion rings with ranch dip', price: 5.99, isAvailable: true, isPopular: false, dietaryTags: [], ordersToday: 19 },
  { id: 'menu-007', category: 'Sides', name: 'Sweet Potato Fries', description: 'Crispy sweet potato fries with sriracha aioli', price: 5.99, isAvailable: true, isPopular: false, dietaryTags: ['VEGAN'], ordersToday: 12 },
  { id: 'menu-008', category: 'Drinks', name: 'Classic Milkshake', description: 'Vanilla, chocolate, or strawberry — your choice', price: 6.99, isAvailable: true, isPopular: true, dietaryTags: ['VEGETARIAN'], ordersToday: 23 },
  { id: 'menu-009', category: 'Drinks', name: 'Coke Zero', description: '330ml can, served chilled', price: 2.99, isAvailable: true, isPopular: false, dietaryTags: ['VEGAN'], ordersToday: 35 },
  { id: 'menu-010', category: 'Drinks', name: 'Fresh Lemonade', description: 'Freshly squeezed lemonade with mint', price: 3.99, isAvailable: false, isPopular: false, dietaryTags: ['VEGAN'], ordersToday: 0 },
  { id: 'menu-011', category: 'Desserts', name: 'Brownie Sundae', description: 'Warm chocolate brownie, vanilla ice cream, hot fudge', price: 7.99, isAvailable: true, isPopular: false, dietaryTags: ['VEGETARIAN'], ordersToday: 8 },
  { id: 'menu-012', category: 'Desserts', name: 'Apple Pie Slice', description: 'Homestyle apple pie with whipped cream', price: 5.49, isAvailable: true, isPopular: false, dietaryTags: ['VEGETARIAN'], ordersToday: 4 },
];

const DIETARY_COLORS: Record<string, string> = {
  VEGAN: 'bg-success/10 text-success',
  VEGETARIAN: 'bg-green-100 text-green-700',
  HALAL: 'bg-blue-100 text-blue-700',
  GLUTEN_FREE: 'bg-yellow-100 text-yellow-700',
  SPICY: 'bg-red-100 text-red-700',
};

export default function MenuManagement() {
  const [items, setItems] = useState(MENU_ITEMS);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', ...Array.from(new Set(MENU_ITEMS.map(i => i.category)))];

  const filtered = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const toggleAvailability = (id: string) => {
    // BACKEND INTEGRATION: PATCH /api/menu/items/:id { isAvailable }
    setItems(prev => prev.map(i => i.id === id ? { ...i, isAvailable: !i.isAvailable } : i));
    const item = items.find(i => i.id === id);
    if (item) toast.success(`${item.name} marked as ${item.isAvailable ? 'Out of Stock' : 'In Stock'}`);
  };

  const deleteItem = (id: string, name: string) => {
    // BACKEND INTEGRATION: DELETE /api/menu/items/:id
    setItems(prev => prev.filter(i => i.id !== id));
    toast.error(`${name} removed from menu`);
  };

  const outOfStockCount = items.filter(i => !i.isAvailable).length;

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
        <button className="btn-primary text-xs py-2">
          <Plus className="w-3.5 h-3.5" /> Add Item
        </button>
      </div>

      <div className="px-5 py-3 border-b border-border flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search menu items..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 py-2 text-sm" />
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
                        <span className="px-1.5 py-0.5 bg-orange-50 text-customer text-xs font-bold rounded">🔥 Popular</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">{item.description}</p>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{item.category}</td>
                <td className="px-4 py-3.5 text-sm font-bold text-foreground font-tabular whitespace-nowrap">${item.price.toFixed(2)}</td>
                <td className="px-4 py-3.5">
                  <div className="flex gap-1 flex-wrap">
                    {item.dietaryTags.map((tag) => (
                      <span key={`tag-${item.id}-${tag}`} className={`status-badge text-xs ${DIETARY_COLORS[tag] || 'bg-muted text-muted-foreground'}`}>{tag}</span>
                    ))}
                    {item.dietaryTags.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-sm font-semibold font-tabular text-foreground whitespace-nowrap">{item.ordersToday}</td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <button
                    onClick={() => toggleAvailability(item.id)}
                    className="flex items-center gap-2 text-sm font-semibold transition-colors"
                    title={item.isAvailable ? 'Mark as out of stock' : 'Mark as in stock'}
                  >
                    {item.isAvailable ? (
                      <><ToggleRight className="w-6 h-6 text-success" /><span className="text-success">In Stock</span></>
                    ) : (
                      <><ToggleLeft className="w-6 h-6 text-muted-foreground" /><span className="text-muted-foreground">Out of Stock</span></>
                    )}
                  </button>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit item">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteItem(item.id, item.name)}
                      className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"
                      title="Remove item from menu — this cannot be undone"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}