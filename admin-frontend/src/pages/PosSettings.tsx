import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Loader2, MonitorSmartphone, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

const FEATURE_LABELS: Record<string, string> = {
  pos: 'POS apps',
  'pos.waiter': 'Waiter tablets',
  'pos.kitchenPrint': 'Kitchen tickets',
  'pos.barPrint': 'Bar tickets',
  'pos.discounts': 'Discounts',
  'pos.refunds': 'Refunds',
  'pos.reports': 'Sales reports',
  'pos.printOnlineOrders': 'Print online orders in the kitchen',
  'online.ordering': 'Online ordering',
};

interface Paired { deviceId: string; deviceName: string; secret: string }

const PosSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('Main till');
  const [paired, setPaired] = useState<Paired | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const features = useQuery({ queryKey: ['admin', 'features'], queryFn: () => api.get<Record<string, boolean>>('/api/admin/features') });

  const register = useMutation({
    mutationFn: () => api.post<Paired>('/api/admin/pos-devices', { deviceName: name }),
    onSuccess: (res) => {
      if (res.data) setPaired(res.data);
      queryClient.invalidateQueries({ queryKey: ['admin', 'devices'] });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">POS settings</h1>
        <p className="text-muted-foreground">Set up the main POS till and see which POS features your plan includes</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MonitorSmartphone className="h-5 w-5" />Main POS till</CardTitle>
            <CardDescription>
              The Windows till that runs the shop: tables, the kitchen and bar printers, waiter tablets and payments. It keeps working when the
              internet drops and catches up afterwards. Register it here, then enter the ID and secret on the till (or scan the code).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); register.mutate(); }}>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="tillName">Name</Label>
                <Input id="tillName" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <Button type="submit" disabled={register.isPending}>
                {register.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Register till
              </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">Registered tills appear under POS Terminals, where you can sign them out.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
            <CardDescription>Switched on by your platform provider. Ask them to change your plan for more.</CardDescription>
          </CardHeader>
          <CardContent>
            {features.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
              <ul className="divide-y">
                {Object.entries(features.data?.data ?? {}).map(([key, on]) => (
                  <li key={key} className="flex items-center justify-between py-2 text-sm">
                    {FEATURE_LABELS[key] ?? key}
                    {on ? <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-500"><Check className="h-4 w-4" />On</span>
                      : <span className="inline-flex items-center gap-1 text-muted-foreground"><X className="h-4 w-4" />Off</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={paired !== null} onOpenChange={(open) => { if (!open) setPaired(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{paired?.deviceName} registered</DialogTitle>
            <DialogDescription>The secret is shown once. Enter these on the till now, or scan the code from the till's pairing screen.</DialogDescription>
          </DialogHeader>
          {paired && (
            <div className="space-y-4">
              <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG value={JSON.stringify({ deviceId: paired.deviceId, secret: paired.secret })} size={180} />
              </div>
              {[['Device ID', paired.deviceId], ['Secret', paired.secret]].map(([label, value]) => (
                <div key={label} className="space-y-1">
                  <Label>{label}</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={value} className="font-mono text-xs" />
                    <Button variant="outline" size="icon" aria-label={`Copy ${label}`} onClick={() => copy(label, value)}>
                      {copied === label ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PosSettings;
