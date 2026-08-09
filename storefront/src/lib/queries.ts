import { useQuery, useMutation } from '@tanstack/react-query';
import { api, customerAuth } from './api';
import type {
  RestaurantPublic, MenuResponse, DeliveryZone, CreateOrderRequest, CreatedOrder, TrackOrder, ReviewPage,
} from '../types/api';

export function useRestaurant() {
  return useQuery({
    queryKey: ['public', 'restaurant'],
    queryFn: () => api.get<RestaurantPublic>('/api/public/restaurant'),
  });
}

export function useMenu() {
  return useQuery({
    queryKey: ['public', 'menu'],
    queryFn: () => api.get<MenuResponse>('/api/public/menu'),
  });
}

export function useDeliveryZones() {
  return useQuery({
    queryKey: ['public', 'delivery-zones'],
    queryFn: () => api.get<DeliveryZone[]>('/api/public/delivery-zones'),
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (req: CreateOrderRequest) => api.post<CreatedOrder>('/api/public/orders', req),
  });
}

export function useTrackOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ['public', 'orders', orderId, 'track'],
    queryFn: () => api.get<TrackOrder>(`/api/public/orders/${orderId}/track`),
    enabled: !!orderId,
    refetchInterval: 15_000,
  });
}

export function useReviews(page: number) {
  return useQuery({
    queryKey: ['public', 'reviews', page],
    queryFn: () => api.get<ReviewPage>(`/api/public/reviews?page=${page}&pageSize=10`),
  });
}

export function useFavourites() {
  return useQuery({
    queryKey: ['account', 'favourites'],
    queryFn: () => api.get<{ menuItemId: string; name: string; basePrice: number; imageUrl: string | null }[]>('/api/account/favourites'),
    enabled: customerAuth.isLoggedIn(),
  });
}

export function useLastOrder() {
  return useQuery({
    queryKey: ['account', 'orders', 'last'],
    queryFn: () => api.get('/api/account/orders/last'),
    enabled: customerAuth.isLoggedIn(),
    retry: false,
  });
}
