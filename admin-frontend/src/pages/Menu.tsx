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
import { Plus, Edit, Trash2, Loader2, Search, UtensilsCrossed, Leaf, Clock, Star, List, LayoutGrid, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';
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
import { ItemVariantsPanel } from '@/components/ItemVariantsPanel';

const SPICE_LEVELS = ['None', 'Mild', 'Medium', 'Hot'] as const;
const SPICE_PEPPER_COUNT: Record<(typeof SPICE_LEVELS)[number], number> = { None: 0, Mild: 1, Medium: 2, Hot: 3 };
const spiceIcon = (level: (typeof SPICE_LEVELS)[number]) => '🌶️'.repeat(SPICE_PEPPER_COUNT[level]);

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
  showVariantsAsRows: boolean;
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
  showVariantsAsRows: boolean;
};

const emptyForm: ItemFormState = {
  categoryId: '', name: '', description: '', basePrice: '', imageUrl: '',
  isVegetarian: false, isVegan: false, isBestSeller: false, isAvailable: true,
  spiceLevel: 'None', displayOrder: '0', preparationTimeMinutes: '15', showVariantsAsRows: false,
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
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleCategory = (id: string) =>
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleItem = (id: string) =>
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'menu-categories'],
    queryFn: () => api.get<MenuCategory[]>('/api/admin/menu-categories'),
  });

  const itemsQuery = useQuery({
    queryKey: ['admin', 'menu-items'],
    queryFn: () => api.get<MenuItem[]>('/api/admin/menu-items'),
  });

  // Once an item has a Variation-type group, its own base price is meaningless - each
  // variant carries its full price. Fetched only while editing so the price field can
  // auto-lock to £0.00 instead of the admin having to remember to type it themselves.
  const editingItemGroupsQuery = useQuery({
    queryKey: ['admin', 'menu-items', editingItem?.id, 'modifier-groups'],
    queryFn: () => api.get<{ groupType: 'Modifier' | 'Variation' }[]>(`/api/admin/menu-items/${editingItem!.id}/modifier-groups`),
    enabled: isDialogOpen && !!editingItem,
  });
  const hasVariationGroup = (editingItemGroupsQuery.data?.data ?? []).some((g) => g.groupType === 'Variation');

  const categories = categoriesQuery.data?.data ?? [];
  const items = itemsQuery.data?.data ?? [];

  const filteredItems = items.filter((item) => {
    if (filterCategory !== 'all' && item.categoryId !== filterCategory) return false;
    if (filterAvailable !== 'all' && String(item.isAvailable) !== filterAvailable) return false;
    if (search.trim() && !item.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const categoryGroups = categories
    .map((cat) => ({ category: cat, items: filteredItems.filter((i) => i.categoryId === cat.id) }))
    .filter((g) => g.items.length > 0);
  const isFiltering = search.trim().length > 0 || filterAvailable !== 'all';

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

  const toggleShowVariantsAsRowsMutation = useMutation({
    mutationFn: ({ item, value }: { item: MenuItem; value: boolean }) =>
      api.put(`/api/admin/menu-items/${item.id}`, toPayload({ ...toFormState(item), showVariantsAsRows: value })),
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
      showVariantsAsRows: item.showVariantsAsRows,
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
      showVariantsAsRows: f.showVariantsAsRows,
    };
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.basePrice || !form.categoryId) {
      toast({ title: 'Validation Error', description: 'Name, price, and category are required.', variant: 'destructive' });
      return;
    }
    const payload = toPayload(hasVariationGroup ? { ...form, basePrice: '0' } : form);
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
                  {hasVariationGroup ? (
                    <div className="h-9 flex items-center px-3 rounded-md border border-input bg-muted text-sm text-muted-foreground">
                      Priced per variant
                    </div>
                  ) : (
                    <Input id="price" type="number" step="0.01" value={form.basePrice}
                      onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                      placeholder="0.00" required disabled={isSubmitting} />
                  )}
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
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items..." className="pl-8" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44 shrink-0"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAvailable} onValueChange={setFilterAvailable}>
          <SelectTrigger className="w-36 shrink-0"><SelectValue placeholder="All Items" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="true">Available</SelectItem>
            <SelectItem value="false">Unavailable</SelectItem>
          </SelectContent>
        </Select>
        {(search || filterCategory !== 'all' || filterAvailable !== 'all') && (
          <Button variant="ghost" size="icon" onClick={() => { setSearch(''); setFilterCategory('all'); setFilterAvailable('all'); }} aria-label="Clear filters">
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
        )}
      </div>

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 gap-4">
            <UtensilsCrossed className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {items.length === 0 ? 'No menu items yet. Add your first item to get started.' : 'No items match the selected filters.'}
            </p>
          </CardContent>
        </Card>
      ) : view === 'list' ? (
        <div className="space-y-2">
          {categoryGroups.map(({ category, items: catItems }) => {
            const isOpen = isFiltering || expandedCategories.has(category.id);
            return (
              <Card key={category.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2 font-medium">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    {category.name}
                  </span>
                  <Badge variant="outline">{catItems.length} item{catItems.length === 1 ? '' : 's'}</Badge>
                </button>

                {isOpen && (
                  <CardContent className="p-0 divide-y border-t">
                    {catItems.map((item) => (
                      <div key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggleItem(item.id)}
                          className="w-full flex items-center justify-between gap-3 py-2 px-4 hover:bg-muted/30 text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {expandedItems.has(item.id) ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                            {item.imageUrl ? (
                              <img src={getImageUrl(item.imageUrl)} alt={item.name} className="w-9 h-9 rounded object-cover shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded bg-muted flex items-center justify-center shrink-0">
                                <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <span className="font-medium truncate">{item.name}</span>
                            {item.isBestSeller && <Badge variant="default" className="gap-1 bg-amber-500 hover:bg-amber-600 shrink-0"><Star className="w-3 h-3 fill-white" /></Badge>}
                            {item.spiceLevel !== 'None' && <span className="shrink-0" title={item.spiceLevel}>{spiceIcon(item.spiceLevel)}</span>}
                            {!item.isAvailable && <Badge variant="secondary" className="shrink-0">Unavailable</Badge>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className="text-primary font-semibold whitespace-nowrap">{currency}{item.basePrice.toFixed(2)}</span>
                            <Switch checked={item.isAvailable} onCheckedChange={() => toggleAvailableMutation.mutate(item)} />
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteItemId(item.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </button>
                        {expandedItems.has(item.id) && (
                          <div className="px-4 pb-3 pl-11">
                            <ItemVariantsPanel
                              itemId={item.id}
                              showVariantsAsRows={item.showVariantsAsRows}
                              onToggleShowVariantsAsRows={(v) => toggleShowVariantsAsRowsMutation.mutate({ item, value: v })}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
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
                  {item.spiceLevel !== 'None' && <Badge variant="secondary">{spiceIcon(item.spiceLevel)} {item.spiceLevel}</Badge>}
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
                <Button variant="ghost" size="sm" className="w-full" onClick={() => toggleItem(item.id)}>
                  {expandedItems.has(item.id) ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
                  Options
                </Button>
                {expandedItems.has(item.id) && (
                  <ItemVariantsPanel
                    itemId={item.id}
                    showVariantsAsRows={item.showVariantsAsRows}
                    onToggleShowVariantsAsRows={(v) => toggleShowVariantsAsRowsMutation.mutate({ item, value: v })}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
