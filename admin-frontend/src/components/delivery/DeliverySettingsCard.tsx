import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { Loader2, Truck } from 'lucide-react';
import { api } from '@/lib/api';

export interface DeliverySettings {
  maxDeliveryMiles: number;
  outsideZoneDeliveryFee: number | null;
  outsideZoneMinimumOrder: number | null;
  restaurantPostcode: string;
  restaurantLatitude: number | null;
  restaurantLongitude: number | null;
}

export const DELIVERY_SETTINGS_KEY = ['admin', 'delivery-settings'];

export function useDeliverySettings() {
  return useQuery({
    queryKey: DELIVERY_SETTINGS_KEY,
    queryFn: () => api.get<DeliverySettings>('/api/admin/delivery-zones/settings'),
  });
}

type Form = { fee: string; min: string; miles: string };
const toForm = (s: DeliverySettings): Form => ({
  fee: s.outsideZoneDeliveryFee?.toString() ?? '',
  min: s.outsideZoneMinimumOrder?.toString() ?? '',
  miles: s.maxDeliveryMiles.toString(),
});

/**
 * The delivery price for addresses inside no zone ("anywhere else") and the furthest the
 * restaurant delivers. Lives on Configurations; the Delivery Zones page links here.
 */
export default function DeliverySettingsCard({ className = '' }: { className?: string }) {
  const { toast } = useToast();
  const currency = useCurrency();
  const queryClient = useQueryClient();
  const settingsQuery = useDeliverySettings();
  const zonesQuery = useQuery({
    queryKey: ['admin', 'delivery-zones'],
    queryFn: () => api.get<{ deliveryFee: number; minimumOrderAmount: number; isActive: boolean }[]>('/api/admin/delivery-zones'),
  });
  const settings = settingsQuery.data?.data;
  const active = (zonesQuery.data?.data ?? []).filter((z) => z.isActive);
  const highestFee = active.length ? Math.max(...active.map((z) => z.deliveryFee)) : null;
  const highestMin = active.length ? Math.max(...active.map((z) => z.minimumOrderAmount)) : null;

  const [form, setForm] = useState<Form>({ fee: '', min: '', miles: '5' });
  useEffect(() => { if (settings) setForm(toForm(settings)); }, [settings]);
  const dirty = !!settings && JSON.stringify(form) !== JSON.stringify(toForm(settings));

  const save = useMutation({
    mutationFn: () => api.put<DeliverySettings>('/api/admin/delivery-zones/settings', {
      maxDeliveryMiles: parseFloat(form.miles),
      outsideZoneDeliveryFee: form.fee.trim() === '' ? null : parseFloat(form.fee),
      outsideZoneMinimumOrder: form.min.trim() === '' ? null : parseFloat(form.min),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DELIVERY_SETTINGS_KEY });
      toast({ title: 'Saved', description: 'Delivery limit and "anywhere else" price updated.' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: "Couldn't save", description: e.message }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const miles = parseFloat(form.miles);
    if (Number.isNaN(miles) || miles <= 0) {
      toast({ variant: 'destructive', title: 'Check the delivery limit', description: 'Enter the furthest distance you deliver, in miles.' });
      return;
    }
    save.mutate();
  };

  return (
    <section className={`rounded-xl border bg-card p-4 sm:p-5 ${className}`}>
      <header className="flex items-start gap-3 mb-4">
        <span className="grid place-items-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0"><Truck className="w-4 h-4" /></span>
        <div className="min-w-0">
          <h2 className="font-semibold leading-tight">Delivery outside your zones</h2>
          <p className="text-sm text-muted-foreground text-pretty">
            Price for addresses that aren't inside any <Link to="/dashboard/delivery-zones" className="underline underline-offset-2 hover:text-foreground">delivery zone</Link>, and how far you deliver at all.
          </p>
        </div>
      </header>

      {!settings ? (
        <div className="grid grid-cols-3 gap-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field id="outsideFee" label="Delivery fee" prefix={currency} value={form.fee} step="0.01"
              placeholder={highestFee?.toFixed(2) ?? ''} onChange={(fee) => setForm((f) => ({ ...f, fee }))} />
            <Field id="outsideMin" label="Minimum order" prefix={currency} value={form.min} step="0.01"
              placeholder={highestMin?.toFixed(2) ?? '0.00'} onChange={(min) => setForm((f) => ({ ...f, min }))} />
            <Field id="maxMiles" label="Deliver up to" suffix="mi" value={form.miles} step="0.5"
              onChange={(miles) => setForm((f) => ({ ...f, miles }))} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Blank fee or minimum = your highest zone's price. The limit is straight-line distance.
            </p>
            <Button type="submit" size="sm" disabled={!dirty || save.isPending} className="shrink-0 active:scale-[0.98] transition-transform">
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({ id, label, value, onChange, prefix, suffix, placeholder, step }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; placeholder?: string; step: string;
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label htmlFor={id} className="text-xs text-muted-foreground font-medium">{label}</Label>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">{prefix}</span>}
        <Input id={id} type="number" min="0" step={step} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`tabular-nums ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-9' : ''}`} />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
