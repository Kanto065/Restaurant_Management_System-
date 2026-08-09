import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, Copy, Check, ExternalLink, QrCode, Download } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';

// The storefront's own domain — table QR codes link to /table/:qrToken there.
// Falls back to the current admin origin's registrable domain during local dev.
const STOREFRONT_BASE_URL = import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://www.porttennanttandoori.co.uk';

interface TableData {
  id: string;
  tableNumber: string;
  capacity: number;
  location: string | null;
  qrToken: string;
  isActive: boolean;
}

const tableUrl = (t: TableData) => `${STOREFRONT_BASE_URL}/table/${t.qrToken}`;

const Tables = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [deleteTableId, setDeleteTableId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [location, setLocation] = useState('');

  const tablesQuery = useQuery({
    queryKey: ['admin', 'tables'],
    queryFn: () => api.get<TableData[]>('/api/admin/tables'),
  });
  const tables = tablesQuery.data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'tables'] });

  const createMutation = useMutation({
    mutationFn: (payload: { tableNumber: string; capacity: number; location: string; isActive: boolean }) =>
      api.post('/api/admin/tables', payload),
    onSuccess: () => { toast({ title: 'Success', description: 'Table created.' }); invalidate(); resetForm(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { tableNumber: string; capacity: number; location: string; isActive: boolean } }) =>
      api.put(`/api/admin/tables/${id}`, payload),
    onSuccess: () => { toast({ title: 'Success', description: 'Table updated.' }); invalidate(); resetForm(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/tables/${id}`),
    onSuccess: () => { toast({ title: 'Success', description: 'Table deleted.' }); invalidate(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    onSettled: () => setDeleteTableId(null),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (table: TableData) => api.put(`/api/admin/tables/${table.id}`, {
      tableNumber: table.tableNumber, capacity: table.capacity, location: table.location ?? '', isActive: !table.isActive,
    }),
    onSuccess: invalidate,
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber || !capacity) {
      toast({ title: 'Validation Error', description: 'Table number and capacity are required.', variant: 'destructive' });
      return;
    }
    const payload = { tableNumber, capacity: parseInt(capacity, 10) || 1, location, isActive: editingTable?.isActive ?? true };
    if (editingTable) {
      updateMutation.mutate({ id: editingTable.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (table: TableData) => {
    setEditingTable(table);
    setTableNumber(table.tableNumber);
    setCapacity(table.capacity.toString());
    setLocation(table.location ?? '');
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setTableNumber(''); setCapacity(''); setLocation(''); setEditingTable(null); setIsDialogOpen(false);
  };

  const handleCopyUrl = async (table: TableData) => {
    try {
      await navigator.clipboard.writeText(tableUrl(table));
      setCopiedId(table.id);
      toast({ title: 'Copied!', description: 'Table URL copied to clipboard' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: 'Error', description: 'Failed to copy URL', variant: 'destructive' });
    }
  };

  const generateQRCode = (table: TableData) => {
    const url = tableUrl(table);
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=png`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      const padding = 80;
      ctx.drawImage(img, padding, padding, size - padding * 2, size - padding * 2);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Table ${table.tableNumber}`, size / 2, 50);
      ctx.font = '32px Arial';
      ctx.fillText('Scan to view menu', size / 2, size - 30);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `table-${table.tableNumber}-qr-code.png`;
        link.href = blobUrl;
        link.click();
        URL.revokeObjectURL(blobUrl);
        toast({ title: 'Success', description: 'QR code downloaded successfully' });
      }, 'image/png', 1.0);
    };
    img.onerror = () => toast({ title: 'Error', description: 'Failed to generate QR code', variant: 'destructive' });
    img.src = qrApiUrl;
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (tablesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading tables...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tables</h1>
          <p className="text-muted-foreground">Manage your restaurant tables</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsDialogOpen(true) : resetForm())}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingTable(null); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Table
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTable ? 'Edit Table' : 'Add New Table'}</DialogTitle>
              <DialogDescription>{editingTable ? 'Update table details' : 'Create a new table for your restaurant'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tableNumber">Table Number *</Label>
                <Input id="tableNumber" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g., T-1, Table 5" required disabled={isSubmitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity *</Label>
                <Input id="capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Number of seats" min="1" required disabled={isSubmitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Inside, Outside, Patio" disabled={isSubmitting} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{editingTable ? 'Updating...' : 'Creating...'}</>
                  ) : editingTable ? 'Update Table' : 'Create Table'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tables ({tables.length})</CardTitle>
          <CardDescription>View and manage all restaurant tables</CardDescription>
        </CardHeader>
        <CardContent>
          {tables.length === 0 ? (
            <div className="text-center py-12">
              <QrCode className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tables yet</h3>
              <p className="text-muted-foreground mb-4">Add your first table to get started</p>
              <Button onClick={() => setIsDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Table</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table Number</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Table URL</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell className="font-medium">{table.tableNumber}</TableCell>
                    <TableCell>{table.capacity} seats</TableCell>
                    <TableCell>{table.location || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={table.isActive} onCheckedChange={() => toggleActiveMutation.mutate(table)} />
                        <Badge variant={table.isActive ? 'default' : 'secondary'}>{table.isActive ? 'Active' : 'Inactive'}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleCopyUrl(table)}>
                          {copiedId === table.id ? <><Check className="w-3 h-3 mr-1" />Copied</> : <><Copy className="w-3 h-3 mr-1" />Copy URL</>}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => generateQRCode(table)} title="Download QR Code">
                          <Download className="w-3 h-3 mr-1" />QR Code
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => window.open(tableUrl(table), '_blank')}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(table)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTableId(table.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTableId} onOpenChange={() => setDeleteTableId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the table and remove it from your restaurant.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTableId && deleteMutation.mutate(deleteTableId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Tables;
