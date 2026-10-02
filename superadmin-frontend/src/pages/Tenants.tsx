import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, Search, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, PageHeader, Stat } from '@/components/Page';
import { api, type TenantSummary } from '@/lib/api';
import { timeAgo } from '@/lib/format';

function Initials({ name }: { name: string }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-secondary text-xs font-semibold text-secondary-foreground">
      {letters}
    </span>
  );
}

export default function Tenants() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.get<TenantSummary[]>('/api/platform/tenants'),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!data || !q) return data ?? [];
    return data.filter((t) => [t.name, t.slug, t.city, ...t.domains.map((d) => d.host)].some((v) => v.toLowerCase().includes(q)));
  }, [data, query]);

  const totals = useMemo(() => ({
    count: data?.length ?? 0,
    active: data?.filter((t) => t.isActive).length ?? 0,
    orders: data?.reduce((sum, t) => sum + t.orderCount, 0) ?? 0,
    lastOrder: data?.map((t) => t.lastOrderAt).filter(Boolean).sort().at(-1) ?? null,
  }), [data]);

  return (
    <>
      <PageHeader
        title="Restaurants"
        description="Every restaurant on the platform. Each one has its own data, domains and staff."
        actions={
          <Button asChild>
            <Link to="/tenants/new"><Plus />New restaurant</Link>
          </Button>
        }
      />

      <section className="surface mb-6 grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x" aria-label="Summary">
        <Stat label="Restaurants" value={isLoading ? '–' : totals.count} />
        <Stat label="Live" value={isLoading ? '–' : totals.active}
          hint={totals.count - totals.active > 0 ? `${totals.count - totals.active} suspended` : 'none suspended'} />
        <Stat label="Orders, all time" value={isLoading ? '–' : totals.orders.toLocaleString('en-GB')} />
        <Stat label="Latest order" value={totals.lastOrder ? timeAgo(totals.lastOrder) : '–'} className="[&>div:nth-child(2)]:text-lg" />
      </section>

      <section className="surface overflow-hidden">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, town or domain"
            aria-label="Search restaurants"
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {error && <p className="px-5 py-4 text-sm text-destructive">{(error as Error).message}</p>}

        {isLoading ? (
          <div className="divide-y">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-4">
                <Skeleton className="h-9 w-9 rounded-[10px]" />
                <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-24" /></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Store className="h-5 w-5" />} title={query ? 'No restaurants match' : 'No restaurants yet'}
            action={!query && <Button asChild variant="outline"><Link to="/tenants/new"><Plus />Add the first one</Link></Button>}>
            {query ? 'Try a different name, town or domain.' : 'A new restaurant gets its own storefront, admin and owner login.'}
          </EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead className="sr-only sm:not-sr-only">
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Restaurant</th>
                <th className="hidden px-3 py-2.5 font-medium md:table-cell">Storefront</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Orders</th>
                <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Last order</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((t) => {
                const storefront = t.domains.find((d) => d.kind === 'Storefront' && d.isPrimary) ?? t.domains.find((d) => d.kind === 'Storefront');
                return (
                  <tr key={t.restaurantId} tabIndex={0}
                    className="group cursor-pointer transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:outline-none"
                    onClick={() => navigate(`/tenants/${t.restaurantId}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/tenants/${t.restaurantId}`); }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Initials name={t.name} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{t.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{t.city}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-3.5 font-mono text-xs text-muted-foreground md:table-cell">
                      {storefront?.host ?? '—'}
                    </td>
                    <td className="px-3 py-3.5">
                      {t.isActive ? <StatusDot tone="success">Live</StatusDot> : <StatusDot tone="destructive">Suspended</StatusDot>}
                    </td>
                    <td className="num hidden px-3 py-3.5 text-right sm:table-cell">{t.orderCount.toLocaleString('en-GB')}</td>
                    <td className="hidden px-3 py-3.5 text-muted-foreground lg:table-cell">{t.lastOrderAt ? timeAgo(t.lastOrderAt) : '—'}</td>
                    <td className="pr-4 text-muted-foreground">
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
