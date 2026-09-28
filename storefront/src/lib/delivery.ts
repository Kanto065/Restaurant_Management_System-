import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { DeliveryInfo, DeliveryQuote } from '../types/api';

/** Loose UK postcode shape check, so we don't ask the server about "SA" while someone types. */
export function looksLikePostcode(value: string): boolean {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value.trim());
}

export function tidyPostcode(value: string): string {
  const compact = value.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
}

/** Live delivery price for a postcode - the same calculation checkout charges. */
export function useDeliveryQuote(postcode: string, enabled = true) {
  const tidy = tidyPostcode(postcode);
  return useQuery({
    queryKey: ['public', 'delivery-quote', tidy],
    queryFn: () => api.get<DeliveryQuote>(`/api/public/delivery-quote?postcode=${encodeURIComponent(tidy)}`),
    enabled: enabled && looksLikePostcode(tidy),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useDeliveryInfo() {
  return useQuery({
    queryKey: ['public', 'delivery-info'],
    queryFn: () => api.get<DeliveryInfo>('/api/public/delivery-info'),
  });
}

/**
 * "Use my location": asks the browser where the customer is, then the server turns that
 * into the nearest postcode and prices it. Rejects with a customer-friendly message.
 */
export function quoteFromMyLocation(): Promise<DeliveryQuote> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error("Your browser can't share your location - please type your postcode."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        api.get<DeliveryQuote>(`/api/public/delivery-quote?lat=${latitude.toFixed(6)}&lng=${longitude.toFixed(6)}`)
          .then(resolve)
          .catch(() => reject(new Error("We couldn't find a postcode for your location - please type it instead.")));
      },
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED
        ? 'Location access was blocked - please type your postcode instead.'
        : "We couldn't get your location - please type your postcode instead.")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}
