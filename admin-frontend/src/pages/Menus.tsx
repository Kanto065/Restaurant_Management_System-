import { useLayoutEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, BookOpen, GripVertical, List, LayoutGrid, UtensilsCrossed } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { getImageUrl } from '@/config/api';
import { ImageUploadField } from '@/components/ImageUploadField';

interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  itemCount: number;
}

type ViewMode = 'list' | 'grid';

const Menus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MenuCategory | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRects = useRef(new Map<string, DOMRect>());

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'menu-categories'],
    queryFn: () => api.get<MenuCategory[]>('/api/admin/menu-categories'),
  });
  const categories = [...(categoriesQuery.data?.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'menu-categories'] });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => api.put('/api/admin/menu-categories/reorder', { orderedIds }),
    onSuccess: invalidate,
    onError: (error: Error) => { toast({ title: 'Error', description: error.message, variant: 'destructive' }); invalidate(); },
  });

  // FLIP: capture each row's current position before the reorder commits, then in the
  // layout effect below (fires after the reordered DOM paints) work out how far each row
  // visually jumped and animate it back from there - a plain CSS transition can't do this
  // because the rows aren't moving continuously, they're being reordered discretely.
  const captureRectsForFlip = () => {
    prevRects.current.clear();
    for (const [id, el] of rowRefs.current) prevRects.current.set(id, el.getBoundingClientRect());
  };

  useLayoutEffect(() => {
    if (prevRects.current.size === 0) return;
    for (const [id, el] of rowRefs.current) {
      const prev = prevRects.current.get(id);
      if (!prev) continue;
      const next = el.getBoundingClientRect();
      const deltaY = prev.top - next.top;
      if (deltaY === 0) continue;
      el.style.transition = 'none';
      el.style.transform = `translateY(${deltaY}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 220ms ease';
        el.style.transform = '';
      });
    }
    prevRects.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.map((c) => c.id).join(',')]);

  const handleDrop = (targetId: string) => {
    setDragOverId(null);
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const ids = categories.map((c) => c.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    setDragId(null);

    captureRectsForFlip();
    // Optimistic reorder so the row animates into place immediately instead of jumping
    // once the network round-trip finishes.
    queryClient.setQueryData(['admin', 'menu-categories'], (old: { data: MenuCategory[] } | undefined) => {
      if (!old) return old;
      const byId = new Map(old.data.map((c) => [c.id, c]));
      return { ...old, data: ids.map((id, i) => ({ ...byId.get(id)!, displayOrder: i })) };
    });
    reorderMutation.mutate(ids);
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; description: string | null; imageUrl: string | null; displayOrder: number; isActive: boolean }) => api.post('/api/admin/menu-categories', payload),
    onSuccess: () => { toast({ title: 'Success', description: 'Category created.' }); invalidate(); resetForm(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; description: string | null; imageUrl: string | null; displayOrder: number; isActive: boolean } }) =>
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
      name: cat.name, description: cat.description, imageUrl: cat.imageUrl, displayOrder: cat.displayOrder, isActive: !cat.isActive,
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
    const payload = { name, description: description.trim() || null, imageUrl, displayOrder: parseInt(displayOrder, 10) || 0, isActive };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (cat: MenuCategory) => {
    setEditing(cat);
    setName(cat.name);
    setDescription(cat.description ?? '');
    setImageUrl(cat.imageUrl);
    setDisplayOrder(cat.displayOrder.toString());
    setIsActive(cat.isActive);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setName(''); setDescription(''); setImageUrl(null); setDisplayOrder('0'); setIsActive(true); setEditing(null); setIsDialogOpen(false);
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
            Manage the category sidebar customers see when browsing your menu — drag rows to reorder.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" className="rounded-r-none" onClick={() => setView('list')} aria-label="List view">
              <List className="w-4 h-4" />
            </Button>
            <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="icon" className="rounded-l-none" onClick={() => setView('grid')} aria-label="Grid view">
              <LayoutGrid className="w-4 h-4" />
            </Button>
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
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Marinated meats grilled in our clay tandoor" rows={2} disabled={isSubmitting} />
              </div>
              <ImageUploadField label="Category Image" value={imageUrl} onChange={setImageUrl} />
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
          ) : view === 'list' ? (
            <div className="divide-y">
              {categories.map((cat, index) => (
                <div
                  key={cat.id}
                  ref={(el) => { if (el) rowRefs.current.set(cat.id, el); else rowRefs.current.delete(cat.id); }}
                  draggable
                  onDragStart={() => setDragId(cat.id)}
                  onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== cat.id) setDragOverId(cat.id); }}
                  onDragLeave={() => setDragOverId((id) => (id === cat.id ? null : id))}
                  onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                  onDrop={() => handleDrop(cat.id)}
                  className={`flex items-center justify-between py-1.5 border-t-2 transition-colors ${
                    dragId === cat.id ? 'opacity-40' : dragOverId === cat.id ? 'border-t-primary' : 'border-t-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground w-5 text-right tabular-nums shrink-0">{index + 1}</span>
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
                    {cat.imageUrl ? (
                      <img src={getImageUrl(cat.imageUrl)} alt={cat.name} className="w-8 h-8 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <span className="font-medium shrink-0">{cat.name}</span>
                    {cat.description && (
                      <span className="text-xs text-muted-foreground truncate" title={cat.description}>{cat.description}</span>
                    )}
                    <Badge variant="outline" className="shrink-0">{cat.itemCount} item{cat.itemCount === 1 ? '' : 's'}</Badge>
                    {!cat.isActive && <Badge variant="secondary" className="shrink-0">Hidden</Badge>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={cat.isActive} onCheckedChange={() => toggleActiveMutation.mutate(cat)} />
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(cat)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(cat.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat, index) => (
                <Card key={cat.id} className="overflow-hidden relative">
                  <Badge variant="secondary" className="absolute top-2 left-2 z-10">{index + 1}</Badge>
                  {cat.imageUrl ? (
                    <div className="h-28 bg-muted">
                      <img src={getImageUrl(cat.imageUrl)} alt={cat.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-28 bg-muted flex items-center justify-center">
                      <UtensilsCrossed className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{cat.name}</span>
                      {!cat.isActive && <Badge variant="secondary">Hidden</Badge>}
                    </div>
                    {cat.description && <p className="text-xs text-muted-foreground line-clamp-2">{cat.description}</p>}
                    <Badge variant="outline">{cat.itemCount} item{cat.itemCount === 1 ? '' : 's'}</Badge>
                    <div className="flex items-center justify-between">
                      <Switch checked={cat.isActive} onCheckedChange={() => toggleActiveMutation.mutate(cat)} />
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(cat)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(cat.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
