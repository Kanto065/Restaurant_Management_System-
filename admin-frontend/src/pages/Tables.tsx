import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, Copy, Check, ExternalLink, QrCode, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';

interface TableData {
  _id: string;
  restaurant: string;
  tableNumber: string;
  capacity: number;
  qrCode: string | null;
  location: string;
  isActive: boolean;
  uniqueUrl: string;
  fullUrl: string;
  createdAt: string;
  updatedAt: string;
}

const Tables = () => {
  const [tables, setTables] = useState<TableData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [deleteTableId, setDeleteTableId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  
  // Form fields
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [location, setLocation] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<{ tables: TableData[]; count: number }>('/api/tables');
      
      if (response.success && response.data) {
        setTables(response.data.tables);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch tables',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tableNumber || !capacity) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const tableData = {
        tableNumber,
        capacity: parseInt(capacity),
        location,
      };

      if (editingTable) {
        // Update existing table
        const response = await api.put(`/api/tables/${editingTable._id}`, {
          ...tableData,
          isActive: editingTable.isActive,
        });
        
        if (response.success) {
          toast({
            title: 'Success',
            description: response.message || 'Table updated successfully',
          });
          await fetchTables();
          resetForm();
        }
      } else {
        // Create new table
        const response = await api.post<{ table: TableData }>('/api/tables', tableData);
        
        if (response.success) {
          toast({
            title: 'Success',
            description: response.message || 'Table created successfully',
          });
          await fetchTables();
          resetForm();
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${editingTable ? 'update' : 'create'} table`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (table: TableData) => {
    setEditingTable(table);
    setTableNumber(table.tableNumber);
    setCapacity(table.capacity.toString());
    setLocation(table.location);
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTableId) return;

    try {
      const response = await api.delete(`/api/tables/${deleteTableId}`);
      
      if (response.success) {
        toast({
          title: 'Success',
          description: response.message || 'Table deleted successfully',
        });
        await fetchTables();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete table',
        variant: 'destructive',
      });
    } finally {
      setDeleteTableId(null);
    }
  };

  const handleToggleActive = async (table: TableData) => {
    try {
      const response = await api.put(`/api/tables/${table._id}`, {
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        location: table.location,
        isActive: !table.isActive,
      });
      
      if (response.success) {
        toast({
          title: 'Success',
          description: `Table ${!table.isActive ? 'activated' : 'deactivated'} successfully`,
        });
        await fetchTables();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update table status',
        variant: 'destructive',
      });
    }
  };

  const handleCopyUrl = async (url: string, tableId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(tableId);
      toast({
        title: 'Copied!',
        description: 'Table URL copied to clipboard',
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy URL',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setTableNumber('');
    setCapacity('');
    setLocation('');
    setEditingTable(null);
    setIsDialogOpen(false);
  };

  const generateQRCode = async (url: string, tableNumber: string) => {
    try {
      // Create a canvas element
      const canvas = document.createElement('canvas');
      const size = 1024; // HD size (1024x1024)
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Fill white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);

      // Generate QR code using QRCode library (we'll use a simple approach)
      // For production, you should use a proper QR code library like 'qrcode' or 'qrcode.react'
      // Here's a simple implementation using an API service
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=png`;
      
      // Load QR code image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      return new Promise<void>((resolve, reject) => {
        img.onload = () => {
          // Draw QR code
          ctx.drawImage(img, 0, 0, size, size);

          // Add padding and text
          const padding = 80;
          const qrSize = size - (padding * 2);
          
          // Clear canvas and redraw with padding
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, padding, padding, qrSize, qrSize);

          // Add table number text at top
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 48px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`Table ${tableNumber}`, size / 2, 50);

          // Add instruction text at bottom
          ctx.font = '32px Arial';
          ctx.fillText('Scan to view menu', size / 2, size - 30);

          // Download the canvas as PNG
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.download = `table-${tableNumber}-qr-code.png`;
              link.href = url;
              link.click();
              URL.revokeObjectURL(url);
              
              toast({
                title: 'Success',
                description: 'QR code downloaded successfully',
              });
              resolve();
            } else {
              reject(new Error('Failed to create blob'));
            }
          }, 'image/png', 1.0);
        };

        img.onerror = () => {
          reject(new Error('Failed to load QR code'));
        };

        img.src = qrApiUrl;
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate QR code',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Table
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTable ? 'Edit Table' : 'Add New Table'}</DialogTitle>
              <DialogDescription>
                {editingTable ? 'Update table details' : 'Create a new table for your restaurant'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tableNumber">Table Number *</Label>
                <Input
                  id="tableNumber"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g., T-1, Table 5"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity *</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Number of seats"
                  min="1"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Inside, Outside, Patio"
                  disabled={isSubmitting}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingTable ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editingTable ? 'Update Table' : 'Create Table'
                  )}
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
              <p className="text-muted-foreground mb-4">
                Add your first table to get started
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Table
              </Button>
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
                  <TableRow key={table._id}>
                    <TableCell className="font-medium">{table.tableNumber}</TableCell>
                    <TableCell>{table.capacity} seats</TableCell>
                    <TableCell>{table.location || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={table.isActive}
                          onCheckedChange={() => handleToggleActive(table)}
                        />
                        <Badge variant={table.isActive ? 'default' : 'secondary'}>
                          {table.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyUrl(table.fullUrl, table._id)}
                        >
                          {copiedUrl === table._id ? (
                            <>
                              <Check className="w-3 h-3 mr-1" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 mr-1" />
                              Copy URL
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateQRCode(table.fullUrl, table.tableNumber)}
                          title="Download QR Code"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          QR Code
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(table.fullUrl, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(table)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTableId(table._id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTableId} onOpenChange={() => setDeleteTableId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the table
              and remove it from your restaurant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Tables;