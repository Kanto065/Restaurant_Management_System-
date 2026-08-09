import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { Loader2, ShoppingCart, DollarSign, Clock, CheckCircle2, Eye, Timer, RefreshCw, UtensilsCrossed, User, Phone, Mail, MapPin } from 'lucide-react';
import { API_BASE_URL, getImageUrl } from '@/config/api';

interface OrderItem {
  food: {
    _id: string;
    name: string;
    image?: string;
    category: string;
  };
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
  _id: string;
}

interface Order {
  _id: string;
  restaurant: string;
  table: {
    _id: string;
    tableNumber: string;
    location: string;
    capacity?: number;
  };
  items: OrderItem[];
  totalAmount: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  estimatedTime: number | null;
  specialRequests?: string;
  orderNumber: string;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    note?: string;
    _id: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
}

const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'] as const;
const PAYMENT_STATUSES = ['all', 'pending', 'paid', 'failed'] as const;
const PAYMENT_STATUS_UPDATE = ['pending', 'completed', 'failed', 'refunded'] as const;
const PAYMENT_METHODS = ['all', 'cash', 'card', 'online'] as const;

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-300',
  confirmed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300',
  preparing: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-300',
  ready: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-300',
  served: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300',
  completed: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-300',
  cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-300',
};

const paymentStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  paid: 'bg-green-500/10 text-green-700 dark:text-green-400',
  completed: 'bg-green-500/10 text-green-700 dark:text-green-400',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-400',
  refunded: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
};

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [newPaymentStatus, setNewPaymentStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all');
  const { toast } = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle opening order from URL or navigation state
  useEffect(() => {
    const orderId = searchParams.get('orderId') || location.state?.orderId;
    if (orderId && orders.length > 0) {
      fetchOrderDetails(orderId);
      // Clear the URL parameter after opening
      if (searchParams.get('orderId')) {
        searchParams.delete('orderId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [orders, searchParams, location.state]);

  useEffect(() => {
    fetchStats();
    fetchOrders();
  }, [filterStatus, filterPaymentStatus, filterPaymentMethod]);

  const fetchStats = async () => {
    try {
      const response = await api.get<{ stats: OrderStats }>('/api/orders/stats');
      setStats(response.data?.stats || { totalOrders: 0, pendingOrders: 0, completedOrders: 0, totalRevenue: 0 });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterPaymentStatus !== 'all') params.append('paymentStatus', filterPaymentStatus);
      if (filterPaymentMethod !== 'all') params.append('paymentMethod', filterPaymentMethod);
      const queryString = params.toString();
      const url = `/api/orders${queryString ? `?${queryString}` : ''}`;
      const response = await api.get<{ orders: Order[]; count: number }>(url);
      setOrders(response.data?.orders || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to fetch orders' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrderDetails = async (orderId: string) => {
    try {
      const response = await api.get<{ order: Order }>(`/api/orders/${orderId}`);
      if (response.data?.order) {
        setSelectedOrder(response.data.order);
        setIsDetailsOpen(true);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to fetch order details' });
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return;
    setIsSubmitting(true);
    try {
      const response = await api.put<{ order: Order }>(`/api/orders/${selectedOrder._id}/status`, {
        status: newStatus,
        ...(statusNote && { note: statusNote })
      });
      if (response.data?.order) {
        setOrders(orders.map(o => o._id === selectedOrder._id ? response.data!.order : o));
        setSelectedOrder(response.data.order);
      }
      toast({ title: 'Success', description: 'Order status updated successfully' });
      setIsStatusDialogOpen(false);
      setNewStatus('');
      setStatusNote('');
      fetchStats();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to update order status' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetEstimatedTime = async () => {
    if (!selectedOrder || !estimatedTime) return;
    setIsSubmitting(true);
    try {
      const response = await api.put<{ order: Order }>(`/api/orders/${selectedOrder._id}/estimated-time`, {
        estimatedTime: parseInt(estimatedTime)
      });
      if (response.data?.order) {
        setOrders(orders.map(o => o._id === selectedOrder._id ? response.data!.order : o));
        setSelectedOrder(response.data.order);
      }
      toast({ title: 'Success', description: `Estimated time set to ${estimatedTime} minutes` });
      setIsTimeDialogOpen(false);
      setEstimatedTime('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to set estimated time' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openStatusDialog = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.orderStatus);
    setIsStatusDialogOpen(true);
  };

  const openTimeDialog = (order: Order) => {
    setSelectedOrder(order);
    setEstimatedTime(order.estimatedTime?.toString() || '');
    setIsTimeDialogOpen(true);
  };

  const openPaymentDialog = (order: Order) => {
    setSelectedOrder(order);
    setNewPaymentStatus(order.paymentStatus);
    setIsPaymentDialogOpen(true);
  };

  const handleUpdatePaymentStatus = async () => {
    if (!selectedOrder || !newPaymentStatus) return;
    setIsSubmitting(true);
    try {
      const response = await api.put<{ order: Order }>(`/api/orders/${selectedOrder._id}/payment-status`, {
        paymentStatus: newPaymentStatus
      });
      if (response.data?.order) {
        setOrders(orders.map(o => o._id === selectedOrder._id ? response.data!.order : o));
        setSelectedOrder(response.data.order);
      }
      toast({ title: 'Success', description: 'Payment status updated successfully' });
      setIsPaymentDialogOpen(false);
      setNewPaymentStatus('');
      fetchStats();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to update payment status' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">Manage and track customer orders</p>
        </div>
        <Button onClick={fetchOrders} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Order Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {ORDER_STATUSES.map(status => (<SelectItem key={status} value={status}>{status}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map(status => (<SelectItem key={status} value={status}>{status}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(method => (<SelectItem key={method} value={method}>{method}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders List</CardTitle>
          <CardDescription>{orders.length} order{orders.length !== 1 ? 's' : ''} found</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <ShoppingCart className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium mb-1">No orders found</p>
              <p className="text-sm text-muted-foreground">Orders will appear here once customers place them</p>
            </div>
          ) : (
            <div className="divide-y">
              {orders.map((order) => (
                <div
                  key={order._id}
                  className="p-6 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-6">
                    {/* Left Section - Order Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <ShoppingCart className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-base">{order.orderNumber}</span>
                            <Badge variant="outline" className={statusColors[order.orderStatus]}>
                              {order.orderStatus}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{formatTime(order.createdAt)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 pl-[52px]">
                        {/* Table Info */}
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-sm font-medium">{order.table.tableNumber}</span>
                            <span className="text-sm text-muted-foreground"> • {order.table.location}</span>
                          </div>
                        </div>

                        {/* Customer Info */}
                        {order.customerName && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="text-sm font-medium">{order.customerName}</span>
                              {order.customerPhone && (
                                <span className="text-sm text-muted-foreground"> • {order.customerPhone}</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Items Count */}
                        <div className="flex items-center gap-2">
                          <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                        </div>

                        {/* Payment Info */}
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={paymentStatusColors[order.paymentStatus]}>
                              {order.paymentStatus}
                            </Badge>
                            <span className="text-sm text-muted-foreground capitalize">via {order.paymentMethod}</span>
                          </div>
                        </div>

                        {/* Estimated Time */}
                        {order.estimatedTime && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{order.estimatedTime} min</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Section - Total & Actions */}
                    <div className="flex items-start gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">Total</p>
                        <p className="text-2xl font-bold">{formatCurrency(order.totalAmount)}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => fetchOrderDetails(order._id)}
                          className="w-full"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => openStatusDialog(order)}
                          className="w-full"
                        >
                          Status
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => openTimeDialog(order)}
                          className="w-full"
                        >
                          <Timer className="w-4 h-4 mr-2" />
                          Time
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => openPaymentDialog(order)}
                          className="w-full"
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
                          Pay
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>{selectedOrder?.orderNumber}</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <ScrollArea className="max-h-[calc(90vh-200px)]">
              <div className="space-y-6 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Order Number</p>
                    <p className="text-sm text-muted-foreground">{selectedOrder.orderNumber}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-sm text-muted-foreground">{formatTime(selectedOrder.createdAt)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Status</p>
                    <Badge variant="outline" className={statusColors[selectedOrder.orderStatus]}>{selectedOrder.orderStatus}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Estimated Time</p>
                    <p className="text-sm text-muted-foreground">{selectedOrder.estimatedTime ? `${selectedOrder.estimatedTime} minutes` : 'Not set'}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />Table Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Table Number</p>
                      <p className="text-sm text-muted-foreground">{selectedOrder.table.tableNumber}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">{selectedOrder.table.location}</p>
                    </div>
                    {selectedOrder.table.capacity && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Capacity</p>
                        <p className="text-sm text-muted-foreground">{selectedOrder.table.capacity} seats</p>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
                {selectedOrder.customerName && (
                  <>
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <User className="w-4 h-4" />Customer Information
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{selectedOrder.customerName}</span>
                        </div>
                        {selectedOrder.customerPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{selectedOrder.customerPhone}</span>
                          </div>
                        )}
                        {selectedOrder.customerEmail && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{selectedOrder.customerEmail}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4" />Order Items
                  </h4>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item) => (
                      <div key={item._id} className="flex gap-3 p-3 rounded-lg border">
                        {item.food.image ? (
                          <img src={getImageUrl(item.food.image)} alt={item.name} className="w-16 h-16 rounded object-cover" />
                        ) : (
                          <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                            <UtensilsCrossed className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <Badge variant="outline" className="mt-1">{item.food.category}</Badge>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(item.price)}</p>
                              <p className="text-sm text-muted-foreground">x {item.quantity}</p>
                            </div>
                          </div>
                          {item.specialInstructions && (
                            <p className="text-sm text-muted-foreground mt-2">Note: {item.specialInstructions}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedOrder.specialRequests && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">Special Requests</h4>
                      <p className="text-sm text-muted-foreground">{selectedOrder.specialRequests}</p>
                    </div>
                  </>
                )}
                <Separator />
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />Payment Information
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Payment Method</span>
                      <span className="text-sm font-medium capitalize">{selectedOrder.paymentMethod}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Payment Status</span>
                      <Badge variant="outline" className={paymentStatusColors[selectedOrder.paymentStatus]}>{selectedOrder.paymentStatus}</Badge>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="font-semibold">Total Amount</span>
                      <span className="text-xl font-bold text-primary">{formatCurrency(selectedOrder.totalAmount)}</span>
                    </div>
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-3">Status History</h4>
                  <div className="space-y-2">
                    {selectedOrder.statusHistory.map((history, index) => (
                      <div key={history._id} className="flex items-start gap-3">
                        <div className="mt-1">
                          <div className={`w-2 h-2 rounded-full ${index === selectedOrder.statusHistory.length - 1 ? 'bg-primary' : 'bg-muted'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className={statusColors[history.status]}>{history.status}</Badge>
                            <span className="text-xs text-muted-foreground">{formatTime(history.timestamp)}</span>
                          </div>
                          {history.note && (<p className="text-sm text-muted-foreground mt-1">{history.note}</p>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Close</Button>
            <Button onClick={() => {
              if (selectedOrder) {
                openStatusDialog(selectedOrder);
                setIsDetailsOpen(false);
              }
            }}>Update Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>Change the status of order {selectedOrder?.orderNumber}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">New Status *</Label>
              <Select value={newStatus} onValueChange={setNewStatus} disabled={isSubmitting}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map(status => (<SelectItem key={status} value={status}>{status}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea id="note" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Add a note about this status change" rows={3} disabled={isSubmitting} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleUpdateStatus} disabled={isSubmitting || !newStatus}>
              {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>) : ('Update Status')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTimeDialogOpen} onOpenChange={setIsTimeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Estimated Time</DialogTitle>
            <DialogDescription>Set the estimated preparation time for order {selectedOrder?.orderNumber}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="estimatedTime">Estimated Time (minutes) *</Label>
              <Input id="estimatedTime" type="number" min="0" value={estimatedTime} onChange={(e) => setEstimatedTime(e.target.value)} placeholder="e.g., 15" disabled={isSubmitting} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTimeDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSetEstimatedTime} disabled={isSubmitting || !estimatedTime}>
              {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting...</>) : ('Set Time')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
            <DialogDescription>Change the payment status of order {selectedOrder?.orderNumber}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paymentStatus">New Payment Status *</Label>
              <Select value={newPaymentStatus} onValueChange={setNewPaymentStatus} disabled={isSubmitting}>
                <SelectTrigger><SelectValue placeholder="Select payment status" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUS_UPDATE.map(status => (<SelectItem key={status} value={status}>{status}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleUpdatePaymentStatus} disabled={isSubmitting || !newPaymentStatus}>
              {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>) : ('Update Payment Status')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;
