import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { useCurrency, useCurrencyCode } from '@/hooks/useCurrency';
import { statusBadgeColor, paymentStatusBadgeColor } from '@/pages/Configurations';
import {
  Loader2, ShoppingCart, DollarSign, PoundSterling, Euro, IndianRupee, Clock, CheckCircle2, Timer,
  RefreshCw, UtensilsCrossed, User, Phone, Mail, Search, MoreVertical, ArrowRight, Check, Pencil, Trash2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

const CURRENCY_ICONS: Record<string, typeof DollarSign> = {
  GBP: PoundSterling,
  EUR: Euro,
  INR: IndianRupee,
};

type OrderType = 'DineIn' | 'Collection' | 'Delivery';
type OrderStatus = string;
type PaymentStatus = string;
type PaymentMethod = 'Card' | 'Cash' | 'ApplePay' | 'GooglePay';

interface OrderListItem {
  id: string; orderNumber: string; orderType: OrderType; status: OrderStatus; paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod; totalAmount: number; customerName: string | null; createdAt: string;
}

interface OrderItem { id: string; nameSnapshot: string; unitPriceSnapshot: number; quantity: number; lineTotal: number }
interface StatusHistoryEntry { status: OrderStatus; note: string | null; timestamp: string }

interface OrderDetail extends OrderListItem {
  subtotal: number; deliveryFee: number; processingFee: number; discountAmount: number;
  customerPhone: string | null; customerEmail: string | null; specialRequests: string | null;
  estimatedReadyAt: string | null; items: OrderItem[]; statusHistory: StatusHistoryEntry[];
}

interface OrderListPage { items: OrderListItem[]; totalCount: number }
interface OrderStats { totalOrders: number; pendingOrders: number; completedOrders: number; totalRevenue: number }
interface OrderStatusDef { id: string; name: string; displayOrder: number; countsAsCompleted: boolean }
interface PaymentStatusDef { id: string; name: string; displayOrder: number }

const PAGE_SIZE = 25;

const formatTime = (date: string) =>
  new Date(date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

const Orders = () => {
  const { toast } = useToast();
  const currency = useCurrency();
  const currencyCode = useCurrencyCode();
  const CurrencyIcon = CURRENCY_ICONS[currencyCode] ?? DollarSign;
  const formatCurrency = (amount: number) => `${currency}${amount.toFixed(2)}`;
  const queryClient = useQueryClient();

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OrderListItem | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('');
  const [statusNote, setStatusNote] = useState('');
  const [editForm, setEditForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', specialRequests: '' });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterStatus, filterPayment, dateFrom, dateTo]);

  const orderStatusesQuery = useQuery({ queryKey: ['admin', 'order-statuses'], queryFn: () => api.get<OrderStatusDef[]>('/api/admin/order-statuses') });
  const paymentStatusesQuery = useQuery({ queryKey: ['admin', 'payment-statuses'], queryFn: () => api.get<PaymentStatusDef[]>('/api/admin/payment-statuses') });
  const orderStatusDefs = [...(orderStatusesQuery.data?.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const paymentStatusDefs = [...(paymentStatusesQuery.data?.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const ORDER_STATUSES = orderStatusDefs.map((d) => d.name);
  const PAYMENT_STATUSES = paymentStatusDefs.map((d) => d.name);
  const statusColors = (name: string) => statusBadgeColor(orderStatusDefs.find((d) => d.name === name)?.displayOrder ?? 0);
  const paymentStatusColors = (name: string) => paymentStatusBadgeColor(name, paymentStatusDefs.find((d) => d.name === name)?.displayOrder ?? 0);

  const statsQuery = useQuery({ queryKey: ['admin', 'orders', 'stats'], queryFn: () => api.get<OrderStats>('/api/admin/orders/stats') });

  const listParams = new URLSearchParams();
  if (filterStatus !== 'all') listParams.set('status', filterStatus);
  if (filterPayment !== 'all') listParams.set('paymentStatus', filterPayment);
  if (debouncedSearch) listParams.set('search', debouncedSearch);
  if (dateFrom) listParams.set('dateFrom', dateFrom);
  if (dateTo) listParams.set('dateTo', dateTo);
  listParams.set('page', String(page));
  listParams.set('pageSize', String(PAGE_SIZE));

  const ordersQuery = useQuery({
    queryKey: ['admin', 'orders', filterStatus, filterPayment, debouncedSearch, dateFrom, dateTo, page],
    queryFn: () => api.get<OrderListPage>(`/api/admin/orders?${listParams.toString()}`),
  });
  const detailQuery = useQuery({
    queryKey: ['admin', 'orders', 'detail', selectedOrderId],
    queryFn: () => api.get<OrderDetail>(`/api/admin/orders/${selectedOrderId}`),
    enabled: !!selectedOrderId,
  });

  const orders = ordersQuery.data?.data?.items ?? [];
  const totalCount = ordersQuery.data?.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
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

  const editMutation = useMutation({
    mutationFn: () => api.put(`/api/admin/orders/${selectedOrderId}`, {
      customerName: editForm.customerName || null,
      customerPhone: editForm.customerPhone || null,
      customerEmail: editForm.customerEmail || null,
      specialRequests: editForm.specialRequests || null,
    }),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Order details updated.' });
      setIsEditOpen(false);
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders', 'detail'] });
    },
    onError: (error: Error) => toast({ variant: 'destructive', title: 'Error', description: error.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/orders/${id}`),
    onSuccess: () => {
      toast({ title: 'Deleted', description: 'Order removed from the list.' });
      setDeleteTarget(null);
      invalidateAll();
    },
    onError: (error: Error) => toast({ variant: 'destructive', title: 'Error', description: error.message }),
  });

  const openStatusDialog = (order: OrderListItem) => { setSelectedOrderId(order.id); setNewStatus(order.status); setIsStatusDialogOpen(true); };

  const [editLoading, setEditLoading] = useState(false);
  const openEditDialog = async (order: OrderListItem, detail?: OrderDetail | null) => {
    setSelectedOrderId(order.id);
    if (detail) {
      setEditForm({
        customerName: detail.customerName ?? '',
        customerPhone: detail.customerPhone ?? '',
        customerEmail: detail.customerEmail ?? '',
        specialRequests: detail.specialRequests ?? '',
      });
      setIsEditOpen(true);
      return;
    }
    // Row's Edit button only has the list-view fields - fetch full detail first so phone/email/
    // special requests don't get silently wiped by submitting a form that never saw them.
    setEditLoading(true);
    try {
      const res = await api.get<OrderDetail>(`/api/admin/orders/${order.id}`);
      setEditForm({
        customerName: res.data?.customerName ?? '',
        customerPhone: res.data?.customerPhone ?? '',
        customerEmail: res.data?.customerEmail ?? '',
        specialRequests: res.data?.specialRequests ?? '',
      });
      setIsEditOpen(true);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
    } finally {
      setEditLoading(false);
    }
  };

  const quickStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      api.put(`/api/admin/orders/${orderId}/status`, { status, note: null }),
    onSuccess: () => { invalidateAll(); },
    onError: (error: Error) => toast({ variant: 'destructive', title: 'Error', description: error.message }),
  });

  const quickPaymentMutation = useMutation({
    mutationFn: ({ orderId, paymentStatus }: { orderId: string; paymentStatus: PaymentStatus }) =>
      api.put(`/api/admin/orders/${orderId}/payment-status`, { paymentStatus }),
    onSuccess: () => { invalidateAll(); },
    onError: (error: Error) => toast({ variant: 'destructive', title: 'Error', description: error.message }),
  });

  const timeMutation = useMutation({
    mutationFn: ({ orderId, minutes }: { orderId: string; minutes: number }) =>
      api.put(`/api/admin/orders/${orderId}/estimated-time`, { estimatedMinutesFromNow: minutes }),
    onSuccess: () => { toast({ title: 'Success', description: 'Estimated time set.' }); invalidateAll(); },
    onError: (error: Error) => toast({ variant: 'destructive', title: 'Error', description: error.message }),
  });

  // Advance one step in the admin-configured order (arrow), the "..." menu still offers a
  // notes-based jump-to-any-status for cases that need an audit note.
  const nextStatusName = (current: OrderStatus) => {
    const idx = ORDER_STATUSES.indexOf(current);
    if (idx === -1 || idx >= ORDER_STATUSES.length - 1) return null;
    return ORDER_STATUSES[idx + 1];
  };
  const completedStatusName = () => orderStatusDefs.find((d) => d.countsAsCompleted)?.name ?? null;

  const nextPaymentName = (current: PaymentStatus) => {
    const idx = PAYMENT_STATUSES.indexOf(current);
    if (idx === -1 || idx >= PAYMENT_STATUSES.length - 1) return null;
    return PAYMENT_STATUSES[idx + 1];
  };
  const paidStatusName = () => paymentStatusDefs.find((d) => d.name.toLowerCase() === 'paid')?.name ?? PAYMENT_STATUSES[PAYMENT_STATUSES.length - 1] ?? null;

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
            <CurrencyIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div></CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order # or customer..." className="pl-8" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 shrink-0"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="w-40 shrink-0"><SelectValue placeholder="All Payments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 shrink-0">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" aria-label="From date" />
          <span className="text-muted-foreground text-sm">–</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" aria-label="To date" />
        </div>
        {(search || filterStatus !== 'all' || filterPayment !== 'all' || dateFrom || dateTo) && (
          <Button
            variant="ghost" size="sm"
            onClick={() => { setSearch(''); setFilterStatus('all'); setFilterPayment('all'); setDateFrom(''); setDateTo(''); }}
          >
            Clear
          </Button>
        )}
        <span className="text-sm text-muted-foreground shrink-0 ml-auto">{totalCount} order{totalCount !== 1 ? 's' : ''}</span>
      </div>

      <Card>
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
              <div className="hidden lg:grid grid-cols-[70px_1fr_100px_90px_100px_220px_190px_36px_36px] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>Order</span>
                <span>Customer</span>
                <span />
                <span>Total</span>
                <span>Time</span>
                <span>Status</span>
                <span>Payment</span>
                <span />
                <span />
              </div>
              {orders.map((order) => {
                const nextS = nextStatusName(order.status);
                const doneS = completedStatusName();
                const nextP = nextPaymentName(order.paymentStatus);
                const paidP = paidStatusName();
                return (
                  <div
                    key={order.id}
                    onClick={() => openOrder(order.id)}
                    className="grid grid-cols-1 lg:grid-cols-[70px_1fr_100px_90px_100px_220px_190px_36px_36px] gap-3 px-4 py-3 hover:bg-muted/30 transition-colors items-center cursor-pointer"
                  >
                    <div>
                      <span className="font-mono font-semibold text-sm">#{order.orderNumber}</span>
                    </div>

                    <div className="min-w-0">
                      <p className="font-medium truncate">{order.customerName || 'Guest'}</p>
                      <p className="text-sm text-muted-foreground">{formatTime(order.createdAt)}</p>
                    </div>

                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant="secondary">{order.orderType}</Badge>
                      <Badge variant="outline">{order.paymentMethod}</Badge>
                    </div>

                    <div className="font-medium">{formatCurrency(order.totalAmount)}</div>

                    <div onClick={(e) => e.stopPropagation()}>
                      <EstimatedTimeButton
                        onSet={(minutes) => timeMutation.mutate({ orderId: order.id, minutes })}
                        pending={timeMutation.isPending}
                      />
                    </div>

                    <div className="flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <div className={`flex items-stretch rounded-md overflow-hidden flex-1 min-w-0 ${statusColors(order.status)}`}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" title={order.status} className="flex-1 min-w-0 px-3 py-2 text-sm font-semibold text-left truncate">
                              {order.status}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {ORDER_STATUSES.map((s) => (
                              <DropdownMenuItem key={s} onClick={() => quickStatusMutation.mutate({ orderId: order.id, status: s })}>
                                {s === order.status && <Check className="w-4 h-4 mr-2" />}
                                <span className={s === order.status ? '' : 'ml-6'}>{s}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <button
                          type="button"
                          title={nextS ? `Next status: ${nextS}` : 'No next status'}
                          disabled={!nextS || quickStatusMutation.isPending}
                          onClick={() => nextS && quickStatusMutation.mutate({ orderId: order.id, status: nextS })}
                          className="px-2 border-l border-black/10 bg-black/5 hover:bg-black/10 disabled:opacity-30 flex items-center shrink-0"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title={doneS ? `Mark as ${doneS}` : 'No completed status configured'}
                          disabled={!doneS || doneS === order.status || quickStatusMutation.isPending}
                          onClick={() => doneS && quickStatusMutation.mutate({ orderId: order.id, status: doneS })}
                          className="px-2 border-l border-black/10 bg-black/5 hover:bg-black/10 disabled:opacity-30 flex items-center shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="More status options"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openStatusDialog(order)}>Jump to Status (with note)</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                      <div className={`flex items-stretch rounded-md overflow-hidden ${paymentStatusColors(order.paymentStatus)}`}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" title={order.paymentStatus} className="flex-1 min-w-0 px-3 py-2 text-sm font-semibold text-left truncate">
                              {order.paymentStatus}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {PAYMENT_STATUSES.map((s) => (
                              <DropdownMenuItem key={s} onClick={() => quickPaymentMutation.mutate({ orderId: order.id, paymentStatus: s })}>
                                {s === order.paymentStatus && <Check className="w-4 h-4 mr-2" />}
                                <span className={s === order.paymentStatus ? '' : 'ml-6'}>{s}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <button
                          type="button"
                          title={nextP ? `Next: ${nextP}` : 'No next status'}
                          disabled={!nextP || quickPaymentMutation.isPending}
                          onClick={() => nextP && quickPaymentMutation.mutate({ orderId: order.id, paymentStatus: nextP })}
                          className="px-2 border-l border-black/10 bg-black/5 hover:bg-black/10 disabled:opacity-30 flex items-center shrink-0"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title={paidP ? `Mark as ${paidP}` : 'No paid status configured'}
                          disabled={!paidP || paidP === order.paymentStatus || quickPaymentMutation.isPending}
                          onClick={() => paidP && quickPaymentMutation.mutate({ orderId: order.id, paymentStatus: paidP })}
                          className="px-2 border-l border-black/10 bg-black/5 hover:bg-black/10 disabled:opacity-30 flex items-center shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit order" disabled={editLoading} onClick={() => openEditDialog(order)}>
                        {editLoading && selectedOrderId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                      </Button>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label="Delete order" onClick={() => setDeleteTarget(order)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeft className="w-4 h-4 mr-1" />Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Next<ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

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
                  <div className="space-y-1"><p className="text-sm font-medium">Order Number</p><p className="text-sm text-muted-foreground font-mono">#{selectedOrder.orderNumber}</p></div>
                  <div className="space-y-1"><p className="text-sm font-medium">Created</p><p className="text-sm text-muted-foreground">{formatTime(selectedOrder.createdAt)}</p></div>
                  <div className="space-y-1"><p className="text-sm font-medium">Status</p><Badge variant="outline" className={statusColors(selectedOrder.status)}>{selectedOrder.status}</Badge></div>
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
                    <div className="flex items-center justify-between"><span className="text-sm">Payment Status</span><Badge variant="outline" className={paymentStatusColors(selectedOrder.paymentStatus)}>{selectedOrder.paymentStatus}</Badge></div>
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
                            <Badge variant="outline" className={statusColors(h.status)}>{h.status}</Badge>
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
            <Button
              variant="outline"
              onClick={() => { if (selectedOrder) { const o = orders.find((x) => x.id === selectedOrder.id) ?? selectedOrder; openEditDialog(o, selectedOrder); setIsDetailsOpen(false); } }}
            >
              <Pencil className="w-4 h-4 mr-2" />Edit
            </Button>
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

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
            <DialogDescription>Only contact details and notes can be changed after placement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Customer Name</Label>
              <Input id="editName" value={editForm.customerName} onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })} disabled={editMutation.isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhone">Phone</Label>
              <Input id="editPhone" value={editForm.customerPhone} onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })} disabled={editMutation.isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email</Label>
              <Input id="editEmail" type="email" value={editForm.customerEmail} onChange={(e) => setEditForm({ ...editForm, customerEmail: e.target.value })} disabled={editMutation.isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRequests">Special Requests</Label>
              <Textarea id="editRequests" value={editForm.specialRequests} onChange={(e) => setEditForm({ ...editForm, specialRequests: e.target.value })} rows={3} disabled={editMutation.isPending} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={editMutation.isPending}>Cancel</Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
              {editMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete order #{deleteTarget?.orderNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the order from all lists and reports. It's a soft delete - the record itself is kept for financial history, but it won't show up anywhere in the admin panel again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function EstimatedTimeButton({ onSet, pending }: { onSet: (minutes: number) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <Timer className="w-3.5 h-3.5 mr-1.5" />Time
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <Label htmlFor="est-minutes" className="text-xs text-muted-foreground">Minutes from now</Label>
        <div className="flex items-center gap-2 mt-1.5">
          <Input
            id="est-minutes" type="number" min="0" value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="e.g. 15"
            className="h-8"
          />
          <Button
            size="icon" className="h-8 w-8 shrink-0"
            disabled={!minutes || pending}
            onClick={() => { onSet(parseInt(minutes, 10)); setOpen(false); setMinutes(''); }}
          >
            <Check className="w-4 h-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default Orders;
