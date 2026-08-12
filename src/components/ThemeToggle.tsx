'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

type ThemeToggleProps = {
  collapsed?: boolean;
  className?: string;
  showLabel?: boolean;
};

export default function ThemeToggle({
  collapsed = false,
  className = '',
  showLabel = false,
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';
  const iconClass = showLabel
    ? 'h-4 w-4 flex-shrink-0 text-muted-foreground'
    : 'h-5 w-5 flex-shrink-0 text-muted-foreground';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={
        className ||
        `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium nav-item transition-colors ${
          collapsed ? 'justify-center px-0' : ''
        }`
      }
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {!mounted || isDark ? <Sun className={iconClass} /> : <Moon className={iconClass} />}
      {showLabel && !collapsed && (
        <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
      )}
    </button>
  );
}
