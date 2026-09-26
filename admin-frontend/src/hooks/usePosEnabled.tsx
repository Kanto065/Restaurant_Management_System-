import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Smartphone } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Whether this restaurant may use the POS terminal app - switched on/off by the platform in the
 * super admin panel (Restaurant.PosEnabled). Shares the ['admin','restaurant'] query cache.
 * Returns undefined while loading, so POS UI stays hidden until it's known to be allowed.
 */
export function usePosEnabled(): boolean | undefined {
  const { data } = useQuery({
    queryKey: ['admin', 'restaurant'],
    queryFn: () => api.get<{ posEnabled: boolean }>('/api/admin/restaurant'),
    staleTime: 5 * 60 * 1000,
  });
  return data?.data?.posEnabled;
}

/** Wraps POS-only pages: shows a short notice instead when POS isn't enabled. */
export function PosGuard({ children }: { children: ReactNode }) {
  const posEnabled = usePosEnabled();
  if (posEnabled === undefined) return null;
  if (!posEnabled) {
    return (
      <Card className="max-w-xl">
        <CardContent className="flex items-start gap-4 p-6">
          <Smartphone className="mt-1 h-6 w-6 shrink-0 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">POS terminals aren't enabled</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The POS terminal app isn't switched on for your restaurant. Please contact your platform provider if you'd like to use it.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  return <>{children}</>;
}
