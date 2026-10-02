import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api, ApiError } from '@/lib/api';

type Role = 'Owner' | 'Manager' | 'Staff' | 'KitchenDisplay' | 'Waiter' | 'Cashier';

interface StaffMember {
  id: string;
  userId: string;
  fullName: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  hasPin: boolean;
}

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: 'Owner', label: 'Owner', hint: 'Everything, including other owners' },
  { value: 'Manager', label: 'Manager', hint: 'Admin panel and POS; approves discounts and voids' },
  { value: 'Staff', label: 'Staff', hint: 'Admin panel (orders, menu)' },
  { value: 'KitchenDisplay', label: 'Kitchen', hint: 'Marks items ready' },
  { value: 'Cashier', label: 'Cashier', hint: 'POS only: orders and payments' },
  { value: 'Waiter', label: 'Waiter', hint: 'POS only: takes orders on a tablet' },
];
const PIN_ONLY: Role[] = ['Waiter', 'Cashier'];
const roleLabel = (r: Role) => ROLES.find((x) => x.value === r)?.label ?? r;

const Staff = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ fullName: '', role: 'Waiter' as Role, email: '', password: '' });
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [edit, setEdit] = useState({ fullName: '', role: 'Waiter' as Role, isActive: true });
  const [pinFor, setPinFor] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState('');

  const staffQuery = useQuery({ queryKey: ['admin', 'staff'], queryFn: () => api.get<StaffMember[]>('/api/admin/staff'), retry: false });
  const staff = staffQuery.data?.data ?? [];
  const forbidden = staffQuery.error instanceof ApiError && staffQuery.error.statusCode === 403;

  const onError = (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] });

  const create = useMutation({
    mutationFn: () => api.post('/api/admin/staff', {
      fullName: form.fullName, role: form.role, email: form.email || null, password: form.password || null,
    }),
    onSuccess: () => {
      toast({ title: 'Staff member added', description: PIN_ONLY.includes(form.role) ? 'Now set their POS PIN.' : undefined });
      setAdding(false);
      setForm({ fullName: '', role: 'Waiter', email: '', password: '' });
      refresh();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: () => api.put(`/api/admin/staff/${editing!.id}`, edit),
    onSuccess: () => { toast({ title: 'Saved' }); setEditing(null); refresh(); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (s: StaffMember) => api.delete(`/api/admin/staff/${s.id}`),
    onSuccess: () => { toast({ title: 'Removed' }); refresh(); },
    onError,
  });
  const savePin = useMutation({
    mutationFn: () => api.post(`/api/admin/staff/${pinFor!.id}/pin`, { pin }),
    onSuccess: () => { toast({ title: 'PIN set', description: `${pinFor!.fullName} can now sign in at the POS.` }); setPinFor(null); setPin(''); refresh(); },
    onError,
  });

  const needsLogin = !PIN_ONLY.includes(form.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
          <p className="text-muted-foreground">Who can use the admin panel and the POS, and their POS PINs</p>
        </div>
        {!forbidden && <Button onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-2" />Add staff</Button>}
      </div>

      {forbidden ? (
        <Card className="max-w-xl"><CardContent className="p-6 text-sm text-muted-foreground">
          Only the owner or a manager can manage staff.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {staffQuery.isLoading ? (
              <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : staff.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
                <Users className="h-8 w-8" />No staff yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Sign-in</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>POS PIN</TableHead>
                    <TableHead className="w-48" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => (
                    <TableRow key={s.id} className={s.isActive ? '' : 'opacity-60'}>
                      <TableCell className="font-medium">
                        {s.fullName}{!s.isActive && <Badge variant="secondary" className="ml-2">Inactive</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.email ?? 'POS PIN only'}</TableCell>
                      <TableCell><Badge variant="outline">{roleLabel(s.role)}</Badge></TableCell>
                      <TableCell>{s.hasPin ? <Badge>Set</Badge> : <span className="text-sm text-muted-foreground">Not set</span>}</TableCell>
                      <TableCell className="space-x-1 whitespace-nowrap text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setPin(''); setPinFor(s); }}>
                          <KeyRound className="w-4 h-4 mr-1" />PIN
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Edit ${s.fullName}`}
                          onClick={() => { setEdit({ fullName: s.fullName, role: s.role, isActive: s.isActive }); setEditing(s); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Remove ${s.fullName}`} disabled={remove.isPending}
                          onClick={() => { if (window.confirm(`Remove ${s.fullName} from your staff? They lose admin and POS access.`)) remove.mutate(s); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff</DialogTitle>
            <DialogDescription>Waiters and cashiers only need a name and a POS PIN. Other roles sign in to this admin with email and password.</DialogDescription>
          </DialogHeader>
          <form id="add-staff" className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <div className="space-y-2">
              <Label htmlFor="staffName">Name</Label>
              <Input id="staffName" required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label} · <span className="text-muted-foreground">{r.hint}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staffEmail">Email {needsLogin ? '' : <span className="font-normal text-muted-foreground">(optional)</span>}</Label>
              <Input id="staffEmail" type="email" required={needsLogin} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            {(needsLogin || form.email) && (
              <div className="space-y-2">
                <Label htmlFor="staffPassword">Password</Label>
                <Input id="staffPassword" type="password" minLength={8} value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                <p className="text-xs text-muted-foreground">At least 8 characters. Leave empty if this email already signs in to another restaurant.</p>
              </div>
            )}
          </form>
          <DialogFooter>
            <Button type="submit" form="add-staff" disabled={create.isPending}>
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {editing?.fullName}</DialogTitle></DialogHeader>
          <form id="edit-staff" className="space-y-4" onSubmit={(e) => { e.preventDefault(); update.mutate(); }}>
            <div className="space-y-2">
              <Label htmlFor="editName">Name</Label>
              <Input id="editName" required value={edit.fullName} onChange={(e) => setEdit((x) => ({ ...x, fullName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={edit.role} onValueChange={(v) => setEdit((x) => ({ ...x, role: v as Role }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="flex items-center justify-between text-sm">
              Active
              <Switch checked={edit.isActive} onCheckedChange={(v) => setEdit((x) => ({ ...x, isActive: v }))} />
            </label>
          </form>
          <DialogFooter>
            <Button type="submit" form="edit-staff" disabled={update.isPending}>
              {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pinFor !== null} onOpenChange={(open) => { if (!open) setPinFor(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>POS PIN for {pinFor?.fullName}</DialogTitle>
            <DialogDescription>4 to 6 digits. Each person's PIN must be different, as the PIN alone signs them in at the till.</DialogDescription>
          </DialogHeader>
          <form id="pin-form" onSubmit={(e) => { e.preventDefault(); savePin.mutate(); }}>
            <Input autoFocus inputMode="numeric" pattern="\d{4,6}" maxLength={6} required value={pin}
              aria-label="PIN" className="text-center text-2xl tracking-[0.5em]"
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          </form>
          <DialogFooter>
            <Button type="submit" form="pin-form" disabled={savePin.isPending || pin.length < 4}>
              {savePin.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Staff;
