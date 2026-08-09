import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, GripVertical, ChevronRight, BookOpen, Clock, Calendar, UtensilsCrossed, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '@/config/api';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

interface FoodItem {
  _id: string;
  name: string;
  price: number;
  image?: string;
  category: string;
  isAvailable: boolean;
  isBadge: boolean;
  preparationTime?: number;
  spiceLevel?: string;
}

interface Menu {
  _id: string;
  restaurant: string;
  name: string;
  description: string;
  foods: FoodItem[];
  isActive: boolean;
  displayOrder: number;
  availableFrom: string;
  availableTo: string;
  availableDays: string[];
  createdAt: string;
  updatedAt: string;
}

const Menus = () => {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [allFoods, setAllFoods] = useState<FoodItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFoodDialogOpen, setIsFoodDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);
  const [selectedMenuForFoods, setSelectedMenuForFoods] = useState<Menu | null>(null);
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([]);
  const [filterActive, setFilterActive] = useState<string>('all');
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFoods, setSelectedFoods] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [availableFrom, setAvailableFrom] = useState('00:00');
  const [availableTo, setAvailableTo] = useState('23:59');
  const [availableDays, setAvailableDays] = useState<string[]>(DAYS_OF_WEEK);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMenus();
    fetchAllFoods();
  }, [filterActive]);

  const fetchMenus = async () => {
    try {
      setIsLoading(true);
      let url = '/api/menus';
      if (filterActive === 'active') url += '?isActive=true';
      if (filterActive === 'inactive') url += '?isActive=false';
      
      const response = await api.get<{ menus: Menu[]; count: number }>(url);
      if (response.success && response.data) {
        const sortedMenus = response.data.menus.sort((a, b) => a.displayOrder - b.displayOrder);
        setMenus(sortedMenus);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch menus',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllFoods = async () => {
    try {
      const response = await api.get<{ foods: FoodItem[]; count: number }>('/api/foods');
      if (response.success && response.data) {
        setAllFoods(response.data.foods);
      }
    } catch (error: any) {
      console.error('Error fetching foods:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || selectedFoods.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a name and select at least one food item',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const menuData = {
        name,
        description,
        foods: selectedFoods,
        isActive,
        availableFrom,
        availableTo,
        availableDays,
      };

      if (editingMenu) {
        const response = await api.put<{ menu: Menu }>(`/api/menus/${editingMenu._id}`, menuData);
        if (response.success) {
          toast({
            title: 'Success',
            description: 'Menu updated successfully',
          });
          await fetchMenus();
          resetForm();
        }
      } else {
        const response = await api.post<{ menu: Menu }>('/api/menus', {
          ...menuData,
          displayOrder: menus.length,
        });
        if (response.success) {
          toast({
            title: 'Success',
            description: 'Menu created successfully',
          });
          await fetchMenus();
          resetForm();
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${editingMenu ? 'update' : 'create'} menu`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (menu: Menu) => {
    setEditingMenu(menu);
    setName(menu.name);
    setDescription(menu.description);
    setSelectedFoods(menu.foods.map(f => f._id));
    setIsActive(menu.isActive);
    setAvailableFrom(menu.availableFrom);
    setAvailableTo(menu.availableTo);
    setAvailableDays(menu.availableDays);
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteMenuId) return;

    try {
      const response = await api.delete(`/api/menus/${deleteMenuId}`);
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Menu deleted successfully',
        });
        await fetchMenus();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete menu',
        variant: 'destructive',
      });
    } finally {
      setDeleteMenuId(null);
    }
  };

  const handleToggleActive = async (menu: Menu) => {
    try {
      const response = await api.put<{ menu: Menu }>(`/api/menus/${menu._id}`, {
        isActive: !menu.isActive,
      });
      if (response.success) {
        toast({
          title: 'Success',
          description: `Menu ${!menu.isActive ? 'activated' : 'deactivated'} successfully`,
        });
        await fetchMenus();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update menu status',
        variant: 'destructive',
      });
    }
  };

  const handleMoveMenu = async (menuId: string, direction: 'up' | 'down') => {
    const currentIndex = menus.findIndex(m => m._id === menuId);
    if (currentIndex === -1) return;
    
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === menus.length - 1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newMenus = [...menus];
    [newMenus[currentIndex], newMenus[newIndex]] = [newMenus[newIndex], newMenus[currentIndex]];

    const menuOrders = newMenus.map((menu, index) => ({
      menuId: menu._id,
      displayOrder: index,
    }));

    try {
      const response = await api.put('/api/menus/update-order', { menuOrders });
      if (response.success) {
        setMenus(newMenus);
        toast({
          title: 'Success',
          description: 'Menu order updated successfully',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update menu order',
        variant: 'destructive',
      });
    }
  };

  const openManageFoodsDialog = (menu: Menu) => {
    setSelectedMenuForFoods(menu);
    setSelectedFoodIds([]);
    setIsFoodDialogOpen(true);
  };

  const handleAddFoods = async () => {
    if (!selectedMenuForFoods || selectedFoodIds.length === 0) return;

    try {
      setIsSubmitting(true);
      const response = await api.post<{ menu: Menu }>(`/api/menus/${selectedMenuForFoods._id}/foods`, {
        foodIds: selectedFoodIds,
      });
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Foods added to menu successfully',
        });
        await fetchMenus();
        setIsFoodDialogOpen(false);
        setSelectedFoodIds([]);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add foods to menu',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveFood = async (menuId: string, foodId: string) => {
    try {
      const response = await api.delete<{ menu: Menu }>(`/api/menus/${menuId}/foods`, {
        foodIds: [foodId],
      });
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Food removed from menu successfully',
        });
        await fetchMenus();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove food from menu',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedFoods([]);
    setIsActive(true);
    setAvailableFrom('00:00');
    setAvailableTo('23:59');
    setAvailableDays(DAYS_OF_WEEK);
    setEditingMenu(null);
    setIsDialogOpen(false);
  };

  const toggleDay = (day: string) => {
    setAvailableDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleFood = (foodId: string) => {
    setSelectedFoods(prev =>
      prev.includes(foodId) ? prev.filter(id => id !== foodId) : [...prev, foodId]
    );
  };

  const getAvailableFoodsForMenu = (menu: Menu) => {
    const menuFoodIds = menu.foods.map(f => f._id);
    return allFoods.filter(f => !menuFoodIds.includes(f._id));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading menus...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Management</h1>
          <p className="text-muted-foreground">Create and manage your restaurant menus</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Menu
        </Button>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={filterActive === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterActive('all')}
            >
              All Menus
            </Button>
            <Button
              variant={filterActive === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterActive('active')}
            >
              Active
            </Button>
            <Button
              variant={filterActive === 'inactive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterActive('inactive')}
            >
              Inactive
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Menus List */}
      {menus.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium mb-1">No menus yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first menu to get started</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Menu
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {menus.map((menu, index) => (
            <Card key={menu._id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Drag Handle */}
                  <div className="flex flex-col gap-1 pt-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleMoveMenu(menu._id, 'up')}
                      disabled={index === 0}
                    >
                      <GripVertical className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleMoveMenu(menu._id, 'down')}
                      disabled={index === menus.length - 1}
                    >
                      <GripVertical className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Menu Content */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold">{menu.name}</h3>
                          <Badge variant={menu.isActive ? 'default' : 'secondary'}>
                            {menu.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline">{menu.foods.length} items</Badge>
                        </div>
                        {menu.description && (
                          <p className="text-sm text-muted-foreground">{menu.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={menu.isActive}
                          onCheckedChange={() => handleToggleActive(menu)}
                        />
                      </div>
                    </div>

                    {/* Menu Details */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{menu.availableFrom} - {menu.availableTo}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{menu.availableDays.length === 7 ? 'All days' : `${menu.availableDays.length} days`}</span>
                      </div>
                    </div>

                    {/* Food Items Preview */}
                    {menu.foods.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {menu.foods.slice(0, 5).map((food) => (
                          <div
                            key={food._id}
                            className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm"
                          >
                            {food.image ? (
                              <img
                                src={getImageUrl(food.image)}
                                alt={food.name}
                                className="h-6 w-6 rounded object-cover"
                              />
                            ) : (
                              <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span>{food.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 ml-1"
                              onClick={() => handleRemoveFood(menu._id, food._id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        {menu.foods.length > 5 && (
                          <Badge variant="outline">+{menu.foods.length - 5} more</Badge>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openManageFoodsDialog(menu)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Foods
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(menu)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteMenuId(menu._id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Menu Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingMenu ? 'Edit Menu' : 'Create New Menu'}</DialogTitle>
            <DialogDescription>
              {editingMenu ? 'Update your menu details' : 'Create a new menu for your restaurant'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="max-h-[60vh] overflow-y-auto pr-4">
              <div className="space-y-4 pb-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Menu Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Breakfast Menu, Lunch Specials"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this menu"
                    rows={3}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Available Time</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="from" className="text-xs text-muted-foreground">From</Label>
                      <Input
                        id="from"
                        type="time"
                        value={availableFrom}
                        onChange={(e) => setAvailableFrom(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="to" className="text-xs text-muted-foreground">To</Label>
                      <Input
                        id="to"
                        type="time"
                        value={availableTo}
                        onChange={(e) => setAvailableTo(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Available Days</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={day}
                          checked={availableDays.includes(day)}
                          onCheckedChange={() => toggleDay(day)}
                          disabled={isSubmitting}
                        />
                        <Label
                          htmlFor={day}
                          className="text-sm font-normal capitalize cursor-pointer"
                        >
                          {day}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Select Food Items *</Label>
                  {allFoods.length === 0 ? (
                    <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
                      No food items available. Please add food items first.
                    </div>
                  ) : (
                    <>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[200px] overflow-y-auto p-4">
                          <div className="space-y-2">
                            {allFoods.map((food) => (
                              <div
                                key={food._id}
                                className="flex items-center space-x-2 p-2 hover:bg-muted rounded-lg"
                              >
                                <Checkbox
                                  id={`food-${food._id}`}
                                  checked={selectedFoods.includes(food._id)}
                                  onCheckedChange={() => toggleFood(food._id)}
                                  disabled={isSubmitting}
                                />
                                <Label
                                  htmlFor={`food-${food._id}`}
                                  className="flex items-center gap-2 flex-1 cursor-pointer"
                                >
                                  {food.image && (
                                    <img
                                      src={getImageUrl(food.image)}
                                      alt={food.name}
                                      className="h-8 w-8 rounded object-cover"
                                    />
                                  )}
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">{food.name}</p>
                                    <p className="text-xs text-muted-foreground">${food.price}</p>
                                  </div>
                                  <Badge variant="outline" className="text-xs">{food.category}</Badge>
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedFoods.length} item{selectedFoods.length !== 1 ? 's' : ''} selected
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="active">Active Status</Label>
                    <p className="text-xs text-muted-foreground">Make this menu visible to customers</p>
                  </div>
                  <Switch
                    id="active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4 border-t pt-4">
              <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingMenu ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  editingMenu ? 'Update Menu' : 'Create Menu'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Foods Dialog */}
      <Dialog open={isFoodDialogOpen} onOpenChange={setIsFoodDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Foods to {selectedMenuForFoods?.name}</DialogTitle>
            <DialogDescription>Select food items to add to this menu</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {selectedMenuForFoods && getAvailableFoodsForMenu(selectedMenuForFoods).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  All available foods are already in this menu
                </p>
              ) : (
                selectedMenuForFoods && getAvailableFoodsForMenu(selectedMenuForFoods).map((food) => (
                  <div
                    key={food._id}
                    className="flex items-center space-x-2 p-3 hover:bg-muted rounded-lg"
                  >
                    <Checkbox
                      id={`add-food-${food._id}`}
                      checked={selectedFoodIds.includes(food._id)}
                      onCheckedChange={(checked) => {
                        setSelectedFoodIds(prev =>
                          checked ? [...prev, food._id] : prev.filter(id => id !== food._id)
                        );
                      }}
                    />
                    <Label
                      htmlFor={`add-food-${food._id}`}
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                    >
                      {food.image ? (
                        <img
                          src={getImageUrl(food.image)}
                          alt={food.name}
                          className="h-12 w-12 rounded object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                          <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{food.name}</p>
                        <p className="text-sm text-muted-foreground">${food.price} • {food.category}</p>
                      </div>
                      {food.isBadge && (
                        <Badge className="bg-amber-500">Featured</Badge>
                      )}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsFoodDialogOpen(false);
                setSelectedFoodIds([]);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddFoods}
              disabled={isSubmitting || selectedFoodIds.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                `Add ${selectedFoodIds.length} Food${selectedFoodIds.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteMenuId} onOpenChange={() => setDeleteMenuId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this menu. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Menus;
