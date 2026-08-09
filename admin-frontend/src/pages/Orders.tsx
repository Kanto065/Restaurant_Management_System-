import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Loader2, ShoppingCart, DollarSign, Clock, CheckCircle2, Eye, Timer, RefreshCw, UtensilsCrossed, User, Phone, Mail } from 'lucide-react';

type OrderType = 'DineIn' | 'Collection' | 'Delivery';
type OrderStatus = 'Pending' | 'Confirmed' | 'Preparing' | 'Ready' | 'OutForDeliveryOrServed' | 'Completed' | 'Cancelled';
type PaymentStatus = 'Pending' | 'Authorized' | 'Paid' | 'Failed' | 'Refunded' | 'PartiallyRefunded';
type PaymentMethod = 'Card' | 'Cash' | 'ApplePay' | 'GooglePay';

interface OrderListItem {
  id: string; orderNumber: number; orderType: OrderType; status: OrderStatus; paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod; totalAmount: number; customerName: string | null; createdAt: string;
}

interface OrderItem { id: string; nameSnapshot: string; unitPriceSnapshot: number; quantity: number; lineTotal: number }
interface StatusHistoryEntry { status: OrderStatus; note: string | null; timestamp: string }

interface OrderDetail extends OrderListItem {
  subtotal: number; deliveryFee: number; processingFee: number; discountAmount: number;
  customerPhone: string | null; customerEmail: string | null; specialRequests: string | null;
  estimatedReadyAt: string | null; items: OrderItem[]; statusHistory: StatusHistoryEntry[];
}

interface OrderStats { totalOrders: number; pendingOrders: number; completedOrders: number; totalRevenue: number }

const ORDER_STATUSES: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'OutForDeliveryOrServed', 'Completed', 'Cancelled'];
const PAYMENT_STATUSES: PaymentStatus[] = ['Pending', 'Authorized', 'Paid', 'Failed', 'Refunded', 'PartiallyRefunded'];

const statusColors: Record<OrderStatus, string> = {
  Pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-300',
  Confirmed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300',
  Preparing: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-300',
  Ready: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-300',
  OutForDeliveryOrServed: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300',
  Completed: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-300',
  Cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-300',
};

const paymentStatusColors: Record<PaymentStatus, string> = {
  Pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  Authorized: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  Paid: 'bg-green-500/10 text-green-700 dark:text-green-400',
  Failed: 'bg-red-500/10 text-red-700 dark:text-red-400',
  Refunded: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  PartiallyRefunded: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
};

const formatTime = (date: string) => new Date(date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const formatCurrency = (amount: number) => `£${amount.toFixed(2)}`;

const Orders = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('');
  const [statusNote, setStatusNote] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [newPaymentStatus, setNewPaymentStatus] = useState<PaymentStatus | ''>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const statsQuery = useQuery({ queryKey: ['admin', 'orders', 'stats'], queryFn: () => api.get<OrderStats>('/api/admin/orders/stats') });
  const ordersQuery = useQuery({
    queryKey: ['admin', 'orders', filterStatus],
    queryFn: () => api.get<OrderListItem[]>(`/api/admin/orders${filterStatus !== 'all' ? `?status=${filterStatus}` : ''}`),
  });
  const detailQuery = useQuery({
    queryKey: ['admin', 'orders', 'detail', selectedOrderId],
    queryFn: () => api.get<OrderDetail>(`/api/admin/orders/${selectedOrderId}`),
    enabled: !!selectedOrderId,
  });

  const orders = ordersQuery.data?.data ?? [];
  const stats = statsQuery.data?.data ?? { totalOrders: 0, pendingOrders: 0, completedOrders: 0, totalRevenue: 0 };
  const selectedOrder = detailQuery.data?.data ?? null;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
  };

  const openOrder = (id: string) => { setSelectedOrderId(id); setIsDetailsOpen(true); };

  const updateStatusMutation = useMutation({
    mutationFn: () => api.put(`/api/admin/orders/${selectedOrderId}/status`, { status: newStatus, note: statusNote || null }),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Order status updated.' });
      setIsStatusDialogOpen(false); setNewStatus(''); setStatusNote('');
      invalidateAll();
    },
    onError: (error: Error) => toast({ variant: 'destructive', title: 'Error', description: error.message }),
  });

  const setTimeMutation = useMutation({
    mutationFn: () => api.put(`/api/admin/orders/${selectedOrderId}/estimated-time`, { estimatedMinutesFromNow: parseInt(estimatedMinutes, 10) }),
    onSuccess: () => {
      toast({ title: 'Success', description: `Estimated time set to ${estimatedMinutes} minutes from now.` });
      setIsTimeDialogOpen(false); setEstimatedMinutes('');
      invalidateAll();
    },
    onError: (error: Error) => toast({ variant: 'destructive', title: 'Error', description: error.message }),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: () => api.put(`/api/admin/orders/${selectedOrderId}/payment-status`, { paymentStatus: newPaymentStatus }),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Payment status updated.' });
      setIsPaymentDialogOpen(false); setNewPaymentStatus('');
      invalidateAll();
    },
    onError: (error: Error) => toast({ variant: 'destructive', title: 'Error', description: error.message }),
  });

  const openStatusDialog = (order: OrderListItem) => { setSelectedOrderId(order.id); setNewStatus(order.status); setIsStatusDialogOpen(true); };
  const openTimeDialog = (order: OrderListItem) => { setSelectedOrderId(order.id); setEstimatedMinutes(''); setIsTimeDialogOpen(true); };
  const openPaymentDialog = (order: OrderListItem) => { setSelectedOrderId(order.id); setNewPaymentStatus(order.paymentStatus); setIsPaymentDialogOpen(true); };

  if (ordersQuery.isLoading) {
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
        <Button onClick={() => { ordersQuery.refetch(); statsQuery.refetch(); }} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalOrders}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.pendingOrders}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.completedOrders}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label>Order Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
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
                <div key={order.id} className="p-6 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-6 flex-wrap">
                    <div className="flex-1 space-y-3 min-w-[240px]">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <ShoppingCart className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-base">#{order.orderNumber}</span>
                            <Badge variant="outline" className={statusColors[order.status]}>{order.status}</Badge>
                            <Badge variant="secondary">{order.orderType}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{formatTime(order.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 pl-[52px]">
                        {order.customerName && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{order.customerName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="outline" className={paymentStatusColors[order.paymentStatus]}>{order.paymentStatus}</Badge>
                          <span className="text-sm text-muted-foreground">via {order.paymentMethod}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">Total</p>
                        <p className="text-2xl font-bold">{formatCurrency(order.totalAmount)}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" onClick={() => openOrder(order.id)} className="w-full"><Eye className="w-4 h-4 mr-2" />View</Button>
                        <Button variant="outline" size="sm" onClick={() => openStatusDialog(order)} className="w-full">Status</Button>
                        <Button variant="outline" size="sm" onClick={() => openTimeDialog(order)} className="w-full"><Timer className="w-4 h-4 mr-2" />Time</Button>
                        <Button variant="outline" size="sm" onClick={() => openPaymentDialog(order)} className="w-full"><DollarSign className="w-4 h-4 mr-2" />Pay</Button>
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
            <DialogDescription>{selectedOrder ? `#${selectedOrder.orderNumber}` : ''}</DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading && <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" />}
          {selectedOrder && (
            <ScrollArea className="max-h-[calc(90vh-200px)]">
              <div className="space-y-6 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><p className="text-sm font-medium">Order Number</p><p className="text-sm text-muted-foreground">#{selectedOrder.orderNumber}</p></div>
                  <div className="space-y-1"><p className="text-sm font-medium">Created</p><p className="text-sm text-muted-foreground">{formatTime(selectedOrder.createdAt)}</p></div>
                  <div className="space-y-1"><p className="text-sm font-medium">Status</p><Badge variant="outline" className={statusColors[selectedOrder.status]}>{selectedOrder.status}</Badge></div>
                  <div className="space-y-1"><p className="text-sm font-medium">Estimated Ready</p><p className="text-sm text-muted-foreground">{selectedOrder.estimatedReadyAt ? formatTime(selectedOrder.estimatedReadyAt) : 'Not set'}</p></div>
                </div>
                <Separator />
                {(selectedOrder.customerName || selectedOrder.customerPhone || selectedOrder.customerEmail) && (
                  <>
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2"><User className="w-4 h-4" />Customer Information</h4>
                      <div className="space-y-2">
                        {selectedOrder.customerName && <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /><span className="text-sm">{selectedOrder.customerName}</span></div>}
                        {selectedOrder.customerPhone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span className="text-sm">{selectedOrder.customerPhone}</span></div>}
                        {selectedOrder.customerEmail && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><span className="text-sm">{selectedOrder.customerEmail}</span></div>}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2"><UtensilsCrossed className="w-4 h-4" />Order Items</h4>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                        <span className="font-medium">{item.quantity} x {item.nameSnapshot}</span>
                        <span className="font-medium">{formatCurrency(item.lineTotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedOrder.specialRequests && (
                  <>
                    <Separator />
                    <div><h4 className="font-semibold mb-2">Special Requests</h4><p className="text-sm text-muted-foreground">{selectedOrder.specialRequests}</p></div>
                  </>
                )}
                <Separator />
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" />Payment Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><span className="text-sm">Subtotal</span><span className="text-sm">{formatCurrency(selectedOrder.subtotal)}</span></div>
                    {selectedOrder.deliveryFee > 0 && <div className="flex items-center justify-between"><span className="text-sm">Delivery Fee</span><span className="text-sm">{formatCurrency(selectedOrder.deliveryFee)}</span></div>}
                    {selectedOrder.processingFee > 0 && <div className="flex items-center justify-between"><span className="text-sm">Processing Fee</span><span className="text-sm">{formatCurrency(selectedOrder.processingFee)}</span></div>}
                    {selectedOrder.discountAmount > 0 && <div className="flex items-center justify-between"><span className="text-sm">Discount</span><span className="text-sm">-{formatCurrency(selectedOrder.discountAmount)}</span></div>}
                    <div className="flex items-center justify-between"><span className="text-sm">Payment Method</span><span className="text-sm font-medium">{selectedOrder.paymentMethod}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm">Payment Status</span><Badge variant="outline" className={paymentStatusColors[selectedOrder.paymentStatus]}>{selectedOrder.paymentStatus}</Badge></div>
                    <div className="flex items-center justify-between pt-2 border-t"><span className="font-semibold">Total Amount</span><span className="text-xl font-bold text-primary">{formatCurrency(selectedOrder.totalAmount)}</span></div>
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-3">Status History</h4>
                  <div className="space-y-2">
                    {selectedOrder.statusHistory.map((h, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="mt-1"><div className={`w-2 h-2 rounded-full ${index === selectedOrder.statusHistory.length - 1 ? 'bg-primary' : 'bg-muted'}`} /></div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className={statusColors[h.status]}>{h.status}</Badge>
                            <span className="text-xs text-muted-foreground">{formatTime(h.timestamp)}</span>
                          </div>
                          {h.note && <p className="text-sm text-muted-foreground mt-1">{h.note}</p>}
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
            <Button onClick={() => { if (selectedOrder) { setNewStatus(selectedOrder.status); setIsStatusDialogOpen(true); setIsDetailsOpen(false); } }}>Update Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>Change the order's status</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">New Status *</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as OrderStatus)} disabled={updateStatusMutation.isPending}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>{ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea id="note" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={3} disabled={updateStatusMutation.isPending} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)} disabled={updateStatusMutation.isPending}>Cancel</Button>
            <Button onClick={() => updateStatusMutation.mutate()} disabled={updateStatusMutation.isPending || !newStatus}>
              {updateStatusMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>) : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTimeDialogOpen} onOpenChange={setIsTimeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Estimated Time</DialogTitle>
            <DialogDescription>Minutes from now until the order is ready</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="estimatedTime">Minutes from now *</Label>
              <Input id="estimatedTime" type="number" min="0" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} placeholder="e.g., 15" disabled={setTimeMutation.isPending} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTimeDialogOpen(false)} disabled={setTimeMutation.isPending}>Cancel</Button>
            <Button onClick={() => setTimeMutation.mutate()} disabled={setTimeMutation.isPending || !estimatedMinutes}>
              {setTimeMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting...</>) : 'Set Time'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
            <DialogDescription>Change the order's payment status</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paymentStatus">New Payment Status *</Label>
              <Select value={newPaymentStatus} onValueChange={(v) => setNewPaymentStatus(v as PaymentStatus)} disabled={updatePaymentMutation.isPending}>
                <SelectTrigger><SelectValue placeholder="Select payment status" /></SelectTrigger>
                <SelectContent>{PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)} disabled={updatePaymentMutation.isPending}>Cancel</Button>
            <Button onClick={() => updatePaymentMutation.mutate()} disabled={updatePaymentMutation.isPending || !newPaymentStatus}>
              {updatePaymentMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>) : 'Update Payment Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;
