import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Upload, Loader2, X, Filter, UtensilsCrossed, Leaf, Clock, Star } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { getImageUrl } from '@/config/api';
import { API_BASE_URL } from '@/config/api';

const CATEGORIES = ['Appetizer', 'Main Course', 'Dessert', 'Beverage', 'Snack', 'Other'];
const SPICE_LEVELS = ['None', 'Mild', 'Medium', 'Hot', 'Extra Hot'];

interface FoodItem {
  _id: string;
  restaurant: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: string;
  isVegetarian: boolean;
  isAvailable: boolean;
  isBadge: boolean;
  preparationTime: number;
  spiceLevel: string;
  createdAt: string;
  updatedAt: string;
}

const Menu = () => {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [filteredFoods, setFilteredFoods] = useState<FoodItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAvailable, setFilterAvailable] = useState<string>('all');
  const [filterVegetarian, setFilterVegetarian] = useState<string>('all');
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [isVegetarian, setIsVegetarian] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isBadge, setIsBadge] = useState(false);
  const [preparationTime, setPreparationTime] = useState('');
  const [spiceLevel, setSpiceLevel] = useState('None');
  
  const { toast } = useToast();

  useEffect(() => {
    fetchFoods();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [foods, filterCategory, filterAvailable, filterVegetarian]);

  const fetchFoods = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<{ foods: FoodItem[]; count: number }>('/api/foods');
      
      if (response.success && response.data) {
        setFoods(response.data.foods);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch menu items',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...foods];

    if (filterCategory !== 'all') {
      filtered = filtered.filter(food => food.category === filterCategory);
    }

    if (filterAvailable !== 'all') {
      filtered = filtered.filter(food => food.isAvailable === (filterAvailable === 'true'));
    }

    if (filterVegetarian !== 'all') {
      filtered = filtered.filter(food => food.isVegetarian === (filterVegetarian === 'true'));
    }

    setFilteredFoods(filtered);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setImageFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !price || !category) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('price', price);
      formData.append('category', category);
      formData.append('isVegetarian', isVegetarian.toString());
      formData.append('isAvailable', isAvailable.toString());
      formData.append('isBadge', isBadge.toString());
      formData.append('preparationTime', preparationTime || '0');
      formData.append('spiceLevel', spiceLevel);
      
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const token = localStorage.getItem('admin_token');

      if (editingItem) {
        const response = await fetch(`${API_BASE_URL}/api/foods/${editingItem._id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        const result = await response.json();

        if (response.ok && result.success) {
          toast({
            title: 'Success',
            description: result.message || 'Menu item updated successfully',
          });
          await fetchFoods();
          resetForm();
        } else {
          throw new Error(result.message || 'Failed to update menu item');
        }
      } else {
        const response = await fetch(`${API_BASE_URL}/api/foods`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        const result = await response.json();

        if (response.ok && result.success) {
          toast({
            title: 'Success',
            description: result.message || 'Menu item created successfully',
          });
          await fetchFoods();
          resetForm();
        } else {
          throw new Error(result.message || 'Failed to create menu item');
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${editingItem ? 'update' : 'create'} menu item`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item: FoodItem) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description);
    setPrice(item.price.toString());
    setCategory(item.category);
    setIsVegetarian(item.isVegetarian);
    setIsAvailable(item.isAvailable);
    setIsBadge(item.isBadge);
    setPreparationTime(item.preparationTime.toString());
    setSpiceLevel(item.spiceLevel);
    setImagePreview(getImageUrl(item.image));
    setImageFile(null);
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteItemId) return;

    try {
      const response = await api.delete(`/api/foods/${deleteItemId}`);
      
      if (response.success) {
        toast({
          title: 'Success',
          description: response.message || 'Menu item deleted successfully',
        });
        await fetchFoods();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete menu item',
        variant: 'destructive',
      });
    } finally {
      setDeleteItemId(null);
    }
  };

  const handleToggleAvailable = async (item: FoodItem) => {
    try {
      const formData = new FormData();
      formData.append('name', item.name);
      formData.append('description', item.description);
      formData.append('price', item.price.toString());
      formData.append('category', item.category);
      formData.append('isVegetarian', item.isVegetarian.toString());
      formData.append('isAvailable', (!item.isAvailable).toString());
      formData.append('isBadge', item.isBadge.toString());
      formData.append('preparationTime', item.preparationTime.toString());
      formData.append('spiceLevel', item.spiceLevel);

      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE_URL}/api/foods/${item._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: 'Success',
          description: `Item ${!item.isAvailable ? 'marked as available' : 'marked as unavailable'}`,
        });
        await fetchFoods();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update availability',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setCategory('');
    setIsVegetarian(false);
    setIsAvailable(true);
    setIsBadge(false);
    setPreparationTime('');
    setSpiceLevel('None');
    setImageFile(null);
    setImagePreview('');
    setEditingItem(null);
    setIsDialogOpen(false);
  };

  const clearFilters = () => {
    setFilterCategory('all');
    setFilterAvailable('all');
    setFilterVegetarian('all');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading menu items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Items</h1>
          <p className="text-muted-foreground">Manage your restaurant menu</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</DialogTitle>
              <DialogDescription>
                {editingItem ? 'Update item details' : 'Create a new menu item'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Margherita Pizza"
                  required
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the dish"
                  rows={3}
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={category} onValueChange={setCategory} disabled={isSubmitting} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preparationTime">Prep Time (minutes)</Label>
                  <Input
                    id="preparationTime"
                    type="number"
                    value={preparationTime}
                    onChange={(e) => setPreparationTime(e.target.value)}
                    placeholder="0"
                    min="0"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spiceLevel">Spice Level</Label>
                  <Select value={spiceLevel} onValueChange={setSpiceLevel} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPICE_LEVELS.map(level => (
                        <SelectItem key={level} value={level}>{level}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="isVegetarian">Vegetarian</Label>
                    <p className="text-xs text-muted-foreground">Mark if this item is vegetarian</p>
                  </div>
                  <Switch
                    id="isVegetarian"
                    checked={isVegetarian}
                    onCheckedChange={setIsVegetarian}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="isAvailable">Available</Label>
                    <p className="text-xs text-muted-foreground">Mark if this item is currently available</p>
                  </div>
                  <Switch
                    id="isAvailable"
                    checked={isAvailable}
                    onCheckedChange={setIsAvailable}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="isBadge">Featured Badge</Label>
                    <p className="text-xs text-muted-foreground">Show a "Featured" badge on this item</p>
                  </div>
                  <Switch
                    id="isBadge"
                    checked={isBadge}
                    onCheckedChange={setIsBadge}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Image</Label>
                {imagePreview && (
                  <div className="relative w-full h-48 border rounded-lg overflow-hidden bg-muted">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={() => {
                        setImagePreview('');
                        setImageFile(null);
                      }}
                      disabled={isSubmitting}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <label htmlFor="image-upload" className="cursor-pointer">
                  <div className="border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground text-center">
                        Click to upload image
                        <br />
                        <span className="text-xs">PNG, JPG up to 5MB</span>
                      </div>
                    </div>
                  </div>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isSubmitting}
                  />
                </label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingItem ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editingItem ? 'Update Item' : 'Create Item'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Availability</Label>
              <Select value={filterAvailable} onValueChange={setFilterAvailable}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="true">Available</SelectItem>
                  <SelectItem value="false">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Vegetarian</Label>
              <Select value={filterVegetarian} onValueChange={setFilterVegetarian}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="true">Vegetarian</SelectItem>
                  <SelectItem value="false">Non-Vegetarian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu Items Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredFoods.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center h-40 gap-4">
              <UtensilsCrossed className="w-12 h-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                {foods.length === 0 
                  ? 'No menu items yet. Add your first item to get started.'
                  : 'No items match the selected filters.'
                }
              </p>
              {foods.length === 0 && (
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredFoods.map((item) => (
            <Card key={item._id} className="overflow-hidden">
              {item.image ? (
                <div className="h-48 overflow-hidden bg-muted relative">
                  <img
                    src={getImageUrl(item.image)}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
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
                  <span className="text-primary font-bold whitespace-nowrap">${item.price.toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{item.category}</Badge>
                  {item.isBadge && (
                    <Badge variant="default" className="gap-1 bg-amber-500 hover:bg-amber-600">
                      <Star className="w-3 h-3 fill-white" />
                      Featured
                    </Badge>
                  )}
                  {item.isVegetarian && (
                    <Badge variant="secondary" className="gap-1">
                      <Leaf className="w-3 h-3" />
                      Veg
                    </Badge>
                  )}
                  {item.preparationTime > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="w-3 h-3" />
                      {item.preparationTime}m
                    </Badge>
                  )}
                  {item.spiceLevel !== 'None' && (
                    <Badge variant="secondary">🌶️ {item.spiceLevel}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {item.description || 'No description'}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.isAvailable}
                      onCheckedChange={() => handleToggleAvailable(item)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {item.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(item)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setDeleteItemId(item._id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the menu item.
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

export default Menu;
