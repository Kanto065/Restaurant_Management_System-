import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, Ticket } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';

interface Voucher {
  id: string;
  code: string;
  discountType: 'Percentage' | 'FixedAmount';
  discountValue: number;
  minimumOrderAmount: number;
  validFrom: string | null;
  validTo: string | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  isActive: boolean;
}

type FormState = {
  code: string; discountType: 'Percentage' | 'FixedAmount'; discountValue: string;
  minimumOrderAmount: string; maxRedemptions: string; isActive: boolean;
};

const emptyForm: FormState = { code: '', discountType: 'Percentage', discountValue: '10', minimumOrderAmount: '0', maxRedemptions: '', isActive: true };

const Vouchers = () => {
  const { toast } = useToast();
  const currency = useCurrency();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const vouchersQuery = useQuery({
    queryKey: ['admin', 'vouchers'],
    queryFn: () => api.get<Voucher[]>('/api/admin/vouchers'),
  });
  const vouchers = vouchersQuery.data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'vouchers'] });

  const toPayload = (f: FormState) => ({
    code: f.code.toUpperCase(),
    discountType: f.discountType,
    discountValue: parseFloat(f.discountValue) || 0,
    minimumOrderAmount: parseFloat(f.minimumOrderAmount) || 0,
    validFrom: null,
    validTo: null,
    maxRedemptions: f.maxRedemptions ? parseInt(f.maxRedemptions, 10) : null,
    isActive: f.isActive,
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toPayload>) => api.post('/api/admin/vouchers', payload),
    onSuccess: () => { toast({ title: 'Success', description: 'Voucher created.' }); invalidate(); resetForm(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReturnType<typeof toPayload> }) => api.put(`/api/admin/vouchers/${id}`, payload),
    onSuccess: () => { toast({ title: 'Success', description: 'Voucher updated.' }); invalidate(); resetForm(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/vouchers/${id}`),
    onSuccess: () => { toast({ title: 'Success', description: 'Voucher deleted.' }); invalidate(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    onSettled: () => setDeleteId(null),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) {
      toast({ title: 'Validation Error', description: 'Voucher code is required.', variant: 'destructive' });
      return;
    }
    const payload = toPayload(form);
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (v: Voucher) => {
    setEditing(v);
    setForm({
      code: v.code, discountType: v.discountType, discountValue: v.discountValue.toString(),
      minimumOrderAmount: v.minimumOrderAmount.toString(), maxRedemptions: v.maxRedemptions?.toString() ?? '', isActive: v.isActive,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => { setForm(emptyForm); setEditing(null); setIsDialogOpen(false); };
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (vouchersQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading vouchers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vouchers</h1>
          <p className="text-muted-foreground">Discount codes customers can redeem at checkout</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsDialogOpen(true) : resetForm())}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Voucher
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Voucher' : 'Add Voucher'}</DialogTitle>
              <DialogDescription>Codes are case-insensitive and always stored uppercase.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input id="code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. WELCOME10" required disabled={isSubmitting} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discountType">Discount Type</Label>
                  <Select value={form.discountType} onValueChange={(v) => setForm((f) => ({ ...f, discountType: v as FormState['discountType'] }))} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Percentage">Percentage (%)</SelectItem>
                      <SelectItem value="FixedAmount">Fixed Amount ({currency})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountValue">Discount Value</Label>
                  <Input id="discountValue" type="number" step="0.01" min="0" value={form.discountValue} onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))} disabled={isSubmitting} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minimumOrderAmount">Minimum Order ({currency})</Label>
                  <Input id="minimumOrderAmount" type="number" step="0.01" min="0" value={form.minimumOrderAmount} onChange={(e) => setForm((f) => ({ ...f, minimumOrderAmount: e.target.value }))} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxRedemptions">Max Redemptions</Label>
                  <Input id="maxRedemptions" type="number" min="0" placeholder="Unlimited" value={form.maxRedemptions} onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))} disabled={isSubmitting} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive">Active</Label>
                  <p className="text-xs text-muted-foreground">Inactive vouchers can't be redeemed</p>
                </div>
                <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} disabled={isSubmitting} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : editing ? 'Update Voucher' : 'Create Voucher'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Vouchers ({vouchers.length})</CardTitle>
          <CardDescription>Redemption count updates automatically as customers use each code</CardDescription>
        </CardHeader>
        <CardContent>
          {vouchers.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No vouchers yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {vouchers.map((v) => (
                <div key={v.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{v.code}</span>
                      <Badge variant="outline">
                        {v.discountType === 'Percentage' ? `${v.discountValue}% off` : `${currency}${v.discountValue.toFixed(2)} off`}
                      </Badge>
                      {!v.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Min order {currency}{v.minimumOrderAmount.toFixed(2)} · Used {v.timesRedeemed}{v.maxRedemptions ? ` / ${v.maxRedemptions}` : ''} times
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(v)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(v.id)}><Trash2 className="w-4 h-4" /></Button>
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
            <AlertDialogDescription>This will permanently delete the voucher.</AlertDialogDescription>
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

export default Vouchers;
