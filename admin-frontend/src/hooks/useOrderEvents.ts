import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api';

/**
 * Subscribes to the backend's SSE order-events stream and invalidates the relevant
 * react-query caches on each event, instead of polling or manually splicing payloads
 * into local state. Replaces the earlier SignalR client wiring.
 */
export function useOrderEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    const source = new EventSource(`${API_BASE_URL}/api/events/orders?access_token=${encodeURIComponent(token)}`);

    source.onmessage = (event) => {
      // Comment-only keepalive pings arrive as empty data and can be ignored.
      if (!event.data) return;

      try {
        const parsed: { event: string } = JSON.parse(event.data);
        if (parsed.event === 'OrderCreated' || parsed.event === 'OrderStatusChanged' || parsed.event === 'PaymentReceived') {
          queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
          queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
        }
      } catch {
        // Ignore malformed events rather than crashing the subscription.
      }
    };

    // EventSource retries automatically on error/disconnect - nothing to do here
    // beyond letting the browser's built-in reconnect logic run.
    source.onerror = () => {};

    return () => source.close();
  }, [queryClient]);
}
