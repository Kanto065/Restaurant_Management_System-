import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarClock, Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, SettingRow } from '@/components/Page';
import { api, type FeatureMap, type Plan, type Subscription, type SubscriptionStatus, type TenantDetail } from '@/lib/api';
import { formatDay, formatMoney } from '@/lib/format';
import { FEATURES } from '@/lib/features';


export function FeaturesPanel({ tenant }: { tenant: TenantDetail }) {
  const id = tenant.restaurantId;
  const queryClient = useQueryClient();
  const { data: map, isLoading } = useQuery({
    queryKey: ['feature-map', id],
    queryFn: () => api.get<FeatureMap>(`/api/platform/tenants/${id}/feature-map`),
  });
  const set = useMutation({
    mutationFn: (change: FeatureMap) => api.put<FeatureMap>(`/api/platform/tenants/${id}/feature-map`, change),
    onSuccess: (next, change) => {
      queryClient.setQueryData(['feature-map', id], next);
      if ('pos' in change) queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      const [key, on] = Object.entries(change)[0];
      toast.success(`${FEATURES.find((f) => f.key === key)?.title ?? key} ${on ? 'on' : 'off'}`);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  if (isLoading || !map) return <Skeleton className="h-80 w-full rounded-xl" />;

  const known = new Set(FEATURES.map((f) => f.key));
  const rows = [...FEATURES, ...Object.keys(map).filter((k) => !known.has(k))
    .map((key) => ({ key, title: key, description: '', group: 'POS' as const }))];
  const posOn = map.pos;

  return (
    <div className="space-y-6">
      {(['POS', 'Online'] as const).map((group) => (
        <section key={group}>
          <h3 className="eyebrow mb-2 px-1">{group === 'POS' ? 'Point of sale' : 'Online'}</h3>
          <div className="surface divide-y">
            {rows.filter((r) => r.group === group).map((f) => {
              const locked = f.key === 'online.ordering' || (f.key !== 'pos' && f.key.startsWith('pos.') && !posOn);
              return (
                <SettingRow key={f.key} title={<span className="flex items-center gap-2">{f.title}
                  {f.key === 'pos' && <Badge variant="outline" className="font-mono text-[10px]">pos</Badge>}</span>}
                  description={f.description}>
                  <Switch
                    checked={!!map[f.key]}
                    disabled={locked || set.isPending}
                    aria-label={f.title}
                    onCheckedChange={(on) => {
                      if (f.key === 'pos' && !on && !window.confirm(`Turn off the POS apps for ${tenant.name}? Every paired device stops working immediately.`)) return;
                      set.mutate({ [f.key]: on });
                    }}
                  />
                </SettingRow>
              );
            })}
          </div>
        </section>
      ))}
      <p className="px-1 text-xs text-muted-foreground">
        A switch here overrides the restaurant’s plan. Features the plan includes are on unless switched off here.
      </p>
    </div>
  );
}

const STATUSES: SubscriptionStatus[] = ['Trialing', 'Active', 'PastDue', 'Canceled', 'Expired'];
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const fromDateInput = (value: string) => (value ? `${value}T23:59:59Z` : null);

function addMonth(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function SubscriptionPanel({ tenant }: { tenant: TenantDetail }) {
  const orgId = tenant.organizationId;
  const queryClient = useQueryClient();
  const key = ['subscription', orgId];
  const { data: sub, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get<Subscription | null>(`/api/platform/organizations/${orgId}/subscription`),
  });
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: () => api.get<Plan[]>('/api/platform/plans') });

  const [form, setForm] = useState({ planId: '', status: 'Active' as SubscriptionStatus, currentPeriodEnd: '', trialEndsAt: '', graceDays: 7 });
  useEffect(() => {
    if (sub) setForm({ planId: sub.planId, status: sub.status, currentPeriodEnd: toDateInput(sub.currentPeriodEnd),
      trialEndsAt: toDateInput(sub.trialEndsAt), graceDays: sub.graceDays });
  }, [sub]);

  const [payment, setPayment] = useState({ amount: '', periodTo: '', method: 'Bank transfer', note: '' });
  useEffect(() => {
    const plan = plans?.find((p) => p.id === sub?.planId);
    setPayment((p) => ({ ...p, periodTo: addMonth(sub?.currentPeriodEnd ?? null), amount: plan ? String(plan.priceMonthly) : p.amount }));
  }, [sub, plans]);

  const onSaved = (next: Subscription | null) => {
    queryClient.setQueryData(key, next);
    queryClient.invalidateQueries({ queryKey: ['feature-map', tenant.restaurantId] });
  };
  const save = useMutation({
    mutationFn: () => api.put<Subscription>(`/api/platform/organizations/${orgId}/subscription`, {
      ...form, currentPeriodEnd: fromDateInput(form.currentPeriodEnd), trialEndsAt: fromDateInput(form.trialEndsAt),
    }),
    onSuccess: (next) => { onSaved(next); toast.success('Subscription saved'); },
    onError: (err) => toast.error((err as Error).message),
  });
  const record = useMutation({
    mutationFn: () => api.post<Subscription>(`/api/platform/organizations/${orgId}/subscription/payments`, {
      amount: Number(payment.amount), periodTo: fromDateInput(payment.periodTo), method: payment.method || null, note: payment.note || null,
    }),
    onSuccess: (next) => { onSaved(next); setPayment((p) => ({ ...p, note: '' })); toast.success('Payment recorded, period extended'); },
    onError: (err) => toast.error((err as Error).message),
  });

  if (isLoading) return <Skeleton className="h-80 w-full rounded-xl" />;

  if (!plans?.length) {
    return (
      <div className="surface">
        <EmptyState icon={<CalendarClock className="h-5 w-5" />} title="No plans yet"
          action={<Button asChild variant="outline"><Link to="/plans">Create a plan</Link></Button>}>
          Create a plan first, then put {tenant.name} on it.
        </EmptyState>
      </div>
    );
  }

  const accessTone = sub?.access === 'Active' ? 'success' : sub?.access === 'Grace' ? 'accent' : 'destructive';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h3 className="font-medium">Plan and period</h3>
              <p className="text-sm text-muted-foreground">
                {sub ? 'Expiry only affects the POS: web ordering and the admin keep working.'
                  : `No subscription: ${tenant.name} is treated as active with no limits.`}
              </p>
            </div>
            {sub && <Badge variant={accessTone}>POS licence: {sub.access === 'Grace' ? 'in grace period' : sub.access.toLowerCase()}</Badge>}
          </div>
          <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={form.planId} onValueChange={(v) => setForm((f) => ({ ...f, planId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {formatMoney(p.priceMonthly)}/mo</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as SubscriptionStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s === 'PastDue' ? 'Past due' : s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="periodEnd">Paid until</Label>
              <Input id="periodEnd" type="date" value={form.currentPeriodEnd}
                onChange={(e) => setForm((f) => ({ ...f, currentPeriodEnd: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grace">Grace days</Label>
              <Input id="grace" type="number" min={0} max={365} value={form.graceDays} className="num"
                onChange={(e) => setForm((f) => ({ ...f, graceDays: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trial">Trial ends <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="trial" type="date" value={form.trialEndsAt}
                onChange={(e) => setForm((f) => ({ ...f, trialEndsAt: e.target.value }))} />
            </div>
            <div className="flex items-end justify-end">
              <Button type="submit" disabled={save.isPending || !form.planId}>
                {save.isPending && <Loader2 className="animate-spin" />}{sub ? 'Save' : 'Start subscription'}
              </Button>
            </div>
          </form>
        </section>

        <section className="surface">
          <h3 className="border-b px-5 py-4 font-medium">Payment history</h3>
          {sub?.payments.length ? (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-5 py-2 font-medium">Paid</th><th className="px-3 py-2 font-medium">Covers</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Method</th><th className="px-5 py-2 text-right font-medium">Amount</th>
              </tr></thead>
              <tbody className="divide-y">
                {sub.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3">{formatDay(p.paidAt)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{formatDay(p.periodFrom)} – {formatDay(p.periodTo)}</td>
                    <td className="hidden px-3 py-3 text-muted-foreground sm:table-cell">{p.method ?? '—'}{p.note && <span className="block text-xs">{p.note}</span>}</td>
                    <td className="num px-5 py-3 text-right font-medium">{formatMoney(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState icon={<Receipt className="h-5 w-5" />} title="No payments recorded">
              Payments you record appear here and extend the paid-until date.
            </EmptyState>
          )}
        </section>
      </div>

      <aside className="surface h-fit">
        <h3 className="border-b px-5 py-4 font-medium">Record a payment</h3>
        <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); record.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (£)</Label>
            <Input id="amount" type="number" min={0} step="0.01" required className="num" value={payment.amount}
              onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="periodTo">Extends paid-until to</Label>
            <Input id="periodTo" type="date" required value={payment.periodTo}
              onChange={(e) => setPayment((p) => ({ ...p, periodTo: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="method">Method</Label>
            <Input id="method" value={payment.method} onChange={(e) => setPayment((p) => ({ ...p, method: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note</Label>
            <Input id="note" value={payment.note} placeholder="Invoice number, reference…"
              onChange={(e) => setPayment((p) => ({ ...p, note: e.target.value }))} />
          </div>
          <Button type="submit" variant="accent" className="w-full" disabled={!sub || record.isPending}>
            {record.isPending && <Loader2 className="animate-spin" />}Record payment
          </Button>
          {!sub && <p className="text-xs text-muted-foreground">Start a subscription first.</p>}
        </form>
      </aside>
    </div>
  );
}
