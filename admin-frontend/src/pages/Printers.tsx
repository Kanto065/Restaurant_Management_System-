import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Printer as PrinterIcon, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

type PrinterRole = 'Receipt' | 'Kitchen' | 'Bar';
type Connection = 'Network' | 'Usb' | 'Windows';
type Route = 'None' | 'Kitchen' | 'Bar';

interface Printer {
  id: string | null;
  name: string;
  role: PrinterRole;
  connection: Connection;
  address: string | null;
  port: number;
  columns: number;
  hubDeviceId: string | null;
  isActive: boolean;
}

interface PrintRoutes {
  categories: { id: string; name: string; printRoute: Route }[];
  items: { id: string; name: string; categoryId: string; printRouteOverride: Route | null }[];
}

const ROUTE_LABEL: Record<Route, string> = { Kitchen: 'Kitchen', Bar: 'Bar', None: "Don't print" };
const newPrinter = (): Printer => ({ id: null, name: '', role: 'Kitchen', connection: 'Network', address: '', port: 9100, columns: 42, hubDeviceId: null, isActive: true });

const Printers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const onError = (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' });

  const printersQuery = useQuery({ queryKey: ['admin', 'printers'], queryFn: () => api.get<Printer[]>('/api/admin/printers') });
  const routesQuery = useQuery({ queryKey: ['admin', 'print-routes'], queryFn: () => api.get<PrintRoutes>('/api/admin/print-routes') });

  const [printers, setPrinters] = useState<Printer[]>([]);
  useEffect(() => { if (printersQuery.data?.data) setPrinters(printersQuery.data.data); }, [printersQuery.data]);
  const patch = (i: number, p: Partial<Printer>) => setPrinters((list) => list.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const save = useMutation({
    mutationFn: () => api.put<Printer[]>('/api/admin/printers', printers),
    onSuccess: (res) => {
      if (res.data) setPrinters(res.data);
      queryClient.invalidateQueries({ queryKey: ['admin', 'printers'] });
      toast({ title: 'Printers saved', description: 'The main POS picks this up on its next sync.' });
    },
    onError,
  });

  const setCategoryRoute = useMutation({
    mutationFn: ({ id, printRoute }: { id: string; printRoute: Route }) => api.put(`/api/admin/menu-categories/${id}/print-route`, { printRoute }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'print-routes'] }),
    onError,
  });
  const setItemRoute = useMutation({
    mutationFn: ({ id, printRouteOverride }: { id: string; printRouteOverride: Route | null }) =>
      api.put(`/api/admin/menu-items/${id}/print-route`, { printRouteOverride }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'print-routes'] }),
    onError,
  });

  const routes = routesQuery.data?.data;
  const overrides = routes?.items.filter((i) => i.printRouteOverride !== null) ?? [];
  const [overrideItem, setOverrideItem] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Printers</h1>
        <p className="text-muted-foreground">Receipt, kitchen and bar printers on the main POS, and which dishes print where</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Printers</CardTitle>
            <CardDescription>Network printers need a fixed IP address (set a DHCP reservation on the shop router).</CardDescription>
          </div>
          <Button variant="outline" onClick={() => setPrinters((l) => [...l, newPrinter()])}><Plus className="w-4 h-4 mr-2" />Add printer</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {printersQuery.isLoading ? (
            <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : printers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              <PrinterIcon className="h-7 w-7" />No printers yet. Add the receipt printer first, then kitchen and bar.
            </div>
          ) : printers.map((p, i) => (
            <div key={p.id ?? `new-${i}`} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1.4fr_1fr_1fr_1.4fr_90px_90px_auto_auto] md:items-end">
              <div className="space-y-1.5">
                <Label htmlFor={`name-${i}`}>Name</Label>
                <Input id={`name-${i}`} value={p.name} placeholder="Kitchen" onChange={(e) => patch(i, { name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Prints</Label>
                <Select value={p.role} onValueChange={(v) => patch(i, { role: v as PrinterRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Receipt">Receipts</SelectItem><SelectItem value="Kitchen">Kitchen tickets</SelectItem><SelectItem value="Bar">Bar tickets</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Connection</Label>
                <Select value={p.connection} onValueChange={(v) => patch(i, { connection: v as Connection })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Network">Network (LAN)</SelectItem><SelectItem value="Usb">USB</SelectItem><SelectItem value="Windows">Windows printer</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`addr-${i}`}>{p.connection === 'Network' ? 'IP address' : 'Printer name'}</Label>
                <Input id={`addr-${i}`} value={p.address ?? ''} placeholder={p.connection === 'Network' ? '192.168.1.50' : 'Aures ODP 333'}
                  onChange={(e) => patch(i, { address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`port-${i}`}>Port</Label>
                <Input id={`port-${i}`} type="number" value={p.port} disabled={p.connection !== 'Network'} onChange={(e) => patch(i, { port: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`cols-${i}`}>Width</Label>
                <Input id={`cols-${i}`} type="number" value={p.columns} title="Characters per line (80 mm paper is usually 42 or 48)"
                  onChange={(e) => patch(i, { columns: Number(e.target.value) })} />
              </div>
              <label className="flex h-10 items-center gap-2 text-sm">
                <Switch checked={p.isActive} onCheckedChange={(v) => patch(i, { isActive: v })} />On
              </label>
              <Button variant="ghost" size="icon" aria-label="Remove printer" onClick={() => setPrinters((l) => l.filter((_, j) => j !== i))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save printers
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where dishes print</CardTitle>
          <CardDescription>Each category prints to the kitchen or the bar. Pick out single dishes below when they should go somewhere else.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {routesQuery.isLoading || !routes ? (
            <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="divide-y rounded-lg border">
                {routes.categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <span className="text-sm font-medium">{c.name}</span>
                    <Select value={c.printRoute} onValueChange={(v) => setCategoryRoute.mutate({ id: c.id, printRoute: v as Route })}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>{(['Kitchen', 'Bar', 'None'] as Route[]).map((r) => <SelectItem key={r} value={r}>{ROUTE_LABEL[r]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
                {routes.categories.length === 0 && <p className="p-4 text-sm text-muted-foreground">No categories yet.</p>}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Exceptions</h3>
                {overrides.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 rounded-lg border px-4 py-2.5">
                    <span className="text-sm">{item.name}
                      <span className="ml-2 text-xs text-muted-foreground">({routes.categories.find((c) => c.id === item.categoryId)?.name})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Select value={item.printRouteOverride!} onValueChange={(v) => setItemRoute.mutate({ id: item.id, printRouteOverride: v as Route })}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>{(['Kitchen', 'Bar', 'None'] as Route[]).map((r) => <SelectItem key={r} value={r}>{ROUTE_LABEL[r]}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" onClick={() => setItemRoute.mutate({ id: item.id, printRouteOverride: null })}>Follow category</Button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Select value={overrideItem} onValueChange={setOverrideItem}>
                    <SelectTrigger className="max-w-sm"><SelectValue placeholder="Choose a dish to send to the bar…" /></SelectTrigger>
                    <SelectContent>
                      {routes.items.filter((i) => i.printRouteOverride === null).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" disabled={!overrideItem}
                    onClick={() => { setItemRoute.mutate({ id: overrideItem, printRouteOverride: 'Bar' }); setOverrideItem(''); }}>
                    <Plus className="w-4 h-4 mr-2" />Add exception
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Printers;
