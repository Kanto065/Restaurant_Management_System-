import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { 
  DollarSign, 
  ShoppingCart, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  UtensilsCrossed,
  LayoutGrid,
  Loader2,
  AlertCircle,
  Calendar,
  Activity
} from 'lucide-react';

interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
}

interface Table {
  _id: string;
  tableNumber: string;
  isActive: boolean;
}

interface Food {
  _id: string;
  name: string;
  isAvailable: boolean;
}

interface RecentOrder {
  _id: string;
  orderNumber: string;
  totalAmount: number;
  orderStatus: string;
  createdAt: string;
  table: {
    tableNumber: string;
  };
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-300',
  confirmed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300',
  preparing: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-300',
  ready: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-300',
  served: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300',
  completed: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-300',
  cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-300',
};

// Placeholder for interfaces and component
const Dashboard = () => {
  const [stats, setStats] = useState<OrderStats>({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0
  });
  const [tables, setTables] = useState<Table[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, tablesRes, foodsRes, ordersRes] = await Promise.all([
        api.get<{ stats: OrderStats }>('/api/orders/stats'),
        api.get<{ tables: Table[]; count: number }>('/api/tables'),
        api.get<{ foods: Food[]; count: number }>('/api/foods'),
        api.get<{ orders: RecentOrder[]; count: number }>('/api/orders')
      ]);

      setStats(statsRes.data?.stats || { totalOrders: 0, pendingOrders: 0, completedOrders: 0, totalRevenue: 0 });
      setTables(tablesRes.data?.tables || []);
      setFoods(foodsRes.data?.foods || []);
      setRecentOrders((ordersRes.data?.orders || []).slice(0, 5));
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load dashboard data'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const activeTables = tables.filter(t => t.isActive).length;
  const availableFoods = foods.filter(f => f.isAvailable).length;
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
          <span className="text-sm font-medium">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              From {stats.completedOrders} completed orders
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Activity className="h-3 w-3" />
              All time orders
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Orders</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{stats.pendingOrders}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Awaiting action
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Order Value</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{formatCurrency(avgOrderValue)}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Per order average
            </p>
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
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${tables.length > 0 ? (activeTables / tables.length) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {tables.length > 0 ? Math.round((activeTables / tables.length) * 100) : 0}% occupancy rate
            </p>
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
              <span className="text-4xl font-bold tracking-tight">{availableFoods}</span>
              <span className="text-2xl text-muted-foreground font-normal">/ {foods.length}</span>
            </div>
            <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${foods.length > 0 ? (availableFoods / foods.length) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {foods.length > 0 ? Math.round((availableFoods / foods.length) * 100) : 0}% available items
            </p>
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
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${stats.totalOrders > 0 ? (stats.completedOrders / stats.totalOrders) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {stats.totalOrders > 0 ? Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0}% completion rate
            </p>
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
            <Badge variant="secondary" className="text-xs">
              Last {recentOrders.length} orders
            </Badge>
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
                <div key={order._id}>
                  {index > 0 && <Separator className="my-3" />}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{order.orderNumber}</p>
                        <p className="text-sm text-muted-foreground">Table: {order.table.tableNumber}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="font-semibold">{formatCurrency(order.totalAmount)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                      </div>
                      <Badge variant="outline" className="bg-muted/50">
                        {order.orderStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Order Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold tracking-tight">
                {stats.totalOrders > 0 ? Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              {stats.completedOrders} completed out of {stats.totalOrders} total orders
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Revenue Per Completed Order
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold tracking-tight">
                {formatCurrency(stats.completedOrders > 0 ? stats.totalRevenue / stats.completedOrders : 0)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Average revenue from completed orders
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
