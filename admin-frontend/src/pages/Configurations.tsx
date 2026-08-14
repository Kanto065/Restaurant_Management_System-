import { useLayoutEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, GripVertical, Loader2, Settings2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';

interface OrderStatusDef { id: string; name: string; displayOrder: number; countsAsPending: boolean; countsAsCompleted: boolean; isDefault: boolean }
interface PaymentStatusDef { id: string; name: string; displayOrder: number; isDefault: boolean }

const BADGE_PALETTE = [
  'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-300',
  'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300',
  'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-300',
  'bg-green-500/10 text-green-700 dark:text-green-400 border-green-300',
  'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300',
  'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-300',
  'bg-red-500/10 text-red-700 dark:text-red-400 border-red-300',
];
export const statusBadgeColor = (displayOrder: number) => BADGE_PALETTE[displayOrder % BADGE_PALETTE.length];

// Payment statuses get semantic colors by name (Paid=green, Failed=red, ...) instead of the
// plain positional cycle above - that cycle assigned colors purely by DisplayOrder, so "Paid"
// and "Failed" ended up red/green at random depending on how they happened to be ordered.
// Falls back to the positional palette for any custom status name that isn't recognized.
const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-300',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-300',
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-300',
  authorized: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300',
  refunded: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-300',
  partiallyrefunded: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-300',
};
export const paymentStatusBadgeColor = (name: string, displayOrder: number) =>
  PAYMENT_STATUS_COLORS[name.toLowerCase().replace(/\s+/g, '')] ?? statusBadgeColor(displayOrder);

// --- Order status editor ---------------------------------------------------

function OrderStatusEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogItem, setDialogItem] = useState<OrderStatusDef | 'new' | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [countsAsPending, setCountsAsPending] = useState(false);
  const [countsAsCompleted, setCountsAsCompleted] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRects = useRef(new Map<string, DOMRect>());

  const queryKey = ['admin', 'order-statuses'];
  const query = useQuery({ queryKey, queryFn: () => api.get<OrderStatusDef[]>('/api/admin/order-statuses') });
  const items = [...(query.data?.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { name, countsAsPending, countsAsCompleted, isDefault };
      return dialogItem && dialogItem !== 'new'
        ? api.put(`/api/admin/order-statuses/${dialogItem.id}`, payload)
        : api.post('/api/admin/order-statuses', payload);
    },
    onSuccess: () => { toast({ title: 'Success', description: 'Status saved.' }); invalidate(); closeDialog(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/order-statuses/${id}`),
    onSuccess: () => { toast({ title: 'Success', description: 'Status removed.' }); invalidate(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    onSettled: () => setDeleteId(null),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => api.put('/api/admin/order-statuses/reorder', { orderedIds }),
    onSuccess: invalidate,
    onError: (error: Error) => { toast({ title: 'Error', description: error.message, variant: 'destructive' }); invalidate(); },
  });

  const openDialog = (item: OrderStatusDef | 'new') => {
    setDialogItem(item);
    if (item === 'new') { setName(''); setCountsAsPending(false); setCountsAsCompleted(false); setIsDefault(false); }
    else { setName(item.name); setCountsAsPending(item.countsAsPending); setCountsAsCompleted(item.countsAsCompleted); setIsDefault(item.isDefault); }
  };
  const closeDialog = () => setDialogItem(null);

  const captureRectsForFlip = () => {
    prevRects.current.clear();
    for (const [id, el] of rowRefs.current) prevRects.current.set(id, el.getBoundingClientRect());
  };
  useLayoutEffect(() => {
    if (prevRects.current.size === 0) return;
    for (const [id, el] of rowRefs.current) {
      const prev = prevRects.current.get(id);
      if (!prev) continue;
      const next = el.getBoundingClientRect();
      const deltaY = prev.top - next.top;
      if (deltaY === 0) continue;
      el.style.transition = 'none';
      el.style.transform = `translateY(${deltaY}px)`;
      requestAnimationFrame(() => { el.style.transition = 'transform 220ms ease'; el.style.transform = ''; });
    }
    prevRects.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.id).join(',')]);

  const handleDrop = (targetId: string) => {
    setDragOverId(null);
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    setDragId(null);
    captureRectsForFlip();
    queryClient.setQueryData(queryKey, (old: { data: OrderStatusDef[] } | undefined) => {
      if (!old) return old;
      const byId = new Map(old.data.map((i) => [i.id, i]));
      return { ...old, data: ids.map((id, i) => ({ ...byId.get(id)!, displayOrder: i })) };
    });
    reorderMutation.mutate(ids);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Order Statuses</CardTitle>
            <CardDescription>Drag to reorder the workflow sequence used by the Orders page stepper</CardDescription>
          </div>
          <Button size="sm" onClick={() => openDialog('new')}><Plus className="w-4 h-4 mr-2" />Add Status</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {query.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="w-4 h-4 animate-spin" />Loading...</div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              ref={(el) => { if (el) rowRefs.current.set(item.id, el); else rowRefs.current.delete(item.id); }}
              draggable
              onDragStart={() => setDragId(item.id)}
              onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== item.id) setDragOverId(item.id); }}
              onDragLeave={() => setDragOverId((id) => (id === item.id ? null : id))}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              onDrop={() => handleDrop(item.id)}
              className={`flex items-center justify-between gap-2 py-2 px-2 rounded-md border-t-2 transition-colors ${
                dragId === item.id ? 'opacity-40' : dragOverId === item.id ? 'border-t-primary' : 'border-t-transparent'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
                <Badge variant="outline" className={statusBadgeColor(item.displayOrder)}>{item.name}</Badge>
                {item.countsAsPending && <Badge variant="secondary" className="text-xs">Pending bucket</Badge>}
                {item.countsAsCompleted && <Badge variant="secondary" className="text-xs">Completed bucket</Badge>}
                {item.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openDialog(item)}><Edit className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={!!dialogItem} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialogItem === 'new' ? 'Add Order Status' : 'Edit Order Status'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="statusName">Name *</Label>
              <Input id="statusName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Preparing" required />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5"><Label>Counts as "pending" on the dashboard</Label></div>
              <Switch checked={countsAsPending} onCheckedChange={setCountsAsPending} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5"><Label>Counts as "completed" (revenue included)</Label></div>
              <Switch checked={countsAsCompleted} onCheckedChange={setCountsAsCompleted} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5"><Label>Default status for new orders</Label></div>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this status?</AlertDialogTitle>
            <AlertDialogDescription>Blocked if any existing order still uses it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// --- Payment status editor ---------------------------------------------------

function PaymentStatusEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogItem, setDialogItem] = useState<PaymentStatusDef | 'new' | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRects = useRef(new Map<string, DOMRect>());

  const queryKey = ['admin', 'payment-statuses'];
  const query = useQuery({ queryKey, queryFn: () => api.get<PaymentStatusDef[]>('/api/admin/payment-statuses') });
  const items = [...(query.data?.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { name, isDefault };
      return dialogItem && dialogItem !== 'new'
        ? api.put(`/api/admin/payment-statuses/${dialogItem.id}`, payload)
        : api.post('/api/admin/payment-statuses', payload);
    },
    onSuccess: () => { toast({ title: 'Success', description: 'Status saved.' }); invalidate(); closeDialog(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/payment-statuses/${id}`),
    onSuccess: () => { toast({ title: 'Success', description: 'Status removed.' }); invalidate(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    onSettled: () => setDeleteId(null),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => api.put('/api/admin/payment-statuses/reorder', { orderedIds }),
    onSuccess: invalidate,
    onError: (error: Error) => { toast({ title: 'Error', description: error.message, variant: 'destructive' }); invalidate(); },
  });

  const openDialog = (item: PaymentStatusDef | 'new') => {
    setDialogItem(item);
    if (item === 'new') { setName(''); setIsDefault(false); }
    else { setName(item.name); setIsDefault(item.isDefault); }
  };
  const closeDialog = () => setDialogItem(null);

  const captureRectsForFlip = () => {
    prevRects.current.clear();
    for (const [id, el] of rowRefs.current) prevRects.current.set(id, el.getBoundingClientRect());
  };
  useLayoutEffect(() => {
    if (prevRects.current.size === 0) return;
    for (const [id, el] of rowRefs.current) {
      const prev = prevRects.current.get(id);
      if (!prev) continue;
      const next = el.getBoundingClientRect();
      const deltaY = prev.top - next.top;
      if (deltaY === 0) continue;
      el.style.transition = 'none';
      el.style.transform = `translateY(${deltaY}px)`;
      requestAnimationFrame(() => { el.style.transition = 'transform 220ms ease'; el.style.transform = ''; });
    }
    prevRects.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.id).join(',')]);

  const handleDrop = (targetId: string) => {
    setDragOverId(null);
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    setDragId(null);
    captureRectsForFlip();
    queryClient.setQueryData(queryKey, (old: { data: PaymentStatusDef[] } | undefined) => {
      if (!old) return old;
      const byId = new Map(old.data.map((i) => [i.id, i]));
      return { ...old, data: ids.map((id, i) => ({ ...byId.get(id)!, displayOrder: i })) };
    });
    reorderMutation.mutate(ids);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Payment Statuses</CardTitle>
            <CardDescription>Drag to reorder the sequence used by the Orders page payment stepper</CardDescription>
          </div>
          <Button size="sm" onClick={() => openDialog('new')}><Plus className="w-4 h-4 mr-2" />Add Status</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {query.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="w-4 h-4 animate-spin" />Loading...</div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              ref={(el) => { if (el) rowRefs.current.set(item.id, el); else rowRefs.current.delete(item.id); }}
              draggable
              onDragStart={() => setDragId(item.id)}
              onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== item.id) setDragOverId(item.id); }}
              onDragLeave={() => setDragOverId((id) => (id === item.id ? null : id))}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              onDrop={() => handleDrop(item.id)}
              className={`flex items-center justify-between gap-2 py-2 px-2 rounded-md border-t-2 transition-colors ${
                dragId === item.id ? 'opacity-40' : dragOverId === item.id ? 'border-t-primary' : 'border-t-transparent'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
                <Badge variant="outline" className={paymentStatusBadgeColor(item.name, item.displayOrder)}>{item.name}</Badge>
                {item.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openDialog(item)}><Edit className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={!!dialogItem} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialogItem === 'new' ? 'Add Payment Status' : 'Edit Payment Status'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paymentStatusName">Name *</Label>
              <Input id="paymentStatusName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Paid" required />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5"><Label>Default status for new orders</Label></div>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this status?</AlertDialogTitle>
            <AlertDialogDescription>Blocked if any existing order still uses it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function Configurations() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Settings2 className="w-7 h-7" />Configurations</h1>
        <p className="text-muted-foreground">Manage the order and payment status workflows used across Orders and the POS app</p>
      </div>
      <OrderStatusEditor />
      <PaymentStatusEditor />
    </div>
  );
}
