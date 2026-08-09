import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, Lock, ChevronRight, Loader2, X, Image as ImageIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { API_BASE_URL, getImageUrl } from '@/config/api';

interface Address {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

interface Restaurant {
  _id: string;
  name: string;
  description?: string;
  phone?: string;
  email?: string;
  logo?: string | null;
  address?: Address;
  openingHours?: Record<string, any>;
}

const RestaurantSettings = () => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDeletingLogo, setIsDeletingLogo] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('');
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch restaurant data
  useEffect(() => {
    fetchRestaurant();
  }, []);

  const fetchRestaurant = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<{ restaurant: Restaurant }>('/api/restaurant');
      
      if (response.success && response.data) {
        const restaurantData = response.data.restaurant;
        setRestaurant(restaurantData);
        
        // Populate form fields
        setName(restaurantData.name || '');
        setDescription(restaurantData.description || '');
        setPhone(restaurantData.phone || '');
        setEmail(restaurantData.email || '');
        setStreet(restaurantData.address?.street || '');
        setCity(restaurantData.address?.city || '');
        setState(restaurantData.address?.state || '');
        setZipCode(restaurantData.address?.zipCode || '');
        setCountry(restaurantData.address?.country || '');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch restaurant data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const updateData = {
        name,
        description,
        phone,
        email,
        address: {
          street,
          city,
          state,
          zipCode,
          country,
        },
        openingHours: restaurant?.openingHours || {},
      };

      const response = await api.put('/api/restaurant', updateData);
      
      if (response.success) {
        toast({
          title: 'Success',
          description: response.message || 'Restaurant information updated successfully',
        });
        
        // Refresh data
        await fetchRestaurant();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update restaurant information',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUploadingLogo(true);
      
      const formData = new FormData();
      formData.append('logo', file);

      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE_URL}/api/restaurant/logo`, {
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
          description: result.message || 'Logo uploaded successfully',
        });
        
        // Refresh data
        await fetchRestaurant();
      } else {
        throw new Error(result.message || 'Failed to upload logo');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload logo',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingLogo(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleDeleteLogo = async () => {
    if (!restaurant?.logo) return;

    try {
      setIsDeletingLogo(true);
      
      const response = await api.delete('/api/restaurant/logo');
      
      if (response.success) {
        toast({
          title: 'Success',
          description: response.message || 'Logo deleted successfully',
        });
        
        // Refresh data
        await fetchRestaurant();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete logo',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingLogo(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading restaurant data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Restaurant Settings</h1>
        <p className="text-muted-foreground">Manage your restaurant information</p>
      </div>

      {/* Logo Section */}
      <Card>
        <CardHeader>
          <CardTitle>Restaurant Logo</CardTitle>
          <CardDescription>Upload and manage your restaurant logo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            {restaurant?.logo ? (
              <div className="relative">
                <div className="w-32 h-32 border rounded-lg overflow-hidden bg-muted">
                  <img
                    src={getImageUrl(restaurant.logo)}
                    alt="Restaurant Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
                  onClick={handleDeleteLogo}
                  disabled={isDeletingLogo}
                >
                  {isDeletingLogo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : (
              <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                <ImageIcon className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            
            <div className="flex-1">
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col items-center gap-2">
                    {isUploadingLogo ? (
                      <>
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <div className="text-sm text-muted-foreground">Uploading...</div>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <div className="text-sm text-muted-foreground text-center">
                          Click to upload logo
                          <br />
                          <span className="text-xs">PNG, JPG, SVG up to 5MB</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                  disabled={isUploadingLogo}
                />
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* General Information */}
      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>Update your restaurant's basic details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Restaurant Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter restaurant name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="restaurant@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your restaurant..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Address Information */}
      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
          <CardDescription>Your restaurant's location details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="street">Street Address</Label>
            <Input
              id="street"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="123 Main Street"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="New York"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State/Province</Label>
              <Input
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="NY"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP/Postal Code</Label>
              <Input
                id="zipCode"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="10001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="United States"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg" disabled={isSaving || !name}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Manage your account security settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" 
            onClick={() => navigate('/dashboard/change-password')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Change Password</h3>
                <p className="text-sm text-muted-foreground">Update your account password</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RestaurantSettings;