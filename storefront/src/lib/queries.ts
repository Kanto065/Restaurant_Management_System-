import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from './api';
import type {
  RestaurantPublic, MenuResponse, DeliveryZone, CreateOrderRequest, CreatedOrder, TrackOrder,
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
