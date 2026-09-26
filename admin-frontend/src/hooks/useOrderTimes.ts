import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface OrderTimes {
  deliveryMinutes: number;
  collectionMinutes: number;
  dineInMinutes: number;
}

export const ORDER_TIMES_KEY = ['admin', 'order-times'];

/** The restaurant's default minutes per order type (Configurations -> Order times). */
export function useOrderTimes() {
  const { data } = useQuery({
    queryKey: ORDER_TIMES_KEY,
    queryFn: () => api.get<OrderTimes>('/api/admin/restaurant/order-times'),
    staleTime: 5 * 60 * 1000,
  });
  return data?.data;
}

export function defaultMinutesFor(orderType: string, times: OrderTimes | undefined): number {
  if (orderType === 'Delivery') return times?.deliveryMinutes ?? 60;
  if (orderType === 'DineIn') return times?.dineInMinutes ?? 20;
  return times?.collectionMinutes ?? 20;
}

/** Current time that re-renders every `intervalMs`, for live countdowns. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
