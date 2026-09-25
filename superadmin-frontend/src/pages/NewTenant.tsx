import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api, type TenantDetail } from '@/lib/api';
import { slugify } from '@/lib/format';

const empty = {
  restaurantName: '',
  slug: '',
  addressLine1: '',
  city: '',
  postcode: '',
  phone: '',
  email: '',
  storefrontHost: '',
  adminHost: '',
  ownerFullName: '',
  ownerEmail: '',
  ownerPassword: '',
};

type Field = keyof typeof empty;

function TextField({ id, label, value, onChange, hint, type = 'text', required = false, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  hint?: string; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input id={id} type={type} value={value} placeholder={placeholder} required={required}
        onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function NewTenant() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const [slugTouched, setSlugTouched] = useState(false);

  const set = (field: Field) => (value: string) =>
    setForm((f) => ({
      ...f,
      [field]: value,
      ...(field === 'restaurantName' && !slugTouched ? { slug: slugify(value) } : {}),
    }));

  const create = useMutation({
    mutationFn: () => api.post<TenantDetail>('/api/platform/tenants', {
      ...form,
      phone: form.phone || null,
      email: form.email || null,
      storefrontHost: form.storefrontHost || null,
      adminHost: form.adminHost || null,
    }),
    onSuccess: (tenant) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success(`${tenant.name} created`);
      navigate(`/tenants/${tenant.restaurantId}`);
    },
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Restaurants</Link>
      </Button>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>New restaurant</CardTitle>
          <CardDescription>
            Creates the restaurant, its domains and an owner login in one step. Point each domain's
            DNS at the server and add it to Caddy before it will load in a browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            {create.error && (
              <Alert variant="destructive"><AlertDescription>{(create.error as Error).message}</AlertDescription></Alert>
            )}

            <section className="grid gap-4 sm:grid-cols-2">
              <TextField id="name" label="Restaurant name" required value={form.restaurantName}
                onChange={set('restaurantName')} placeholder="Star Spice" />
              <TextField id="slug" label="Slug" required value={form.slug} hint="Unique, lowercase, used internally."
                onChange={(v) => { setSlugTouched(true); set('slug')(v); }} />
              <TextField id="address" label="Address line 1" required value={form.addressLine1} onChange={set('addressLine1')} />
              <TextField id="city" label="Town / city" required value={form.city} onChange={set('city')} />
              <TextField id="postcode" label="Postcode" required value={form.postcode} onChange={set('postcode')} />
              <TextField id="phone" label="Phone" value={form.phone} onChange={set('phone')} />
              <TextField id="email" label="Restaurant email" type="email" value={form.email} onChange={set('email')} />
            </section>

            <Separator />

            <section className="grid gap-4 sm:grid-cols-2">
              <TextField id="storefrontHost" label="Storefront domain" value={form.storefrontHost}
                onChange={set('storefrontHost')} placeholder="starspicetumble.co.uk" />
              <TextField id="adminHost" label="Admin domain" value={form.adminHost}
                onChange={set('adminHost')} placeholder="admin.starspicetumble.co.uk" />
            </section>

            <Separator />

            <section className="grid gap-4 sm:grid-cols-2">
              <TextField id="ownerName" label="Owner full name" required value={form.ownerFullName} onChange={set('ownerFullName')} />
              <TextField id="ownerEmail" label="Owner email (admin login)" type="email" required value={form.ownerEmail}
                onChange={set('ownerEmail')} />
              <TextField id="ownerPassword" label="Owner password" type="password" required value={form.ownerPassword}
                onChange={set('ownerPassword')}
                hint="At least 8 characters with upper, lower, a digit and a symbol. Ignored if this email already has a staff login." />
            </section>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" asChild><Link to="/">Cancel</Link></Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create restaurant
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
