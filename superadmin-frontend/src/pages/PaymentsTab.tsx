import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api, type PaymentSettings } from '@/lib/api';

const ACCOUNT_LABELS: Record<PaymentSettings['activeAccount'], string> = {
  Restaurant: "Restaurant's own Stripe account",
  Config: 'Server-config Stripe account',
  None: 'No card payments (cash only)',
};

export default function PaymentsTab({ restaurantId }: { restaurantId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['payments', restaurantId],
    queryFn: () => api.get<PaymentSettings>(`/api/platform/tenants/${restaurantId}/payments`),
  });

  const [isEnabled, setIsEnabled] = useState(false);
  const [useConfigAccount, setUseConfigAccount] = useState(false);
  const [publishableKey, setPublishableKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  useEffect(() => {
    if (!data) return;
    setIsEnabled(data.isEnabled);
    setUseConfigAccount(data.useConfigAccount);
    setPublishableKey(data.publishableKey ?? '');
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put<PaymentSettings>(`/api/platform/tenants/${restaurantId}/payments`, {
      isEnabled, useConfigAccount, publishableKey: publishableKey || null,
      secretKey: secretKey || null, webhookSecret: webhookSecret || null,
    }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['payments', restaurantId], updated);
      setSecretKey('');
      setWebhookSecret('');
      toast.success('Payment settings saved');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (error || !data) return <p className="text-sm text-destructive">{(error as Error)?.message}</p>;

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(data.webhookUrl);
    toast.success('Webhook URL copied');
  };

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-4">
        <span className="text-sm text-muted-foreground">Card payments currently go to:</span>
        <span className="font-medium">{ACCOUNT_LABELS[data.activeAccount]}</span>
        {data.mode && (
          <Badge variant={data.mode === 'live' ? 'default' : 'secondary'}>{data.mode.toUpperCase()}</Badge>
        )}
      </div>

      {!data.encryptionConfigured && (
        <Alert variant="destructive">
          <AlertDescription>
            The server has no PAYMENTS_ENCRYPTION_KEY set, so restaurant Stripe keys can't be saved yet.
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-4">
        <h3 className="font-semibold">Restaurant's own Stripe account</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>In the restaurant's Stripe dashboard, go to <b>Developers → API keys</b> and copy the keys below.</li>
          <li>Go to <b>Developers → Webhooks → Add endpoint</b>, paste the webhook URL, and select the event <code>checkout.session.completed</code>.</li>
          <li>Open the new endpoint, reveal its <b>Signing secret</b> (starts with <code>whsec_</code>) and paste it below.</li>
        </ol>

        <div className="space-y-1.5">
          <Label>Webhook URL</Label>
          <div className="flex gap-2">
            <Input readOnly value={data.webhookUrl} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" aria-label="Copy webhook URL" onClick={copyWebhookUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pk">Publishable key</Label>
            <Input id="pk" placeholder="pk_live_..." value={publishableKey} onChange={(e) => setPublishableKey(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sk">Secret key</Label>
            <Input id="sk" type="password" autoComplete="off"
              placeholder={data.secretKeyLast4 ? `Saved (ends ${data.secretKeyLast4}) - leave blank to keep` : 'sk_live_...'}
              value={secretKey} onChange={(e) => setSecretKey(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="whsec">Webhook signing secret</Label>
            <Input id="whsec" type="password" autoComplete="off"
              placeholder={data.hasWebhookSecret ? 'Saved - leave blank to keep' : 'whsec_...'}
              value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
          </div>
        </div>

        <label className="flex items-center gap-3 text-sm">
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          Take card payments with this restaurant's own Stripe account
        </label>
      </section>

      <section className="space-y-2 rounded-lg border border-dashed p-4">
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={useConfigAccount} onCheckedChange={setUseConfigAccount} disabled={!data.configAccountAvailable} />
          Otherwise use the server-config Stripe account
        </label>
        <p className="text-xs text-muted-foreground">
          The server-config account (STRIPE_SECRET_KEY) belongs to Port Tennant Tandoori. Only turn this on for
          Port Tennant - any other restaurant's customers would pay into Port Tennant's Stripe.
        </p>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save payment settings
        </Button>
      </div>
    </form>
  );
}
