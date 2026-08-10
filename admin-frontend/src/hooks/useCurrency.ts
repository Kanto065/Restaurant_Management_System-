import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { currencySymbol } from '@/lib/currency';

function useRestaurantCurrencyCode() {
  const { data } = useQuery({
    queryKey: ['admin', 'restaurant'],
    queryFn: () => api.get<{ currency: string }>('/api/admin/restaurant'),
    staleTime: 5 * 60 * 1000,
  });
  return data?.data?.currency || 'GBP';
}

export function useCurrency() {
  return currencySymbol(useRestaurantCurrencyCode());
}

export function useCurrencyCode() {
  return useRestaurantCurrencyCode();
}
