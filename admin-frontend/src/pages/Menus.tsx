import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, BookOpen } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';

interface MenuCategory {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

const Menus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MenuCategory | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'menu-categories'],
    queryFn: () => api.get<MenuCategory[]>('/api/admin/menu-categories'),
  });
  const categories = [...(categoriesQuery.data?.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'menu-categories'] });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; displayOrder: number; isActive: boolean }) => api.post('/api/admin/menu-categories', payload),
    onSuccess: () => { toast({ title: 'Success', description: 'Category created.' }); invalidate(); resetForm(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; displayOrder: number; isActive: boolean } }) =>
      api.put(`/api/admin/menu-categories/${id}`, payload),
    onSuccess: () => { toast({ title: 'Success', description: 'Category updated.' }); invalidate(); resetForm(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/menu-categories/${id}`),
    onSuccess: () => { toast({ title: 'Success', description: 'Category deleted.' }); invalidate(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    onSettled: () => setDeleteId(null),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (cat: MenuCategory) => api.put(`/api/admin/menu-categories/${cat.id}`, {
      name: cat.name, displayOrder: cat.displayOrder, isActive: !cat.isActive,
    }),
    onSuccess: invalidate,
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Validation Error', description: 'Category name is required.', variant: 'destructive' });
      return;
    }
    const payload = { name, displayOrder: parseInt(displayOrder, 10) || 0, isActive };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (cat: MenuCategory) => {
    setEditing(cat);
    setName(cat.name);
    setDisplayOrder(cat.displayOrder.toString());
    setIsActive(cat.isActive);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setName(''); setDisplayOrder('0'); setIsActive(true); setEditing(null); setIsDialogOpen(false);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (categoriesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading menu categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Categories</h1>
          <p className="text-muted-foreground">
            Manage the category sidebar customers see when browsing your menu — order controls display order.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsDialogOpen(true) : resetForm())}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Category' : 'Add New Category'}</DialogTitle>
              <DialogDescription>{editing ? 'Update category details' : 'Create a new menu category, e.g. "Starters" or "Biryani Dishes"'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Tandoori Specialities" required disabled={isSubmitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayOrder">Display Order</Label>
                <Input id="displayOrder" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} disabled={isSubmitting} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive">Active</Label>
                  <p className="text-xs text-muted-foreground">Inactive categories are hidden from the storefront</p>
                </div>
                <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} disabled={isSubmitting} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>) : editing ? 'Update Category' : 'Create Category'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Categories ({categories.length})</CardTitle>
          <CardDescription>Shown to customers in this order on the storefront's menu sidebar</CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No categories yet</h3>
              <p className="text-muted-foreground mb-4">Add your first category to start building your menu</p>
              <Button onClick={() => setIsDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Category</Button>
            </div>
          ) : (
            <div className="divide-y">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{cat.displayOrder}</Badge>
                    <span className="font-medium">{cat.name}</span>
                    {!cat.isActive && <Badge variant="secondary">Hidden</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={cat.isActive} onCheckedChange={() => toggleActiveMutation.mutate(cat)} />
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(cat)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(cat.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the category. Menu items in this category will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Menus;
