import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, KeyRound, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import PaymentsTab from '@/pages/PaymentsTab';
import { FeaturesPanel, SubscriptionPanel } from '@/pages/TenantPlatformTabs';
import { PageHeader, Stat } from '@/components/Page';

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
  const [editFor, setEditFor] = useState<TenantStaff | null>(null);
  const [edit, setEdit] = useState({ email: '', fullName: '' });
  const update = useTenantMutation(id,
    () => api.put<Tenant>(`/api/platform/tenants/${id}/staff/${editFor!.userId}`, edit), 'Login details updated');
  useEffect(() => { if (update.isSuccess) setEditFor(null); }, [update.isSuccess]);

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
              <TableCell className="space-x-2 whitespace-nowrap text-right">
                <Button variant="outline" size="sm" onClick={() => { update.reset(); setEdit({ email: s.email, fullName: s.fullName }); setEditFor(s); }}>
                  <Pencil className="mr-2 h-4 w-4" />Edit
                </Button>
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

      <Dialog open={editFor !== null} onOpenChange={(open) => { if (!open) setEditFor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit login</DialogTitle>
            <DialogDescription>
              The email is what they sign in to the admin with. Their password doesn't change.
            </DialogDescription>
          </DialogHeader>
          <form id="edit-form" onSubmit={(e) => { e.preventDefault(); update.mutate(undefined); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="editEmail">Email (login)</Label>
              <Input id="editEmail" type="email" value={edit.email} required onChange={(e) => setEdit((x) => ({ ...x, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editName">Name</Label>
              <Input id="editName" value={edit.fullName} required onChange={(e) => setEdit((x) => ({ ...x, fullName: e.target.value }))} />
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="edit-form" disabled={update.isPending}>
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function ResetStatusesCard({ tenant }: { tenant: Tenant }) {
  const reset = useMutation({
    mutationFn: () => api.post<{ ordersRemapped: number; paymentsRemapped: number; removedOrderStatuses: string[]; removedPaymentStatuses: string[] }>(
      `/api/platform/tenants/${tenant.restaurantId}/statuses/reset-to-standard`),
    onSuccess: (r) => {
      const removed = [...r.removedOrderStatuses, ...r.removedPaymentStatuses];
      toast.success(`Standard statuses restored for ${tenant.name}`, {
        description: `${r.ordersRemapped + r.paymentsRemapped} order(s) moved to a standard status${removed.length ? `; removed: ${removed.join(', ')}` : ''}.`,
      });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="flex items-center justify-between gap-4 surface p-5">
      <div>
        <p className="font-medium">Order &amp; payment statuses</p>
        <p className="text-sm text-muted-foreground">
          Restore the standard lists every restaurant starts with (Pending, Confirmed, Preparing, Ready, Out for delivery, Completed,
          Cancelled; and Pending, Paid, Refunded…). Orders on a custom status move to the nearest standard one, and the custom
          statuses are removed. Order history is kept.
        </p>
      </div>
      <Button variant="outline" disabled={reset.isPending} className="shrink-0"
        onClick={() => {
          if (window.confirm(`Reset ${tenant.name} to the standard order and payment statuses? Custom statuses will be removed.`)) reset.mutate();
        }}>
        {reset.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Reset to standard
      </Button>
    </div>
  );
}

function StatusTab({ tenant }: { tenant: Tenant }) {
  const setStatus = useTenantMutation(tenant.restaurantId,
    (isActive: boolean) => api.put<Tenant>(`/api/platform/tenants/${tenant.restaurantId}/status`, { isActive }),
    'Status updated');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-lg bg-secondary/50 p-4">
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


function FeaturesTab({ tenant }: { tenant: Tenant }) {
  return (
    <div className="space-y-8">
      <FeaturesPanel tenant={tenant} />
      <section>
        <h3 className="eyebrow mb-2 px-1">Maintenance</h3>
        <ResetStatusesCard tenant={tenant} />
      </section>
    </div>
  );
}

export default function TenantDetail() {
  const { id = '' } = useParams();
  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => api.get<Tenant>(`/api/platform/tenants/${id}`),
  });

  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (isLoading || !tenant) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const storefront = tenant.domains.find((d) => d.kind === 'Storefront' && d.isPrimary) ?? tenant.domains.find((d) => d.kind === 'Storefront');
  const admin = tenant.domains.find((d) => d.kind === 'Admin' && d.isPrimary) ?? tenant.domains.find((d) => d.kind === 'Admin');

  return (
    <div>
      <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />Restaurants
      </Link>

      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{tenant.name}
          {tenant.isActive ? <Badge variant="success">Live</Badge> : <Badge variant="destructive">Suspended</Badge>}</span>}
        description={`${tenant.addressLine1}, ${tenant.city} ${tenant.postcode}`}
        actions={<>
          {storefront && <Button variant="outline" size="sm" asChild>
            <a href={`https://${storefront.host}`} target="_blank" rel="noreferrer">Storefront<ExternalLink /></a></Button>}
          {admin && <Button variant="outline" size="sm" asChild>
            <a href={`https://${admin.host}`} target="_blank" rel="noreferrer">Admin<ExternalLink /></a></Button>}
        </>}
      />

      <section className="surface mb-8 grid grid-cols-2 sm:grid-cols-4 sm:divide-x" aria-label="Summary">
        <Stat label="Orders" value={tenant.orderCount.toLocaleString('en-GB')} />
        <Stat label="Last order" value={tenant.lastOrderAt ? formatDate(tenant.lastOrderAt) : '—'} className="[&>div:nth-child(2)]:text-base" />
        <Stat label="POS apps" value={tenant.features.posEnabled ? 'On' : 'Off'} />
        <Stat label="On the platform since" value={formatDate(tenant.createdAt).split(',')[0]} className="[&>div:nth-child(2)]:text-base" />
      </section>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Details</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="staff">Owners</TabsTrigger>
          <TabsTrigger value="stripe">Payments</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>
        <TabsContent value="info"><div className="surface p-5"><InfoTab key={tenant.restaurantId} tenant={tenant} /></div></TabsContent>
        <TabsContent value="domains"><div className="surface p-5"><DomainsTab tenant={tenant} /></div></TabsContent>
        <TabsContent value="staff"><div className="surface p-5"><StaffTab tenant={tenant} /></div></TabsContent>
        <TabsContent value="stripe"><div className="surface p-5"><PaymentsTab restaurantId={tenant.restaurantId} /></div></TabsContent>
        <TabsContent value="features"><FeaturesTab tenant={tenant} /></TabsContent>
        <TabsContent value="subscription"><SubscriptionPanel tenant={tenant} /></TabsContent>
        <TabsContent value="status"><div className="surface p-5"><StatusTab tenant={tenant} /></div></TabsContent>
      </Tabs>
    </div>
  );
}
