import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mark } from '@/components/Mark';
import { api, setToken, type LoginResponse } from '@/lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<LoginResponse>('/api/platform/auth/login', { email, password });
      setToken(res.accessToken, res.expiresAt);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[hsl(228_24%_11%)] p-12 text-[hsl(228_14%_92%)] lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,hsl(26_78%_47%/0.28),transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(hsl(0_0%_100%)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="relative flex items-center gap-2.5 font-semibold">
          <Mark className="bg-[hsl(228_14%_92%)] text-[hsl(228_24%_11%)]" />
          Platform console
        </div>
        <div className="relative mt-auto max-w-md">
          <p className="text-3xl font-semibold leading-tight tracking-tight">
            Restaurants, plans and devices, in one place.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[hsl(228_10%_70%)]">
            Switch features per restaurant, record subscription payments and see every till and tablet on the platform.
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 font-semibold lg:hidden">
            <Mark />
            Platform console
          </div>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Platform owner access only.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Sign in
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
