import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useOrderEvents } from '@/hooks/useOrderEvents';
import { Loader2 } from 'lucide-react';

const DashboardLayout = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Live order/notification updates for every authenticated page - subscribes once
  // the user is logged in, regardless of which admin page they're viewing.
  useOrderEvents();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          {/* Sidebar is an off-canvas sheet on mobile, closed by default, and its own
              trigger lives inside that closed sheet - unreachable without this bar. */}
          <div className="md:hidden flex items-center gap-3 border-b bg-background px-4 py-3 sticky top-0 z-10">
            <SidebarTrigger />
            <span className="font-semibold truncate">Port Tennant Tandoori</span>
          </div>
          <div className="flex-1 p-6 bg-muted/30">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;