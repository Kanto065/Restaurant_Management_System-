import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { clearToken, getToken } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Mark } from '@/components/Mark';
import Login from '@/pages/Login';
import Tenants from '@/pages/Tenants';
import NewTenant from '@/pages/NewTenant';
import TenantDetail from '@/pages/TenantDetail';
import Plans from '@/pages/Plans';
import Devices from '@/pages/Devices';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

const nav = [
  { to: "/", label: "Restaurants", match: (p: string) => p === '/' || p.startsWith('/tenants') },
  { to: '/plans', label: 'Plans' },
  { to: '/devices', label: 'Devices' },
];


function ProtectedLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!getToken()) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-[100dvh]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <Mark />
            <span className="hidden sm:inline">Platform console</span>
          </Link>
          <nav className="flex h-full items-center gap-1" aria-label="Main">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => {
                  const active = item.match ? item.match(pathname) : isActive;
                  return cn(
                    'relative flex h-full items-center px-3 text-sm font-medium transition-colors',
                    active ? 'text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent'
                      : 'text-muted-foreground hover:text-foreground',
                  );
                }}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              clearToken();
              queryClient.clear();
              navigate('/login');
            }}
          >
            <LogOut />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
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
            <Route path="/plans" element={<Plans />} />
            <Route path="/devices" element={<Devices />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
