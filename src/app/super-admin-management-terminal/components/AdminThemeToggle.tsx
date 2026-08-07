'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAdminTheme } from './AdminThemeContext';

export default function AdminThemeToggle() {
  const { isLight, toggleTheme } = useAdminTheme();
  // Local mount gate — never branch on theme during SSR/hydration.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showLight = mounted && isLight;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={showLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={showLight ? 'Switch to dark theme' : 'Switch to light theme'}
      className={`relative inline-flex items-center h-7 w-[52px] shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-admin/50 ${
        showLight ? 'bg-orange-500' : 'bg-black border border-zinc-600'
      }`}
    >
      <span className="absolute left-1.5 flex h-3.5 w-3.5 items-center justify-center">
        {/* Keep both icons in the DOM so structure stays stable */}
        <Sun
          className={`absolute w-3.5 h-3.5 text-white admin-theme-toggle-icon transition-opacity ${
            showLight ? 'opacity-100' : 'opacity-0'
          }`}
          strokeWidth={2.25}
          aria-hidden
        />
        <Moon
          className={`absolute w-3.5 h-3.5 text-white admin-theme-toggle-icon transition-opacity ${
            showLight ? 'opacity-0' : 'opacity-100'
          }`}
          strokeWidth={2.25}
          aria-hidden
        />
      </span>
      <span className="absolute right-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow-md" />
    </button>
  );
}
