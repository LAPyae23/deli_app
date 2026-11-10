'use client';

import Link from 'next/link';
import { ChevronRight, Package } from 'lucide-react';

/** Discover-page entry to FoodDash Express (person-to-person parcels). */
export default function ParcelEntryCard() {
  return (
    <Link
      href="/customer-dashboard/parcels"
      className="mb-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-customer/10">
        <Package className="h-5 w-5 text-customer" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-foreground">Send a parcel</span>
        <span className="block text-xs text-muted-foreground">
          A rider picks it up from your door and delivers anywhere in Yangon. Type the address, see the price.
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
