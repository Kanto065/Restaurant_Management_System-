import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, Filter, UtensilsCrossed, Leaf, Clock, Star } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { getImageUrl } from '@/config/api';
import { useCurrency } from '@/hooks/useCurrency';
import { ImageUploadField } from '@/components/ImageUploadField';

const SPICE_LEVELS = ['None', 'Mild', 'Medium', 'Hot', 'ExtraHot'] as const;

interface MenuCategory {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  isVegetarian: boolean;
  isVegan: boolean;
  isBestSeller: boolean;
  spiceLevel: (typeof SPICE_LEVELS)[number];
  isAvailable: boolean;
  displayOrder: number;
  preparationTimeMinutes: number;
}

type ItemFormState = {
  categoryId: string;
  name: string;
  description: string;
  basePrice: string;
  imageUrl: string;
  isVegetarian: boolean;
  isVegan: boolean;
  isBestSeller: boolean;
  isAvailable: boolean;
  spiceLevel: (typeof SPICE_LEVELS)[number];
  displayOrder: string;
  preparationTimeMinutes: string;
};

const emptyForm: ItemFormState = {
  categoryId: '', name: '', description: '', basePrice: '', imageUrl: '',
  isVegetarian: false, isVegan: false, isBestSeller: false, isAvailable: true,
  spiceLevel: 'None', displayOrder: '0', preparationTimeMinutes: '15',
};

const Menu = () => {
  const { toast } = useToast();
  const currency = useCurrency();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(emptyForm);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAvailable, setFilterAvailable] = useState<string>('all');

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'menu-categories'],
    queryFn: () => api.get<MenuCategory[]>('/api/admin/menu-categories'),
  });

  const itemsQuery = useQuery({
    queryKey: ['admin', 'menu-items'],
    queryFn: () => api.get<MenuItem[]>('/api/admin/menu-items'),
  });

  const categories = categoriesQuery.data?.data ?? [];
  const items = itemsQuery.data?.data ?? [];

  const filteredItems = items.filter((item) => {
    if (filterCategory !== 'all' && item.categoryId !== filterCategory) return false;
    if (filterAvailable !== 'all' && String(item.isAvailable) !== filterAvailable) return false;
    return true;
  });

  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: ['admin', 'menu-items'] });

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => api.post('/api/admin/menu-items', payload),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Menu item created.' });
      invalidateItems();
      resetForm();
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) => api.put(`/api/admin/menu-items/${id}`, payload),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Menu item updated.' });
      invalidateItems();
      resetForm();
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/menu-items/${id}`),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Menu item deleted.' });
      invalidateItems();
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    onSettled: () => setDeleteItemId(null),
  });

  const toggleAvailableMutation = useMutation({
    mutationFn: (item: MenuItem) => api.put(`/api/admin/menu-items/${item.id}`, toPayload({ ...toFormState(item), isAvailable: !item.isAvailable })),
    onSuccess: invalidateItems,
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  function toFormState(item: MenuItem): ItemFormState {
    return {
      categoryId: item.categoryId, name: item.name, description: item.description ?? '',
      basePrice: item.basePrice.toString(), imageUrl: item.imageUrl ?? '',
      isVegetarian: item.isVegetarian, isVegan: item.isVegan, isBestSeller: item.isBestSeller,
      isAvailable: item.isAvailable, spiceLevel: item.spiceLevel,
      displayOrder: item.displayOrder.toString(), preparationTimeMinutes: item.preparationTimeMinutes.toString(),
    };
  }

  function toPayload(f: ItemFormState) {
    return {
      categoryId: f.categoryId,
      name: f.name,
      description: f.description || null,
      basePrice: parseFloat(f.basePrice) || 0,
      imageUrl: f.imageUrl || null,
      isVegetarian: f.isVegetarian,
      isVegan: f.isVegan,
      isBestSeller: f.isBestSeller,
      isAvailable: f.isAvailable,
      spiceLevel: f.spiceLevel,
      displayOrder: parseInt(f.displayOrder, 10) || 0,
      preparationTimeMinutes: parseInt(f.preparationTimeMinutes, 10) || 0,
    };
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.basePrice || !form.categoryId) {
      toast({ title: 'Validation Error', description: 'Name, price, and category are required.', variant: 'destructive' });
      return;
    }
    const payload = toPayload(form);
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setForm(toFormState(item));
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingItem(null);
    setIsDialogOpen(false);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (itemsQuery.isLoading || categoriesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading menu items...</p>
        </div>
      </div>
    );
  }

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Items</h1>
          <p className="text-muted-foreground">Manage your restaurant menu</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsDialogOpen(true) : resetForm())}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingItem(null); setForm(emptyForm); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</DialogTitle>
              <DialogDescription>{editingItem ? 'Update item details' : 'Create a new menu item'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Chicken Tikka Masala" required disabled={isSubmitting} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the dish" rows={3} disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price ({currency}) *</Label>
                  <Input id="price" type="number" step="0.01" value={form.basePrice}
                    onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                    placeholder="0.00" required disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <ImageUploadField
                label="Item Image"
                value={form.imageUrl}
                onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preparationTime">Prep Time (minutes)</Label>
                  <Input id="preparationTime" type="number" min="0" value={form.preparationTimeMinutes}
                    onChange={(e) => setForm((f) => ({ ...f, preparationTimeMinutes: e.target.value }))} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spiceLevel">Spice Level</Label>
                  <Select value={form.spiceLevel} onValueChange={(v) => setForm((f) => ({ ...f, spiceLevel: v as ItemFormState['spiceLevel'] }))} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SPICE_LEVELS.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                {([
                  ['isVegetarian', 'Vegetarian', 'Mark if this item is vegetarian'],
                  ['isVegan', 'Vegan', 'Mark if this item is vegan'],
                  ['isBestSeller', 'Best Seller', 'Shown in the storefront’s Best Sellers filter'],
                  ['isAvailable', 'Available', 'Mark if this item is currently available'],
                ] as const).map(([key, label, hint]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor={key}>{label}</Label>
                      <p className="text-xs text-muted-foreground">{hint}</p>
                    </div>
                    <Switch id={key} checked={form[key]} onCheckedChange={(v) => setForm((f) => ({ ...f, [key]: v }))} disabled={isSubmitting} />
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{editingItem ? 'Updating...' : 'Creating...'}</>
                  ) : editingItem ? 'Update Item' : 'Create Item'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Filter className="w-5 h-5" />Filters</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { setFilterCategory('all'); setFilterAvailable('all'); }}>
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Availability</Label>
              <Select value={filterAvailable} onValueChange={setFilterAvailable}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="true">Available</SelectItem>
                  <SelectItem value="false">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredItems.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center h-40 gap-4">
              <UtensilsCrossed className="w-12 h-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                {items.length === 0 ? 'No menu items yet. Add your first item to get started.' : 'No items match the selected filters.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              {item.imageUrl ? (
                <div className="h-48 overflow-hidden bg-muted relative">
                  <img src={getImageUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover" />
                  {!item.isAvailable && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Badge variant="secondary" className="text-lg">Unavailable</Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-48 bg-muted flex items-center justify-center">
                  <UtensilsCrossed className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <span className="text-primary font-bold whitespace-nowrap">{currency}{item.basePrice.toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{categoryName(item.categoryId)}</Badge>
                  {item.isBestSeller && (
                    <Badge variant="default" className="gap-1 bg-amber-500 hover:bg-amber-600">
                      <Star className="w-3 h-3 fill-white" />Best Seller
                    </Badge>
                  )}
                  {item.isVegan && <Badge variant="secondary" className="gap-1"><Leaf className="w-3 h-3" />Vegan</Badge>}
                  {item.isVegetarian && !item.isVegan && <Badge variant="secondary" className="gap-1"><Leaf className="w-3 h-3" />Veg</Badge>}
                  {item.preparationTimeMinutes > 0 && (
                    <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />{item.preparationTimeMinutes}m</Badge>
                  )}
                  {item.spiceLevel !== 'None' && <Badge variant="secondary">{item.spiceLevel}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">{item.description || 'No description'}</p>

                <div className="flex items-center gap-2">
                  <Switch checked={item.isAvailable} onCheckedChange={() => toggleAvailableMutation.mutate(item)} />
                  <span className="text-sm text-muted-foreground">{item.isAvailable ? 'Available' : 'Unavailable'}</span>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(item)}>
                    <Edit className="w-4 h-4 mr-2" />Edit
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setDeleteItemId(item.id)}>
                    <Trash2 className="w-4 h-4 mr-2" />Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the menu item.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteItemId && deleteMutation.mutate(deleteItemId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Menu;
