import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, type DomainKind, type TenantDetail as Tenant, type TenantStaff } from '@/lib/api';
import { formatDate } from '@/lib/format';

function useTenantMutation<TVars>(id: string, fn: (vars: TVars) => Promise<Tenant>, successMessage: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (tenant) => {
      queryClient.setQueryData(['tenant', id], tenant);
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success(successMessage);
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

function InfoTab({ tenant }: { tenant: Tenant }) {
  const [form, setForm] = useState({
    name: tenant.name, addressLine1: tenant.addressLine1, city: tenant.city,
    postcode: tenant.postcode, phone: tenant.phone ?? '', email: tenant.email ?? '',
  });
  const save = useTenantMutation(tenant.restaurantId,
    () => api.put<Tenant>(`/api/platform/tenants/${tenant.restaurantId}`, {
      ...form, phone: form.phone || null, email: form.email || null,
    }), 'Saved');

  const field = (key: keyof typeof form, label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
    </div>
  );

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('name', 'Restaurant name')}
        {field('phone', 'Phone')}
        {field('addressLine1', 'Address line 1')}
        {field('city', 'Town / city')}
        {field('postcode', 'Postcode')}
        {field('email', 'Restaurant email')}
      </div>
      <p className="text-xs text-muted-foreground">
        Menu, opening hours, delivery zones and branding are managed by the restaurant in its own admin dashboard.
      </p>
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
        </Button>
      </div>
    </form>
  );
}

function DomainsTab({ tenant }: { tenant: Tenant }) {
  const id = tenant.restaurantId;
  const [host, setHost] = useState('');
  const [kind, setKind] = useState<DomainKind>('Storefront');
  const [isPrimary, setIsPrimary] = useState(true);

  const add = useTenantMutation(id,
    () => api.post<Tenant>(`/api/platform/tenants/${id}/domains`, { host, kind, isPrimary }), 'Domain added');
  const remove = useTenantMutation(id,
    (domainId: string) => api.delete<Tenant>(`/api/platform/tenants/${id}/domains/${domainId}`), 'Domain removed');

  useEffect(() => { if (add.isSuccess) setHost(''); }, [add.isSuccess]);

  return (
    <div className="space-y-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Host</TableHead>
            <TableHead>Serves</TableHead>
            <TableHead>Primary</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenant.domains.map((d) => (
            <TableRow key={d.id}>
              <TableCell>
                <a href={`https://${d.host}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                  {d.host}<ExternalLink className="h-3 w-3" />
                </a>
              </TableCell>
              <TableCell><Badge variant="outline">{d.kind}</Badge></TableCell>
              <TableCell>{d.isPrimary ? 'Yes' : ''}</TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" aria-label={`Remove ${d.host}`} disabled={remove.isPending}
                  onClick={() => { if (window.confirm(`Remove ${d.host}? It stops working immediately.`)) remove.mutate(d.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {tenant.domains.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No domains.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <form className="grid items-end gap-3 sm:grid-cols-[1fr_160px_auto_auto]"
        onSubmit={(e) => { e.preventDefault(); add.mutate(undefined); }}>
        <div className="space-y-1.5">
          <Label htmlFor="host">Add domain</Label>
          <Input id="host" placeholder="www.example.co.uk" value={host} onChange={(e) => setHost(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Serves</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as DomainKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Storefront">Storefront</SelectItem>
              <SelectItem value="Admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex h-10 items-center gap-2 text-sm">
          <Switch checked={isPrimary} onCheckedChange={setIsPrimary} /> Primary
        </label>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        A domain also needs a DNS A record pointing at the server and a site block in the Caddyfile
        before browsers can reach it.
      </p>
    </div>
  );
}

function StaffTab({ tenant }: { tenant: Tenant }) {
  const id = tenant.restaurantId;
  const [owner, setOwner] = useState({ fullName: '', email: '', password: '' });
  const [resetFor, setResetFor] = useState<TenantStaff | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const addOwner = useTenantMutation(id,
    () => api.post<Tenant>(`/api/platform/tenants/${id}/owners`, owner), 'Owner added');
  const reset = useMutation({
    mutationFn: () => api.post(`/api/platform/tenants/${id}/staff/${resetFor!.userId}/reset-password`, { password: newPassword }),
    onSuccess: () => { toast.success(`Password reset for ${resetFor!.email}`); setResetFor(null); setNewPassword(''); },
    onError: (err) => toast.error((err as Error).message),
  });

  useEffect(() => { if (addOwner.isSuccess) setOwner({ fullName: '', email: '', password: '' }); }, [addOwner.isSuccess]);

  return (
    <div className="space-y-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email (login)</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="w-40" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenant.staff.map((s) => (
            <TableRow key={s.userId}>
              <TableCell>{s.fullName}{!s.isActive && <Badge variant="secondary" className="ml-2">Inactive</Badge>}</TableCell>
              <TableCell>{s.email}</TableCell>
              <TableCell>{s.role}</TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => setResetFor(s)}>
                  <KeyRound className="mr-2 h-4 w-4" />Reset password
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <form className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
        onSubmit={(e) => { e.preventDefault(); addOwner.mutate(undefined); }}>
        <div className="space-y-1.5">
          <Label htmlFor="ownerName">Owner name</Label>
          <Input id="ownerName" value={owner.fullName} required onChange={(e) => setOwner((o) => ({ ...o, fullName: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ownerEmail">Email</Label>
          <Input id="ownerEmail" type="email" value={owner.email} required onChange={(e) => setOwner((o) => ({ ...o, email: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ownerPassword">Password</Label>
          <Input id="ownerPassword" type="password" value={owner.password} required onChange={(e) => setOwner((o) => ({ ...o, password: e.target.value }))} />
        </div>
        <Button type="submit" disabled={addOwner.isPending}>
          {addOwner.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add owner
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Other staff (managers, kitchen) are added by the owner from the restaurant's admin dashboard.
      </p>

      <Dialog open={resetFor !== null} onOpenChange={(open) => { if (!open) { setResetFor(null); setNewPassword(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Set a new admin password for {resetFor?.email}. Tell them the new password directly.</DialogDescription>
          </DialogHeader>
          <form id="reset-form" onSubmit={(e) => { e.preventDefault(); reset.mutate(); }} className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" type="password" value={newPassword} required onChange={(e) => setNewPassword(e.target.value)} />
          </form>
          <DialogFooter>
            <Button type="submit" form="reset-form" disabled={reset.isPending}>
              {reset.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusTab({ tenant }: { tenant: Tenant }) {
  const setStatus = useTenantMutation(tenant.restaurantId,
    (isActive: boolean) => api.put<Tenant>(`/api/platform/tenants/${tenant.restaurantId}/status`, { isActive }),
    'Status updated');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div>
          <p className="font-medium">{tenant.isActive ? 'Active' : 'Suspended'}</p>
          <p className="text-sm text-muted-foreground">
            A suspended restaurant's storefront and admin show "currently unavailable" and take no orders.
          </p>
        </div>
        <Switch checked={tenant.isActive} disabled={setStatus.isPending}
          onCheckedChange={(checked) => {
            if (checked || window.confirm(`Suspend ${tenant.name}? Its websites stop working immediately.`)) setStatus.mutate(checked);
          }} />
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Orders</dt><dd className="font-medium">{tenant.orderCount}</dd></div>
        <div><dt className="text-muted-foreground">Last order</dt><dd className="font-medium">{tenant.lastOrderAt ? formatDate(tenant.lastOrderAt) : '—'}</dd></div>
        <div><dt className="text-muted-foreground">Created</dt><dd className="font-medium">{formatDate(tenant.createdAt)}</dd></div>
      </dl>
    </div>
  );
}

export default function TenantDetail() {
  const { id = '' } = useParams();
  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => api.get<Tenant>(`/api/platform/tenants/${id}`),
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Restaurants</Link>
      </Button>
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {isLoading || !tenant ? (
        !error && <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {tenant.name}
              {tenant.isActive ? <Badge>Active</Badge> : <Badge variant="destructive">Suspended</Badge>}
            </CardTitle>
            <CardDescription>{tenant.slug} · {tenant.city}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="info">
              <TabsList className="mb-4 flex-wrap">
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="domains">Domains</TabsTrigger>
                <TabsTrigger value="staff">Owners</TabsTrigger>
                <TabsTrigger value="stripe">Payments</TabsTrigger>
                <TabsTrigger value="status">Status</TabsTrigger>
              </TabsList>
              <TabsContent value="info"><InfoTab key={tenant.restaurantId} tenant={tenant} /></TabsContent>
              <TabsContent value="domains"><DomainsTab tenant={tenant} /></TabsContent>
              <TabsContent value="staff"><StaffTab tenant={tenant} /></TabsContent>
              <TabsContent value="stripe">
                <p className="text-sm text-muted-foreground">
                  Per-restaurant Stripe keys arrive in the next phase. Until then every restaurant uses the platform's Stripe account.
                </p>
              </TabsContent>
              <TabsContent value="status"><StatusTab tenant={tenant} /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
