import { useEffect } from 'react';
import type { MenuCategory, OpeningHour, RestaurantPublic } from '@shared/types/api';
import { currencySymbol } from '@shared/lib/currency';

/** Ordering is "on" once the restaurant accepts collection or delivery (toggled in its admin). */
export function isOrderingOpen(restaurant: RestaurantPublic | undefined): boolean {
  return !!restaurant && (restaurant.supportsCollection || restaurant.supportsDelivery);
}

/** Seeded/placeholder values ("TBC") count as not-yet-confirmed. */
export function confirmed(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v && v.toUpperCase() !== 'TBC' ? v : null;
}

/** Stable anchor for a category, e.g. "To start" -> "to-start" (used by /menu#to-start). */
export function categoryAnchor(category: Pick<MenuCategory, 'name'>): string {
  return category.name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function formatPrice(amount: number, currencyCode: string | undefined): string {
  if (currencyCode) {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode }).format(amount);
    } catch {
      /* unknown code - fall through */
    }
  }
  return `${currencySymbol(currencyCode)}${amount.toFixed(2)}`;
}

const DAYS: OpeningHour['dayOfWeek'][] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function sortedOpeningHours(hours: OpeningHour[]): OpeningHour[] {
  return DAYS.map((d) => hours.find((h) => h.dayOfWeek === d)).filter((h): h is OpeningHour => !!h);
}

/** Sets document.title as "<page> — Star Spice", matching the client's pages. */
export function usePageTitle(page: string | null) {
  useEffect(() => {
    document.title = page ? `${page} — Star Spice` : 'Star Spice — Indian & Bangladeshi takeaway in Tumble';
  }, [page]);
}


// 12-hour time helpers are shared with the Port Tennant storefront.
export { formatClock, formatTimeOfDay } from '@shared/lib/time';
