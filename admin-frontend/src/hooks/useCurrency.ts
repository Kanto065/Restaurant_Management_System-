import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { currencySymbol } from '@/lib/currency';

export function useCurrency() {
  const { data } = useQuery({
    queryKey: ['admin', 'restaurant'],
    queryFn: () => api.get<{ currency: string }>('/api/admin/restaurant'),
    staleTime: 5 * 60 * 1000,
  });
  return currencySymbol(data?.data?.currency);
}
