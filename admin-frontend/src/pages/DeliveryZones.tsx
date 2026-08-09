import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, Truck } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';

interface DeliveryZone {
  id: string;
  name: string;
  maxMileage: number;
  deliveryFee: number;
  minimumOrderAmount: number;
  isActive: boolean;
}

type FormState = { name: string; maxMileage: string; deliveryFee: string; minimumOrderAmount: string; isActive: boolean };
const emptyForm: FormState = { name: '', maxMileage: '', deliveryFee: '', minimumOrderAmount: '10', isActive: true };

const DeliveryZones = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const zonesQuery = useQuery({
    queryKey: ['admin', 'delivery-zones'],
    queryFn: () => api.get<DeliveryZone[]>('/api/admin/delivery-zones'),
  });
  const zones = [...(zonesQuery.data?.data ?? [])].sort((a, b) => a.maxMileage - b.maxMileage);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'delivery-zones'] });

  const toPayload = (f: FormState) => ({
    name: f.name,
    maxMileage: parseFloat(f.maxMileage) || 0,
    deliveryFee: parseFloat(f.deliveryFee) || 0,
    minimumOrderAmount: parseFloat(f.minimumOrderAmount) || 0,
    isActive: f.isActive,
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toPayload>) => api.post('/api/admin/delivery-zones', payload),
    onSuccess: () => { toast({ title: 'Success', description: 'Delivery zone created.' }); invalidate(); resetForm(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReturnType<typeof toPayload> }) => api.put(`/api/admin/delivery-zones/${id}`, payload),
    onSuccess: () => { toast({ title: 'Success', description: 'Delivery zone updated.' }); invalidate(); resetForm(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/delivery-zones/${id}`),
    onSuccess: () => { toast({ title: 'Success', description: 'Delivery zone deleted.' }); invalidate(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    onSettled: () => setDeleteId(null),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.maxMileage) {
      toast({ title: 'Validation Error', description: 'Name and max mileage are required.', variant: 'destructive' });
      return;
    }
    const payload = toPayload(form);
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (z: DeliveryZone) => {
    setEditing(z);
    setForm({ name: z.name, maxMileage: z.maxMileage.toString(), deliveryFee: z.deliveryFee.toString(), minimumOrderAmount: z.minimumOrderAmount.toString(), isActive: z.isActive });
    setIsDialogOpen(true);
  };

  const resetForm = () => { setForm(emptyForm); setEditing(null); setIsDialogOpen(false); };
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (zonesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading delivery zones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Delivery Zones</h1>
          <p className="text-muted-foreground">
            Mileage-tiered delivery pricing — shown on your storefront's Contact Us page and used to price delivery orders
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsDialogOpen(true) : resetForm())}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Zone
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Delivery Zone' : 'Add Delivery Zone'}</DialogTitle>
              <DialogDescription>e.g. "Up to 2 miles" — zones are shown to customers ordered by mileage</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Zone Name *</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Up to 2 miles" required disabled={isSubmitting} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxMileage">Max Mileage *</Label>
                  <Input id="maxMileage" type="number" step="0.1" min="0" value={form.maxMileage} onChange={(e) => setForm((f) => ({ ...f, maxMileage: e.target.value }))} required disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryFee">Delivery Fee (£)</Label>
                  <Input id="deliveryFee" type="number" step="0.01" min="0" value={form.deliveryFee} onChange={(e) => setForm((f) => ({ ...f, deliveryFee: e.target.value }))} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minimumOrderAmount">Min Order (£)</Label>
                  <Input id="minimumOrderAmount" type="number" step="0.01" min="0" value={form.minimumOrderAmount} onChange={(e) => setForm((f) => ({ ...f, minimumOrderAmount: e.target.value }))} disabled={isSubmitting} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Active</Label>
                <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} disabled={isSubmitting} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : editing ? 'Update Zone' : 'Create Zone'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Zones ({zones.length})</CardTitle>
          <CardDescription>Ordered by mileage, matching how they're shown to customers</CardDescription>
        </CardHeader>
        <CardContent>
          {zones.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No delivery zones yet — the Contact Us page's delivery table stays hidden until you add one.</p>
              <Button onClick={() => setIsDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Zone</Button>
            </div>
          ) : (
            <div className="divide-y">
              {zones.map((z) => (
                <div key={z.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{z.name} {!z.isActive && <span className="text-xs text-muted-foreground">(inactive)</span>}</p>
                    <p className="text-xs text-muted-foreground">
                      Up to {z.maxMileage} miles · £{z.deliveryFee.toFixed(2)} delivery · £{z.minimumOrderAmount.toFixed(2)} min order
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(z)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(z.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the delivery zone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DeliveryZones;
