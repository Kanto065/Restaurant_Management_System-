import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MonitorSmartphone, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, StatusDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, PageHeader, Stat } from '@/components/Page';
import { api, type DeviceType, type PlatformDevice } from '@/lib/api';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/format';

const TYPE_LABEL: Record<DeviceType, string> = { SunmiTerminal: 'Sunmi terminal', MainPos: 'Main POS', WaiterTablet: 'Waiter tablet' };
const FILTERS: ('All' | DeviceType)[] = ['All', 'MainPos', 'WaiterTablet', 'SunmiTerminal'];

/** Seen in the last 10 minutes = online. Hubs sync every minute; Sunmi terminals hold an SSE stream. */
const isOnline = (d: PlatformDevice) => !!d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 10 * 60_000;

export default function Devices() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'All' | DeviceType>('All');
  const [query, setQuery] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-devices'],
    queryFn: () => api.get<PlatformDevice[]>('/api/platform/devices'),
    refetchInterval: 60_000,
  });

  const deactivate = useMutation({
    mutationFn: (d: PlatformDevice) => api.put(`/api/platform/devices/${d.id}/deactivate`),
    onSuccess: (_, d) => { queryClient.invalidateQueries({ queryKey: ['platform-devices'] }); toast.success(`${d.deviceName} signed out`); },
    onError: (err) => toast.error((err as Error).message),
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((d) => (filter === 'All' || d.deviceType === filter)
      && (!q || d.deviceName.toLowerCase().includes(q) || d.restaurantName.toLowerCase().includes(q)));
  }, [data, filter, query]);

  const active = data?.filter((d) => d.isActive) ?? [];

  return (
    <>
      <PageHeader title="Devices" description="Every paired till, tablet and terminal across all restaurants. Signing a device out takes effect on its next request." />

      <section className="surface mb-6 grid grid-cols-2 sm:grid-cols-4 sm:divide-x" aria-label="Summary">
        <Stat label="Active devices" value={isLoading ? '–' : active.length} />
        <Stat label="Online now" value={isLoading ? '–' : active.filter(isOnline).length} hint="seen in the last 10 min" />
        <Stat label="Main POS" value={isLoading ? '–' : active.filter((d) => d.deviceType === 'MainPos').length} />
        <Stat label="Tablets" value={isLoading ? '–' : active.filter((d) => d.deviceType === 'WaiterTablet').length} />
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="flex gap-1 rounded-lg bg-secondary p-1" role="group" aria-label="Device type">
            {FILTERS.map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
                className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {f === 'All' ? 'All' : TYPE_LABEL[f]}
              </button>
            ))}
          </div>
          <div className="ml-auto flex min-w-[200px] items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Device or restaurant" aria-label="Search devices"
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
          </div>
        </div>

        {error && <p className="px-5 py-4 text-sm text-destructive">{(error as Error).message}</p>}
        {isLoading ? (
          <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<MonitorSmartphone className="h-5 w-5" />} title="No devices here">
            Restaurants pair Sunmi terminals and main POS tills from their admin; tablets pair through the main POS.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Device</th>
                  <th className="px-3 py-2.5 font-medium">Restaurant</th>
                  <th className="px-3 py-2.5 font-medium">State</th>
                  <th className="hidden px-3 py-2.5 font-medium md:table-cell">Last seen</th>
                  <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Version · IP</th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((d) => (
                  <tr key={d.id} className={cn(!d.isActive && 'text-muted-foreground')}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground">{d.deviceName}</div>
                      <Badge variant="outline" className="mt-1">{TYPE_LABEL[d.deviceType]}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Link to={`/tenants/${d.restaurantId}`} className="hover:underline">{d.restaurantName}</Link>
                    </td>
                    <td className="px-3 py-3">
                      {!d.isActive ? <StatusDot tone="muted">Signed out</StatusDot>
                        : isOnline(d) ? <StatusDot tone="success">Online</StatusDot> : <StatusDot tone="accent">Offline</StatusDot>}
                    </td>
                    <td className="hidden px-3 py-3 text-muted-foreground md:table-cell">{d.lastSeenAt ? timeAgo(d.lastSeenAt) : 'Never'}</td>
                    <td className="hidden px-3 py-3 font-mono text-xs text-muted-foreground lg:table-cell">
                      {[d.appVersion, d.lastIp].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="pr-4 text-right">
                      {d.isActive && (
                        <Button variant="ghost" size="sm" disabled={deactivate.isPending}
                          onClick={() => { if (window.confirm(`Sign out ${d.deviceName} at ${d.restaurantName}? It has to be paired again to work.`)) deactivate.mutate(d); }}>
                          Sign out
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
