'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export type AdminTheme = 'light' | 'dark';

interface AdminThemeContextValue {
  theme: AdminTheme;
  isLight: boolean;
  toggleTheme: () => void;
}

const AdminThemeContext = createContext<AdminThemeContextValue>({
  theme: 'dark',
  isLight: false,
  toggleTheme: () => undefined,
});

const STORAGE_KEY = 'fooddash-admin-theme';

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR + first client render always use dark so markup matches.
  const [theme, setTheme] = useState<AdminTheme>('dark');
  const canPersist = useRef(false);

  useEffect(() => {
    // Defer past hydration so Suspense children don't hydrate against a
    // different theme than the server HTML.
    const timer = window.setTimeout(() => {
      try {
        const value = localStorage.getItem(STORAGE_KEY);
        if (value === 'light' || value === 'dark') {
          setTheme(value);
        }
      } catch {
        // ignore storage errors
      }
      canPersist.current = true;
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!canPersist.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const toggleTheme = () => {
    canPersist.current = true;
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <AdminThemeContext.Provider
      value={{
        theme,
        isLight: theme === 'light',
        toggleTheme,
      }}
    >
      {children}
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme() {
  return useContext(AdminThemeContext);
}
