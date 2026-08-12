'use client';

import React, { useEffect, useState } from 'react';
import { X, Image as ImageIcon, Plus, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';

export interface EditableMenuItem {
  _id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  discountPrice?: number;
  prepTime?: number;
  stockQuantity: number;
  isPopular: boolean;
  dietaryTags: string[];
  addons?: { name: string; extraPrice: number }[];
  image?: string;
  imageAlt?: string;
}

interface EditMenuModalProps {
  isOpen: boolean;
  item: EditableMenuItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface AddonRow {
  id: string;
  name: string;
  extraPrice: string;
}

const DIETARY_OPTIONS = ['VEGAN', 'VEGETARIAN', 'HALAL', 'GLUTEN_FREE', 'SPICY'] as const;

const EMPTY_FORM = {
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

export default function EditMenuModal({ isOpen, item, onClose, onSuccess }: EditMenuModalProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [addons, setAddons] = useState<AddonRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isOpen || !item) return;
    setFormData({
      name: item.name || '',
      category: item.category || '',
      price: item.price != null ? String(item.price) : '',
      discountPrice:
        item.discountPrice != null && item.discountPrice > 0 ? String(item.discountPrice) : '',
      prepTime: item.prepTime != null && item.prepTime > 0 ? String(item.prepTime) : '',
      stockQuantity: String(item.stockQuantity ?? 0),
      description: item.description || '',
      image: item.image || '',
      isPopular: Boolean(item.isPopular),
      dietaryTags: item.dietaryTags || [],
    });
    setAddons(
      (item.addons || []).map((a, idx) => ({
        id: `edit-addon-${item._id}-${idx}`,
        name: a.name,
        extraPrice: String(a.extraPrice ?? 0),
      }))
    );
  }, [isOpen, item]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Uploading image...');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.message || 'Upload failed');
      }
      setFormData((prev) => ({ ...prev, image: data.url as string }));
      toast.success('Image uploaded', { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload image', {
        id: toastId,
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
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
    if (!item?._id) return;
    setIsLoading(true);

    try {
      const stockQuantity = Number(formData.stockQuantity) || 0;
      const payload = {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        price: formData.price,
        discountPrice: formData.discountPrice,
        prepTime: formData.prepTime,
        stockQuantity,
        dietaryTags: formData.dietaryTags,
        isPopular: formData.isPopular,
        isAvailable: stockQuantity > 0,
        image: formData.image,
        imageAlt: formData.name,
        addons: addons
          .filter((a) => a.name.trim())
          .map((a) => ({
            name: a.name.trim(),
            extraPrice: Number(a.extraPrice) || 0,
          })),
      };

      const res = await fetch(`/api/menu/${item._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to update item');

      toast.success('Menu item updated successfully!');
      onSuccess();
      onClose();
    } catch {
      toast.error('Error updating menu item');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-xl animate-fade-in">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold">Edit Menu Item</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <form id="edit-menu-form" onSubmit={handleSubmit} className="space-y-4 p-5">
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
                    disabled={isUploading}
                    onChange={handleImageChange}
                    className="w-full cursor-pointer text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-orange-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-customer hover:file:bg-orange-100 disabled:opacity-60"
                  />
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {isUploading
                      ? 'Uploading image…'
                      : 'Recommended: Square image, max 2MB.'}
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
              />
            </div>

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

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <Star
                  className={`h-4 w-4 ${formData.isPopular ? 'fill-warning text-warning' : 'text-muted-foreground'}`}
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">Mark as Popular</p>
                  <p className="text-[11px] text-muted-foreground">Highlight on the customer menu</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.isPopular}
                onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                className="h-4 w-4 accent-restaurant"
              />
            </label>

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
                  No add-ons yet
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
                        placeholder="0 Ks"
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
          <button
            type="submit"
            form="edit-menu-form"
            disabled={isLoading || isUploading}
            className="btn-primary flex-1 py-2.5"
          >
            {isUploading ? 'Uploading...' : isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
