import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, GripVertical, Loader2, Clock, ListOrdered, CreditCard } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { ORDER_TIMES_KEY, useOrderTimes, type OrderTimes } from '@/hooks/useOrderTimes';
import DeliverySettingsCard from '@/components/delivery/DeliverySettingsCard';

interface StatusDef {
  id: string;
  name: string;
  displayOrder: number;
  isDefault: boolean;
  countsAsPending?: boolean;
  countsAsCompleted?: boolean;
}

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

// --- Layout -------------------------------------------------------------------

/** A settings section: icon, title, one-line explanation, optional action, then content. */
function Panel({ icon, title, description, action, children, className = '' }: {
  icon: ReactNode; title: string; description: ReactNode; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-xl border bg-card p-4 sm:p-5 ${className}`}>
      <header className="flex items-start gap-3 mb-4">
        <span className="grid place-items-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-tight">{title}</h2>
          <p className="text-sm text-muted-foreground text-pretty">{description}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

// --- Order times ----------------------------------------------------------------

/** Default minutes each new order is given (shown to the customer and on the Orders list). */
function OrderTimesPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const current = useOrderTimes();
  const [form, setForm] = useState<OrderTimes>({ deliveryMinutes: 60, collectionMinutes: 20, dineInMinutes: 20 });
  useEffect(() => { if (current) setForm(current); }, [current]);
  const dirty = !!current && JSON.stringify(form) !== JSON.stringify(current);

  const save = useMutation({
    mutationFn: () => api.put<OrderTimes>('/api/admin/restaurant/order-times', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDER_TIMES_KEY });
      toast({ title: 'Saved', description: 'New orders will use these times.' });
    },
    onError: (error: Error) => toast({ variant: 'destructive', title: "Couldn't save", description: error.message }),
  });

  const fields: { key: keyof OrderTimes; label: string }[] = [
    { key: 'deliveryMinutes', label: 'Delivery' },
    { key: 'collectionMinutes', label: 'Collection' },
    { key: 'dineInMinutes', label: 'Dine-in' },
  ];

  return (
    <Panel icon={<Clock className="w-4 h-4" />} title="Order times"
      description="Every new order starts with this estimate. Customers see it; you can still change any order.">
      {!current ? (
        <div className="grid grid-cols-3 gap-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid grid-cols-3 gap-3">
            {fields.map((field) => (
              <div key={field.key} className="space-y-1.5 min-w-0">
                <Label htmlFor={field.key} className="text-xs text-muted-foreground font-medium">{field.label}</Label>
                <div className="relative">
                  <Input id={field.key} type="number" min={1} max={600} required value={form[field.key]} className="pr-11 tabular-nums"
                    onChange={(e) => setForm((f) => ({ ...f, [field.key]: parseInt(e.target.value || '0', 10) }))} />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">min</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Delivery counts until it arrives; the others until ready.</p>
            <Button type="submit" size="sm" disabled={!dirty || save.isPending} className="shrink-0 active:scale-[0.98] transition-transform">
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}

// --- Status workflows (order + payment share one editor) ---------------------------

interface StatusFlag { key: 'countsAsPending' | 'countsAsCompleted' | 'isDefault'; label: string; tag: string }

function StatusWorkflowPanel({ icon, title, description, endpoint, queryKey, flags, badgeClass, noun }: {
  icon: ReactNode; title: string; description: string; endpoint: string; queryKey: string[];
  flags: StatusFlag[]; badgeClass: (s: StatusDef) => string; noun: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogItem, setDialogItem] = useState<StatusDef | 'new' | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [flagValues, setFlagValues] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const prevRects = useRef(new Map<string, DOMRect>());

  const query = useQuery({ queryKey, queryFn: () => api.get<StatusDef[]>(endpoint) });
  const items = [...(query.data?.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { name, ...Object.fromEntries(flags.map((f) => [f.key, !!flagValues[f.key]])) };
      return dialogItem && dialogItem !== 'new' ? api.put(`${endpoint}/${dialogItem.id}`, payload) : api.post(endpoint, payload);
    },
    onSuccess: () => { toast({ title: 'Status saved' }); invalidate(); setDialogItem(null); },
    onError: (error: Error) => toast({ title: "Couldn't save", description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${endpoint}/${id}`),
    onSuccess: () => { toast({ title: 'Status removed' }); invalidate(); },
    onError: (error: Error) => toast({ title: "Couldn't remove it", description: error.message, variant: 'destructive' }),
    onSettled: () => setDeleteId(null),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => api.put(`${endpoint}/reorder`, { orderedIds }),
    onSuccess: invalidate,
    onError: (error: Error) => { toast({ title: "Couldn't reorder", description: error.message, variant: 'destructive' }); invalidate(); },
  });

  const openDialog = (item: StatusDef | 'new') => {
    setDialogItem(item);
    setName(item === 'new' ? '' : item.name);
    setFlagValues(Object.fromEntries(flags.map((f) => [f.key, item === 'new' ? false : !!item[f.key]])));
  };

  // FLIP: rows glide to their new place after a drop instead of jumping.
  useLayoutEffect(() => {
    if (prevRects.current.size === 0) return;
    for (const [id, el] of rowRefs.current) {
      const prev = prevRects.current.get(id);
      if (!prev) continue;
      const deltaY = prev.top - el.getBoundingClientRect().top;
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
    prevRects.current.clear();
    for (const [id, el] of rowRefs.current) prevRects.current.set(id, el.getBoundingClientRect());
    queryClient.setQueryData(queryKey, (old: { data: StatusDef[] } | undefined) => {
      if (!old) return old;
      const byId = new Map(old.data.map((i) => [i.id, i]));
      return { ...old, data: ids.map((id, i) => ({ ...byId.get(id)!, displayOrder: i })) };
    });
    reorderMutation.mutate(ids);
  };

  return (
    <Panel icon={icon} title={title} description={description}
      action={
        <Button size="sm" variant="ghost" className="shrink-0 -mr-2 active:scale-[0.98] transition-transform" onClick={() => openDialog('new')}>
          <Plus className="w-4 h-4 mr-1" />Add
        </Button>
      }>
      {query.isLoading ? (
        <div className="space-y-1.5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3">No statuses yet - add the first step of your workflow.</p>
      ) : (
        <ol className="space-y-0.5">
          {items.map((item, index) => (
            <li
              key={item.id}
              ref={(el) => { if (el) rowRefs.current.set(item.id, el); else rowRefs.current.delete(item.id); }}
              draggable
              onDragStart={() => setDragId(item.id)}
              onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== item.id) setDragOverId(item.id); }}
              onDragLeave={() => setDragOverId((id) => (id === item.id ? null : id))}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              onDrop={() => handleDrop(item.id)}
              className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60 focus-within:bg-muted/60 ${
                dragId === item.id ? 'opacity-40' : dragOverId === item.id ? 'ring-1 ring-primary/60' : ''
              }`}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab shrink-0 transition-colors" />
              <span className="w-5 text-right text-xs tabular-nums text-muted-foreground shrink-0">{index + 1}</span>
              <Badge variant="outline" className={`${badgeClass(item)} font-medium`}>{item.name}</Badge>
              <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
                {flags.filter((f) => item[f.key]).map((f) => f.tag).join(' · ')}
              </span>
              <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${item.name}`} onClick={() => openDialog(item)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" aria-label={`Delete ${item.name}`} onClick={() => setDeleteId(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Dialog open={!!dialogItem} onOpenChange={(open) => !open && setDialogItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{dialogItem === 'new' ? `Add ${noun}` : `Edit ${noun}`}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${noun}-name`}>Name</Label>
              <Input id={`${noun}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Preparing" required autoFocus />
            </div>
            <div className="rounded-lg border divide-y">
              {flags.map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm cursor-pointer">
                  {f.label}
                  <Switch checked={!!flagValues[f.key]} onCheckedChange={(v) => setFlagValues((prev) => ({ ...prev, [f.key]: v }))} />
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogItem(null)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending || !name.trim()}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this status?</AlertDialogTitle>
            <AlertDialogDescription>This is blocked if any existing order still uses it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}

// --- Page ----------------------------------------------------------------------

export default function Configurations() {
  return (
    <div className="space-y-5 max-w-6xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configurations</h1>
        <p className="text-sm text-muted-foreground">Order times, delivery outside your zones, and the order and payment steps used by Orders and the POS.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <OrderTimesPanel />
        <DeliverySettingsCard />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <StatusWorkflowPanel
          icon={<ListOrdered className="w-4 h-4" />}
          title="Order steps"
          description="Drag to reorder. This is the order the Orders page and POS move through."
          endpoint="/api/admin/order-statuses"
          queryKey={['admin', 'order-statuses']}
          noun="order status"
          badgeClass={(s) => statusBadgeColor(s.displayOrder)}
          flags={[
            { key: 'isDefault', label: 'Default status for new orders', tag: 'Default' },
            { key: 'countsAsPending', label: 'Counts as "pending" on the dashboard', tag: 'Pending' },
            { key: 'countsAsCompleted', label: 'Counts as "completed" (revenue included)', tag: 'Completed' },
          ]}
        />
        <StatusWorkflowPanel
          icon={<CreditCard className="w-4 h-4" />}
          title="Payment steps"
          description="Drag to reorder the payment steps shown on each order."
          endpoint="/api/admin/payment-statuses"
          queryKey={['admin', 'payment-statuses']}
          noun="payment status"
          badgeClass={(s) => paymentStatusBadgeColor(s.name, s.displayOrder)}
          flags={[{ key: 'isDefault', label: 'Default status for new orders', tag: 'Default' }]}
        />
      </div>
    </div>
  );
}
