import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, PageHeader } from '@/components/Page';
import { api, type FeatureMap, type Plan } from '@/lib/api';
import { FEATURES } from '@/lib/features';
import { formatMoney } from '@/lib/format';

// online.ordering is always on, so it isn't a plan choice.
const PLAN_FEATURES = FEATURES.filter((f) => f.key !== 'online.ordering');

type Draft = { id?: string; name: string; priceMonthly: string; maxRestaurants: string; maxStaffUsers: string; maxDevices: string; features: FeatureMap; isActive: boolean };

const blank: Draft = { name: '', priceMonthly: '', maxRestaurants: '1', maxStaffUsers: '0', maxDevices: '', features: { pos: true }, isActive: true };

function toDraft(p: Plan): Draft {
  return { id: p.id, name: p.name, priceMonthly: String(p.priceMonthly), maxRestaurants: String(p.maxRestaurants),
    maxStaffUsers: String(p.maxStaffUsers), maxDevices: p.maxDevices === null ? '' : String(p.maxDevices), features: p.features, isActive: p.isActive };
}

export default function Plans() {
  const queryClient = useQueryClient();
  const { data: plans, isLoading, error } = useQuery({ queryKey: ['plans'], queryFn: () => api.get<Plan[]>('/api/platform/plans') });
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = {
        name: d.name, priceMonthly: Number(d.priceMonthly), maxRestaurants: Number(d.maxRestaurants),
        maxStaffUsers: Number(d.maxStaffUsers), maxDevices: d.maxDevices === '' ? null : Number(d.maxDevices),
        features: d.features, isActive: d.isActive,
      };
      return d.id ? api.put<Plan>(`/api/platform/plans/${d.id}`, body) : api.post<Plan>('/api/platform/plans', body);
    },
    onSuccess: (_, d) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast.success(d.id ? 'Plan saved' : 'Plan created');
      setDraft(null);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <>
      <PageHeader
        title="Plans"
        description="What a restaurant pays each month and which features come with it. A restaurant without a plan has every limit lifted."
        actions={<Button onClick={() => setDraft(blank)}><Plus />New plan</Button>}
      />

      {error && <p className="mb-4 text-sm text-destructive">{(error as Error).message}</p>}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
      ) : !plans?.length ? (
        <div className="surface">
          <EmptyState icon={<Layers className="h-5 w-5" />} title="No plans yet"
            action={<Button variant="outline" onClick={() => setDraft(blank)}><Plus />Create a plan</Button>}>
            Plans set the monthly price, how many devices a restaurant can pair and which POS features it gets.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const on = PLAN_FEATURES.filter((f) => p.features[f.key]);
            return (
              <article key={p.id} className="surface flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{p.name}</h2>
                    {!p.isActive && <Badge variant="outline" className="mt-1">Not offered</Badge>}
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => setDraft(toDraft(p))}><Pencil /></Button>
                </div>
                <p className="num mt-3 text-3xl font-semibold tracking-tight">
                  {formatMoney(p.priceMonthly)}<span className="ml-1 text-sm font-normal text-muted-foreground">/ month</span>
                </p>
                <dl className="num mt-4 grid grid-cols-3 gap-2 rounded-lg bg-secondary/60 p-3 text-center text-xs">
                  <div><dt className="text-muted-foreground">Devices</dt><dd className="mt-0.5 text-sm font-medium">{p.maxDevices ?? '∞'}</dd></div>
                  <div><dt className="text-muted-foreground">Staff</dt><dd className="mt-0.5 text-sm font-medium">{p.maxStaffUsers || '∞'}</dd></div>
                  <div><dt className="text-muted-foreground">Sites</dt><dd className="mt-0.5 text-sm font-medium">{p.maxRestaurants || '∞'}</dd></div>
                </dl>
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {on.length ? on.map((f) => <li key={f.key}><Badge variant="secondary">{f.title}</Badge></li>)
                    : <li className="text-sm text-muted-foreground">No POS features</li>}
                </ul>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={draft !== null} onOpenChange={(open) => { if (!open) setDraft(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit plan' : 'New plan'}</DialogTitle>
            <DialogDescription>Changes apply to every restaurant on this plan straight away.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form id="plan-form" className="space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate(draft); }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="planName">Name</Label>
                  <Input id="planName" required value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Till + tablets" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="price">Price per month (£)</Label>
                  <Input id="price" type="number" min={0} step="0.01" required className="num" value={draft.priceMonthly} onChange={(e) => set({ priceMonthly: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="devices">Device limit <span className="font-normal text-muted-foreground">(blank = none)</span></Label>
                  <Input id="devices" type="number" min={0} className="num" value={draft.maxDevices} onChange={(e) => set({ maxDevices: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff">Staff limit <span className="font-normal text-muted-foreground">(0 = none)</span></Label>
                  <Input id="staff" type="number" min={0} className="num" value={draft.maxStaffUsers} onChange={(e) => set({ maxStaffUsers: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sites">Restaurant limit <span className="font-normal text-muted-foreground">(0 = none)</span></Label>
                  <Input id="sites" type="number" min={0} className="num" value={draft.maxRestaurants} onChange={(e) => set({ maxRestaurants: e.target.value })} />
                </div>
              </div>
              <fieldset>
                <legend className="eyebrow mb-2">Included POS features</legend>
                <p className="mb-2 text-xs text-muted-foreground">“POS apps” itself is switched per restaurant on its Features tab.</p>
                <div className="divide-y rounded-lg ring-1 ring-border">
                  {PLAN_FEATURES.filter((f) => f.key !== 'pos').map((f) => (
                    <label key={f.key} className="flex cursor-pointer items-center justify-between gap-4 px-3 py-2.5 text-sm">
                      {f.title}
                      <Switch checked={!!draft.features[f.key]}
                        onCheckedChange={(v) => set({ features: { ...draft.features, [f.key]: v } })} />
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-center justify-between gap-4 text-sm">
                Offered to new restaurants
                <Switch checked={draft.isActive} onCheckedChange={(v) => set({ isActive: v })} />
              </label>
            </form>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button type="submit" form="plan-form" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}{draft?.id ? 'Save plan' : 'Create plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
