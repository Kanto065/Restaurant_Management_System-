import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, ChevronRight, Loader2, Image as ImageIcon, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '@/lib/api';
import { getImageUrl } from '@/config/api';
import { currencySymbol } from '@/lib/currency';
import { ImageUploadField } from '@/components/ImageUploadField';

interface HeroSlide {
  imageUrl: string;
  heading: string;
  subheading: string | null;
}

interface HomepageContent {
  heroSlides: HeroSlide[];
  orderOnlineTitle: string | null;
  orderOnlineText: string | null;
  loyaltyTitle: string | null;
  loyaltyText: string | null;
  deliverTitle: string | null;
  deliverText: string | null;
  welcomeTitle: string | null;
  welcomeText: string | null;
}

const emptyHomepageContent: HomepageContent = {
  heroSlides: [],
  orderOnlineTitle: '', orderOnlineText: '',
  loyaltyTitle: '', loyaltyText: '',
  deliverTitle: '', deliverText: '',
  welcomeTitle: '', welcomeText: '',
};

const MAX_HERO_SLIDES = 5;

const CURRENCIES = [
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'AUD', label: 'Australian Dollar ($)' },
  { code: 'CAD', label: 'Canadian Dollar ($)' },
  { code: 'INR', label: 'Indian Rupee (₹)' },
  { code: 'BDT', label: 'Bangladeshi Taka (৳)' },
];

interface RestaurantSettings {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  themeColorPrimary: string;
  themeColorSecondary: string;
  phone: string | null;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postcode: string;
  country: string;
  timeZone: string;
  isActive: boolean;
  supportsDelivery: boolean;
  supportsCollection: boolean;
  supportsDineIn: boolean;
  processingFeeFlat: number;
  processingFeePercentage: number;
  loyaltyPointsPerCurrencyUnit: number;
  currency: string;
  homepageContent: HomepageContent | null;
}

type FormState = Omit<RestaurantSettings, 'id' | 'slug' | 'isActive'>;

const emptyForm: FormState = {
  name: '', description: '', logoUrl: '', heroImageUrl: '', themeColorPrimary: '#0b3d2e',
  themeColorSecondary: '#e8823c', phone: '', email: '', addressLine1: '', addressLine2: '',
  city: '', postcode: '', country: 'GB', timeZone: 'Europe/London',
  supportsDelivery: true, supportsCollection: true, supportsDineIn: true,
  processingFeeFlat: 0, processingFeePercentage: 0, loyaltyPointsPerCurrencyUnit: 1,
  currency: 'GBP', homepageContent: emptyHomepageContent,
};

const RestaurantSettingsPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);

  const restaurantQuery = useQuery({
    queryKey: ['admin', 'restaurant'],
    queryFn: () => api.get<RestaurantSettings>('/api/admin/restaurant'),
  });

  useEffect(() => {
    const r = restaurantQuery.data?.data;
    if (!r) return;
    setForm({
      name: r.name, description: r.description ?? '', logoUrl: r.logoUrl ?? '', heroImageUrl: r.heroImageUrl ?? '',
      themeColorPrimary: r.themeColorPrimary, themeColorSecondary: r.themeColorSecondary,
      phone: r.phone ?? '', email: r.email ?? '', addressLine1: r.addressLine1, addressLine2: r.addressLine2 ?? '',
      city: r.city, postcode: r.postcode, country: r.country, timeZone: r.timeZone,
      supportsDelivery: r.supportsDelivery, supportsCollection: r.supportsCollection, supportsDineIn: r.supportsDineIn,
      processingFeeFlat: r.processingFeeFlat, processingFeePercentage: r.processingFeePercentage,
      loyaltyPointsPerCurrencyUnit: r.loyaltyPointsPerCurrencyUnit,
      currency: r.currency,
      homepageContent: r.homepageContent
        ? {
            heroSlides: r.homepageContent.heroSlides ?? [],
            orderOnlineTitle: r.homepageContent.orderOnlineTitle ?? '',
            orderOnlineText: r.homepageContent.orderOnlineText ?? '',
            loyaltyTitle: r.homepageContent.loyaltyTitle ?? '',
            loyaltyText: r.homepageContent.loyaltyText ?? '',
            deliverTitle: r.homepageContent.deliverTitle ?? '',
            deliverText: r.homepageContent.deliverText ?? '',
            welcomeTitle: r.homepageContent.welcomeTitle ?? '',
            welcomeText: r.homepageContent.welcomeText ?? '',
          }
        : emptyHomepageContent,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => api.put('/api/admin/restaurant', {
      ...form,
      description: form.description || null,
      logoUrl: form.logoUrl || null,
      heroImageUrl: form.heroImageUrl || null,
      phone: form.phone || null,
      email: form.email || null,
      addressLine2: form.addressLine2 || null,
      homepageContent: {
        heroSlides: (form.homepageContent?.heroSlides ?? [])
          .filter((s) => s.imageUrl && s.heading)
          .map((s) => ({ ...s, subheading: s.subheading || null })),
        orderOnlineTitle: form.homepageContent?.orderOnlineTitle || null,
        orderOnlineText: form.homepageContent?.orderOnlineText || null,
        loyaltyTitle: form.homepageContent?.loyaltyTitle || null,
        loyaltyText: form.homepageContent?.loyaltyText || null,
        deliverTitle: form.homepageContent?.deliverTitle || null,
        deliverText: form.homepageContent?.deliverText || null,
        welcomeTitle: form.homepageContent?.welcomeTitle || null,
        welcomeText: form.homepageContent?.welcomeText || null,
      },
    }),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Restaurant information updated.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurant'] });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const setHomepage = <K extends keyof HomepageContent>(key: K, value: HomepageContent[K]) =>
    setForm((f) => ({ ...f, homepageContent: { ...(f.homepageContent ?? emptyHomepageContent), [key]: value } }));

  const addHeroSlide = () =>
    setForm((f) => {
      const content = f.homepageContent ?? emptyHomepageContent;
      if (content.heroSlides.length >= MAX_HERO_SLIDES) return f;
      return { ...f, homepageContent: { ...content, heroSlides: [...content.heroSlides, { imageUrl: '', heading: '', subheading: '' }] } };
    });

  const updateHeroSlide = (index: number, patch: Partial<HeroSlide>) =>
    setForm((f) => {
      const content = f.homepageContent ?? emptyHomepageContent;
      const heroSlides = content.heroSlides.map((s, i) => (i === index ? { ...s, ...patch } : s));
      return { ...f, homepageContent: { ...content, heroSlides } };
    });

  const removeHeroSlide = (index: number) =>
    setForm((f) => {
      const content = f.homepageContent ?? emptyHomepageContent;
      return { ...f, homepageContent: { ...content, heroSlides: content.heroSlides.filter((_, i) => i !== index) } };
    });

  const moveHeroSlide = (index: number, direction: -1 | 1) =>
    setForm((f) => {
      const content = f.homepageContent ?? emptyHomepageContent;
      const target = index + direction;
      if (target < 0 || target >= content.heroSlides.length) return f;
      const heroSlides = [...content.heroSlides];
      [heroSlides[index], heroSlides[target]] = [heroSlides[target], heroSlides[index]];
      return { ...f, homepageContent: { ...content, heroSlides } };
    });

  if (restaurantQuery.isLoading) {
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

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Logo, hero image, and theme colors shown on your storefront</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-6">
            {form.logoUrl ? (
              <div className="w-32 h-32 border rounded-lg overflow-hidden bg-muted">
                <img src={getImageUrl(form.logoUrl)} alt="Restaurant Logo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                <ImageIcon className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input id="logoUrl" value={form.logoUrl ?? ''} onChange={(e) => set('logoUrl', e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="heroImageUrl">Hero Image URL</Label>
                <Input id="heroImageUrl" value={form.heroImageUrl ?? ''} onChange={(e) => set('heroImageUrl', e.target.value)} placeholder="https://..." />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="themeColorPrimary">Primary Color</Label>
              <div className="flex items-center gap-2">
                <Input id="themeColorPrimary" type="color" className="w-16 h-10 p-1" value={form.themeColorPrimary} onChange={(e) => set('themeColorPrimary', e.target.value)} />
                <Input value={form.themeColorPrimary} onChange={(e) => set('themeColorPrimary', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="themeColorSecondary">Secondary Color</Label>
              <div className="flex items-center gap-2">
                <Input id="themeColorSecondary" type="color" className="w-16 h-10 p-1" value={form.themeColorSecondary} onChange={(e) => set('themeColorSecondary', e.target.value)} />
                <Input value={form.themeColorSecondary} onChange={(e) => set('themeColorSecondary', e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Homepage Content</CardTitle>
          <CardDescription>Hero banners and section copy shown on your storefront's homepage. Leave a field blank to use the default text.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Hero Banners</Label>
              <Button type="button" variant="outline" size="sm" onClick={addHeroSlide} disabled={(form.homepageContent?.heroSlides.length ?? 0) >= MAX_HERO_SLIDES}>
                <Plus className="mr-2 h-4 w-4" />Add Banner
              </Button>
            </div>
            {(form.homepageContent?.heroSlides.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">No banners configured - the homepage will show a single default hero image.</p>
            )}
            {form.homepageContent?.heroSlides.map((slide, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Banner {index + 1}</p>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveHeroSlide(index, -1)} disabled={index === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveHeroSlide(index, 1)} disabled={index === (form.homepageContent?.heroSlides.length ?? 1) - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeHeroSlide(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <ImageUploadField value={slide.imageUrl} onChange={(url) => updateHeroSlide(index, { imageUrl: url })} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`slide-heading-${index}`}>Heading</Label>
                    <Input id={`slide-heading-${index}`} value={slide.heading} onChange={(e) => updateHeroSlide(index, { heading: e.target.value })} placeholder="Try our House Specials" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`slide-subheading-${index}`}>Subheading</Label>
                    <Input id={`slide-subheading-${index}`} value={slide.subheading ?? ''} onChange={(e) => updateHeroSlide(index, { subheading: e.target.value })} placeholder="A range of delightful dishes..." />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
            <div className="space-y-2 pt-4">
              <Label htmlFor="orderOnlineTitle">Order Online - Title</Label>
              <Input id="orderOnlineTitle" value={form.homepageContent?.orderOnlineTitle ?? ''} onChange={(e) => setHomepage('orderOnlineTitle', e.target.value)} placeholder="Order Online" />
              <Label htmlFor="orderOnlineText">Order Online - Text</Label>
              <Textarea id="orderOnlineText" rows={2} value={form.homepageContent?.orderOnlineText ?? ''} onChange={(e) => setHomepage('orderOnlineText', e.target.value)} placeholder="Enter your postcode to begin your order for collection or delivery." />
            </div>
            <div className="space-y-2 pt-4">
              <Label htmlFor="loyaltyTitle">Loyalty Points - Title</Label>
              <Input id="loyaltyTitle" value={form.homepageContent?.loyaltyTitle ?? ''} onChange={(e) => setHomepage('loyaltyTitle', e.target.value)} placeholder="Loyalty Points" />
              <Label htmlFor="loyaltyText">Loyalty Points - Text</Label>
              <Textarea id="loyaltyText" rows={2} value={form.homepageContent?.loyaltyText ?? ''} onChange={(e) => setHomepage('loyaltyText', e.target.value)} placeholder="Register as a member to earn and redeem loyalty points on every order." />
            </div>
            <div className="space-y-2 pt-4">
              <Label htmlFor="deliverTitle">We Deliver - Title</Label>
              <Input id="deliverTitle" value={form.homepageContent?.deliverTitle ?? ''} onChange={(e) => setHomepage('deliverTitle', e.target.value)} placeholder="We Deliver!" />
              <Label htmlFor="deliverText">We Deliver - Text</Label>
              <Textarea id="deliverText" rows={2} value={form.homepageContent?.deliverText ?? ''} onChange={(e) => setHomepage('deliverText', e.target.value)} placeholder="Order online today and our drivers will bring your food straight to your door." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-2 pt-4">
              <Label htmlFor="welcomeTitle">Welcome Section - Title</Label>
              <Input id="welcomeTitle" value={form.homepageContent?.welcomeTitle ?? ''} onChange={(e) => setHomepage('welcomeTitle', e.target.value)} placeholder="Welcome!" />
            </div>
            <div className="space-y-2 pt-4">
              <Label htmlFor="welcomeText">Welcome Section - Text</Label>
              <Textarea id="welcomeText" rows={2} value={form.homepageContent?.welcomeText ?? ''} onChange={(e) => setHomepage('welcomeText', e.target.value)} placeholder="Experience the bold flavours of Indian cuisine..." />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>Update your restaurant's basic details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Restaurant Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Enter restaurant name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="restaurant@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="01792 358850" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Describe your restaurant..." rows={3} />
          </div>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="currency">Currency</Label>
            <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Changes the currency symbol shown across admin and your storefront.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
          <CardDescription>Your restaurant's location details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addressLine1">Address Line 1</Label>
            <Input id="addressLine1" value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} placeholder="113-115 High Street" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address Line 2</Label>
            <Input id="addressLine2" value={form.addressLine2 ?? ''} onChange={(e) => set('addressLine2', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Swansea" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input id="postcode" value={form.postcode} onChange={(e) => set('postcode', e.target.value)} placeholder="SA8 4JN" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="GB" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ordering Options</CardTitle>
          <CardDescription>Which order types customers can choose on your storefront</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <Label htmlFor="supportsDelivery">Home Delivery</Label>
            <Switch id="supportsDelivery" checked={form.supportsDelivery} onCheckedChange={(v) => set('supportsDelivery', v)} />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <Label htmlFor="supportsCollection">Collection</Label>
            <Switch id="supportsCollection" checked={form.supportsCollection} onCheckedChange={(v) => set('supportsCollection', v)} />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <Label htmlFor="supportsDineIn">Dine-In (QR tables)</Label>
            <Switch id="supportsDineIn" checked={form.supportsDineIn} onCheckedChange={(v) => set('supportsDineIn', v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fees & Loyalty</CardTitle>
          <CardDescription>Checkout processing fee and loyalty points earn rate</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="processingFeeFlat">Processing Fee (flat, {currencySymbol(form.currency)})</Label>
            <Input id="processingFeeFlat" type="number" step="0.01" min="0" value={form.processingFeeFlat}
              onChange={(e) => set('processingFeeFlat', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="processingFeePercentage">Processing Fee (%)</Label>
            <Input id="processingFeePercentage" type="number" step="0.1" min="0" value={form.processingFeePercentage}
              onChange={(e) => set('processingFeePercentage', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loyaltyPointsPerCurrencyUnit">Loyalty Points per {currencySymbol(form.currency)}1</Label>
            <Input id="loyaltyPointsPerCurrencyUnit" type="number" step="0.1" min="0" value={form.loyaltyPointsPerCurrencyUnit}
              onChange={(e) => set('loyaltyPointsPerCurrencyUnit', parseFloat(e.target.value) || 0)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} size="lg" disabled={saveMutation.isPending || !form.name}>
          {saveMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : 'Save Changes'}
        </Button>
      </div>

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

export default RestaurantSettingsPage;
