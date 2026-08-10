import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { useCurrency, useCurrencyCode } from '@/hooks/useCurrency';
import {
  DollarSign, PoundSterling, Euro, IndianRupee, ShoppingCart, Clock, CheckCircle2, TrendingUp, UtensilsCrossed,
  LayoutGrid, Loader2, AlertCircle, Calendar, Activity,
} from 'lucide-react';

const CURRENCY_ICONS: Record<string, typeof DollarSign> = {
  GBP: PoundSterling,
  EUR: Euro,
  INR: IndianRupee,
};

interface OrderStats { totalOrders: number; pendingOrders: number; completedOrders: number; totalRevenue: number }
interface TableRow { id: string; tableNumber: string; isActive: boolean }
interface MenuItemRow { id: string; name: string; isAvailable: boolean }
interface RecentOrder { id: string; orderNumber: number; totalAmount: number; status: string; createdAt: string }

const formatDate = (date: string) => new Date(date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const Dashboard = () => {
  const currency = useCurrency();
  const currencyCode = useCurrencyCode();
  const CurrencyIcon = CURRENCY_ICONS[currencyCode] ?? DollarSign;
  const formatCurrency = (amount: number) => `${currency}${amount.toFixed(2)}`;
  const statsQuery = useQuery({ queryKey: ['admin', 'orders', 'stats'], queryFn: () => api.get<OrderStats>('/api/admin/orders/stats') });
  const tablesQuery = useQuery({ queryKey: ['admin', 'tables'], queryFn: () => api.get<TableRow[]>('/api/admin/tables') });
  const itemsQuery = useQuery({ queryKey: ['admin', 'menu-items'], queryFn: () => api.get<MenuItemRow[]>('/api/admin/menu-items') });
  const ordersQuery = useQuery({ queryKey: ['admin', 'orders', 'all'], queryFn: () => api.get<RecentOrder[]>('/api/admin/orders') });

  const isLoading = statsQuery.isLoading || tablesQuery.isLoading || itemsQuery.isLoading || ordersQuery.isLoading;

  const stats = statsQuery.data?.data ?? { totalOrders: 0, pendingOrders: 0, completedOrders: 0, totalRevenue: 0 };
  const tables = tablesQuery.data?.data ?? [];
  const items = itemsQuery.data?.data ?? [];
  const recentOrders = (ordersQuery.data?.data ?? []).slice(0, 5);

  const activeTables = tables.filter((t) => t.isActive).length;
  const availableItems = items.filter((i) => i.isAvailable).length;
  const avgOrderValue = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your restaurant overview.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-card">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center"><CurrencyIcon className="h-4 w-4" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" />From {stats.completedOrders} completed orders</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center"><ShoppingCart className="h-4 w-4" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Activity className="h-3 w-3" />All time orders</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Orders</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center"><Clock className="h-4 w-4" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{stats.pendingOrders}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Awaiting action</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Order Value</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center"><TrendingUp className="h-4 w-4" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{formatCurrency(avgOrderValue)}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><CurrencyIcon className="h-3 w-3" />Per order average</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Active Tables</CardTitle>
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight">{activeTables}</span>
              <span className="text-2xl text-muted-foreground font-normal">/ {tables.length}</span>
            </div>
            <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${tables.length > 0 ? (activeTables / tables.length) * 100 : 0}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Menu Items</CardTitle>
              <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight">{availableItems}</span>
              <span className="text-2xl text-muted-foreground font-normal">/ {items.length}</span>
            </div>
            <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${items.length > 0 ? (availableItems / items.length) * 100 : 0}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Completed Orders</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight">{stats.completedOrders}</span>
              <span className="text-2xl text-muted-foreground font-normal">/ {stats.totalOrders}</span>
            </div>
            <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${stats.totalOrders > 0 ? (stats.completedOrders / stats.totalOrders) * 100 : 0}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold">Recent Orders</CardTitle>
              <CardDescription className="mt-1">Latest orders from your restaurant</CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs">Last {recentOrders.length} orders</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground font-medium">No orders yet</p>
              <p className="text-sm text-muted-foreground/70">Orders will appear here when customers place them</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order, index) => (
                <div key={order.id}>
                  {index > 0 && <Separator className="my-3" />}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><ShoppingCart className="h-4 w-4 text-muted-foreground" /></div>
                      <p className="font-medium">#{order.orderNumber}</p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="font-semibold">{formatCurrency(order.totalAmount)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                      </div>
                      <Badge variant="outline" className="bg-muted/50">{order.status}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
