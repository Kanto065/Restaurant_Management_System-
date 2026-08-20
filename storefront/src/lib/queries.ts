import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, customerAuth } from './api';
import type {
  RestaurantPublic, MenuResponse, DeliveryZone, CreateOrderRequest, CreatedOrder, TrackOrder, ReviewPage, AccountOrderSummary,
  CustomerProfile, UpdateProfileRequest, CustomerAddress, UpsertCustomerAddressRequest, Loyalty, CreateCheckoutSessionResponse,
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

export function useOrderStatuses() {
  return useQuery({
    queryKey: ['public', 'order-statuses'],
    queryFn: () => api.get<string[]>('/api/public/order-statuses'),
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (req: CreateOrderRequest) => api.post<CreatedOrder>('/api/public/orders', req),
  });
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (orderId: string) => api.post<CreateCheckoutSessionResponse>(`/api/public/orders/${orderId}/checkout-session`),
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

export function useOrders() {
  return useQuery({
    queryKey: ['account', 'orders'],
    queryFn: () => api.get<AccountOrderSummary[]>('/api/account/orders'),
    enabled: customerAuth.isLoggedIn(),
  });
}

export function useLoyalty() {
  return useQuery({
    queryKey: ['account', 'loyalty'],
    queryFn: () => api.get<Loyalty>('/api/account/loyalty'),
    enabled: customerAuth.isLoggedIn(),
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ['account', 'profile'],
    queryFn: () => api.get<CustomerProfile>('/api/account/profile'),
    enabled: customerAuth.isLoggedIn(),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: UpdateProfileRequest) => api.put<CustomerProfile>('/api/account/profile', req),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'profile'] }),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => api.delete('/api/account/profile'),
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: UpsertCustomerAddressRequest) => api.post<CustomerAddress>('/api/account/addresses', req),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'profile'] }),
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpsertCustomerAddressRequest }) => api.put<CustomerAddress>(`/api/account/addresses/${id}`, req),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'profile'] }),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/account/addresses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'profile'] }),
  });
}
