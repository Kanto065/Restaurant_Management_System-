import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, type TenantSummary } from '@/lib/api';
import { formatDate } from '@/lib/format';

export default function Tenants() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.get<TenantSummary[]>('/api/platform/tenants'),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Restaurants</CardTitle>
          <CardDescription>Every tenant on the platform. Each one is fully isolated.</CardDescription>
        </div>
        <Button asChild>
          <Link to="/tenants/new">
            <Plus className="mr-2 h-4 w-4" />
            New restaurant
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Domains</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead>Last order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((t) => (
                  <TableRow key={t.restaurantId} className="cursor-pointer"
                    onClick={() => navigate(`/tenants/${t.restaurantId}`)}>
                    <TableCell>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.slug} · {t.city}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {t.domains.map((d) => (
                          <span key={d.id} className="text-xs">
                            <Badge variant="outline" className="mr-1 px-1 py-0 text-[10px]">{d.kind}</Badge>
                            {d.host}
                          </span>
                        ))}
                        {t.domains.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {t.isActive ? <Badge>Active</Badge> : <Badge variant="destructive">Suspended</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{t.orderCount}</TableCell>
                    <TableCell className="text-sm">{t.lastOrderAt ? formatDate(t.lastOrderAt) : '—'}</TableCell>
                  </TableRow>
                ))}
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">No restaurants yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
