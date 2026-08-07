'use client';

import React, { useState } from 'react';
import { X, Image as ImageIcon, Plus, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';

interface AddMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface AddonRow {
  id: string;
  name: string;
  extraPrice: string;
}

const DIETARY_OPTIONS = ['VEGAN', 'VEGETARIAN', 'HALAL', 'GLUTEN_FREE', 'SPICY'] as const;

const INITIAL_FORM = {
  name: '',
  category: '',
  price: '',
  discountPrice: '',
  prepTime: '',
  stockQuantity: '0',
  description: '',
  image: '',
  isPopular: false,
  dietaryTags: [] as string[],
};

export default function AddMenuModal({ isOpen, onClose, onSuccess }: AddMenuModalProps) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [addons, setAddons] = useState<AddonRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setAddons([]);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, image: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const toggleDietaryTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      dietaryTags: prev.dietaryTags.includes(tag)
        ? prev.dietaryTags.filter((t) => t !== tag)
        : [...prev.dietaryTags, tag],
    }));
  };

  const addAddonRow = () => {
    setAddons((prev) => [
      ...prev,
      { id: `addon-${Date.now()}-${prev.length}`, name: '', extraPrice: '' },
    ]);
  };

  const updateAddon = (id: string, field: 'name' | 'extraPrice', value: string) => {
    setAddons((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  };

  const removeAddon = (id: string) => {
    setAddons((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        ...formData,
        price: formData.price,
        discountPrice: formData.discountPrice,
        prepTime: formData.prepTime,
        stockQuantity: Number(formData.stockQuantity) || 0,
        dietaryTags: formData.dietaryTags,
        isPopular: formData.isPopular,
        addons: addons
          .filter((a) => a.name.trim())
          .map((a) => ({
            name: a.name.trim(),
            extraPrice: Number(a.extraPrice) || 0,
          })),
      };

      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to add item');

      toast.success('Menu item added successfully!');
      onSuccess();
      onClose();
      resetForm();
    } catch {
      toast.error('Error adding menu item');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-xl animate-fade-in">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold">Add New Menu Item</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <form id="add-menu-form" onSubmit={handleSubmit} className="space-y-4 p-5">
            {/* Image */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Menu Image</label>
              <div className="flex items-start gap-4">
                {formData.image ? (
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={formData.image} alt="Preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image: '' })}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full cursor-pointer text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-orange-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-customer hover:file:bg-orange-100"
                  />
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Recommended: Square image, max 2MB.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">Item Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                placeholder="e.g. Spicy Chicken Burger"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Category</label>
                <input
                  type="text"
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input-field"
                  placeholder="e.g. Burgers"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Discount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.discountPrice}
                  onChange={(e) => setFormData({ ...formData, discountPrice: e.target.value })}
                  className="input-field"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Prep (mins)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.prepTime}
                  onChange={(e) => setFormData({ ...formData, prepTime: e.target.value })}
                  className="input-field"
                  placeholder="e.g. 15"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Stock Qty</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                  className="input-field"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">Description</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-field h-20 resize-none"
                placeholder="Ingredients and details..."
              />
            </div>

            {/* Dietary tags */}
            <div>
              <label className="mb-2 block text-sm font-semibold">Dietary Tags</label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map((tag) => {
                  const active = formData.dietaryTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleDietaryTag(tag)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                        active
                          ? 'border-restaurant bg-restaurant/10 text-restaurant'
                          : 'border-border bg-card text-muted-foreground hover:border-restaurant/40'
                      }`}
                    >
                      {tag.replace('_', ' ')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Popular toggle */}
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <Star className={`h-4 w-4 ${formData.isPopular ? 'fill-warning text-warning' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-semibold text-foreground">Mark as Popular</p>
                  <p className="text-[11px] text-muted-foreground">Highlight this item on the customer menu</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.isPopular}
                onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                className="h-4 w-4 accent-restaurant"
              />
            </label>

            {/* Add-ons */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-semibold">Add-ons</label>
                <button
                  type="button"
                  onClick={addAddonRow}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-restaurant hover:bg-restaurant/10"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Option
                </button>
              </div>

              {addons.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  No add-ons yet. Add extras like &quot;Extra Cheese&quot; + $1.50
                </p>
              ) : (
                <div className="space-y-2">
                  {addons.map((addon) => (
                    <div key={addon.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={addon.name}
                        onChange={(e) => updateAddon(addon.id, 'name', e.target.value)}
                        className="input-field flex-1 py-2 text-sm"
                        placeholder="e.g. Extra Cheese"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={addon.extraPrice}
                        onChange={(e) => updateAddon(addon.id, 'extraPrice', e.target.value)}
                        className="input-field w-24 py-2 text-sm"
                        placeholder="$0.00"
                      />
                      <button
                        type="button"
                        onClick={() => removeAddon(addon.id)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                        aria-label="Remove add-on"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="flex flex-shrink-0 gap-3 border-t border-border p-5">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">
            Cancel
          </button>
          <button type="submit" form="add-menu-form" disabled={isLoading} className="btn-primary flex-1 py-2.5">
            {isLoading ? 'Saving...' : 'Save Item'}
          </button>
        </div>
      </div>
    </div>
  );
}
