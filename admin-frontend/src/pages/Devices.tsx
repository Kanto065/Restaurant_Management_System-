import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Smartphone, Copy, Check, Ban, RefreshCw, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';

interface DeviceRow {
  id: string;
  deviceName: string;
  isActive: boolean;
  lastSeenAt: string | null;
}

interface DevicePaired {
  deviceId: string;
  deviceName: string;
  secret: string;
}

const formatLastSeen = (date: string | null) =>
  date ? new Date(date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never';

const Devices = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceRow | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<DeviceRow | null>(null);
  const [paired, setPaired] = useState<DevicePaired | null>(null);
  const [copiedField, setCopiedField] = useState<'id' | 'secret' | null>(null);

  const devicesQuery = useQuery({
    queryKey: ['admin', 'devices'],
    queryFn: () => api.get<DeviceRow[]>('/api/admin/devices'),
  });
  const devices = devicesQuery.data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'devices'] });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post<DevicePaired>('/api/admin/devices', { deviceName: name }),
    onSuccess: (res) => {
      setIsAddOpen(false);
      setDeviceName('');
      if (res.data) setPaired(res.data);
      invalidate();
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/admin/devices/${id}/deactivate`, {}),
    onSuccess: () => { toast({ title: 'Success', description: 'Terminal deactivated.' }); invalidate(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    onSettled: () => setDeactivateId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/devices/${id}`),
    onSuccess: () => { toast({ title: 'Deleted', description: 'Terminal removed.' }); invalidate(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    onSettled: () => setDeleteTarget(null),
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => api.put<DevicePaired>(`/api/admin/devices/${id}/regenerate-secret`, {}),
    onSuccess: (res) => { if (res.data) setPaired(res.data); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    onSettled: () => setRegenerateTarget(null),
  });

  const copy = (text: string, field: 'id' | 'secret') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) {
      toast({ title: 'Validation Error', description: 'Give the terminal a name, e.g. "Front counter".', variant: 'destructive' });
      return;
    }
    createMutation.mutate(deviceName.trim());
  };

  if (devicesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading terminals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">POS Terminals</h1>
          <p className="text-muted-foreground">
            Pair a Sunmi terminal by registering it here, then scanning the QR code on the terminal's "Pair this terminal" screen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            {/* Always serves the current build - android-release.yml re-publishes this exact
                path to MinIO on every POS release (see deploy/caddy/Caddyfile). */}
            <a href="/download/pos" target="_blank" rel="noreferrer">
              <Download className="w-4 h-4 mr-2" />Download POS App
            </a>
          </Button>
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setDeviceName(''); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Register Terminal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register a POS Terminal</DialogTitle>
              <DialogDescription>Give it a name so you can tell terminals apart later, e.g. "Front counter" or "Kitchen".</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deviceName">Terminal Name *</Label>
                <Input
                  id="deviceName" value={deviceName} onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. Front counter" required disabled={createMutation.isPending}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={createMutation.isPending}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registering...</>) : 'Register'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Terminals ({devices.length})</CardTitle>
          <CardDescription>A deactivated terminal can no longer sign in or receive orders</CardDescription>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="text-center py-12">
              <Smartphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No terminals registered yet.</p>
              <Button onClick={() => setIsAddOpen(true)}><Plus className="w-4 h-4 mr-2" />Register Terminal</Button>
            </div>
          ) : (
            <div className="divide-y">
              {devices.map((d) => (
                <div key={d.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {d.deviceName}
                      {!d.isActive && <Badge variant="outline" className="text-muted-foreground">Deactivated</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">Last seen: {formatLastSeen(d.lastSeenAt)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" aria-label="Regenerate secret" onClick={() => setRegenerateTarget(d)}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    {d.isActive && (
                      <Button variant="ghost" size="icon" aria-label="Deactivate terminal" onClick={() => setDeactivateId(d.id)}>
                        <Ban className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="text-destructive" aria-label="Delete terminal" onClick={() => setDeleteTarget(d)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deactivateId} onOpenChange={() => setDeactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this terminal?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be signed out immediately and can't pair again with the same credentials. Register a new terminal if it needs to come back online.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivateMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deactivateMutation.isPending}
              onClick={() => deactivateId && deactivateMutation.mutate(deactivateId)}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.deviceName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the terminal from the list entirely, not just signs it out. If it's still active it'll be
              signed out too. This can't be undone from here — you'd need to register it again from scratch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!regenerateTarget} onOpenChange={(open) => !open && setRegenerateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate secret for "{regenerateTarget?.deviceName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The current secret stops working immediately - the terminal will need to be re-paired with the new one.
              Device ID stays the same.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenerateMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={regenerateMutation.isPending}
              onClick={() => regenerateTarget && regenerateMutation.mutate(regenerateTarget.id)}
            >
              {regenerateMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Regenerating...</>) : 'Regenerate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!paired} onOpenChange={(open) => !open && setPaired(null)}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>"{paired?.deviceName}" credentials</DialogTitle>
            <DialogDescription>
              Scan this on the terminal's "Pair this terminal" screen, or enter the ID and secret by hand.
              <strong> The secret is shown only once</strong> — pair now, it can't be retrieved again after you close this.
            </DialogDescription>
          </DialogHeader>
          {paired && (
            <div className="flex justify-center py-2">
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG value={JSON.stringify({ deviceId: paired.deviceId, secret: paired.secret })} size={200} />
              </div>
            </div>
          )}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Device ID</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={paired?.deviceId ?? ''} className="font-mono text-sm" />
                <Button type="button" variant="outline" size="icon" onClick={() => paired && copy(paired.deviceId, 'id')}>
                  {copiedField === 'id' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Secret</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={paired?.secret ?? ''} className="font-mono text-sm" />
                <Button type="button" variant="outline" size="icon" onClick={() => paired && copy(paired.secret, 'secret')}>
                  {copiedField === 'secret' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPaired(null)}>Done, I've saved it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Devices;
