import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes, Link, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { clearToken, getToken } from '@/lib/api';
import Login from '@/pages/Login';
import Tenants from '@/pages/Tenants';
import NewTenant from '@/pages/NewTenant';
import TenantDetail from '@/pages/TenantDetail';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function ProtectedLayout() {
  const navigate = useNavigate();
  if (!getToken()) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Super Admin
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearToken();
              queryClient.clear();
              navigate('/login');
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Tenants />} />
            <Route path="/tenants/new" element={<NewTenant />} />
            <Route path="/tenants/:id" element={<TenantDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors />
    </QueryClientProvider>
  );
}
