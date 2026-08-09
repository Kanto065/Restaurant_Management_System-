import { LayoutDashboard, Settings, UtensilsCrossed, ShoppingBag, Table2, LogOut, User, Lock, Bell, BookOpen, PackageOpen, Star, Ticket, Clock3, Truck } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';

const menuItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Restaurant Info', url: '/dashboard/settings', icon: Settings },
  { title: 'Tables', url: '/dashboard/tables', icon: Table2 },
  { title: 'Takeout', url: '/dashboard/takeout', icon: PackageOpen },
  { title: 'Menu Items', url: '/dashboard/menu', icon: UtensilsCrossed },
  { title: 'Categories', url: '/dashboard/menus', icon: BookOpen },
  { title: 'Orders', url: '/dashboard/orders', icon: ShoppingBag },
  { title: 'Reviews', url: '/dashboard/reviews', icon: Star },
  { title: 'Vouchers', url: '/dashboard/vouchers', icon: Ticket },
  { title: 'Delivery Zones', url: '/dashboard/delivery-zones', icon: Truck },
  { title: 'Opening Hours', url: '/dashboard/opening-hours', icon: Clock3 },
  { title: 'Notifications', url: '/dashboard/notifications', icon: Bell },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar className={collapsed ? 'w-14' : 'w-64'} collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-bold text-lg">Takeout</h2>
                <p className="text-xs text-muted-foreground">Admin Panel</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''
                      }
                    >
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user && !collapsed && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-4 py-2 flex items-center gap-3 hover:bg-sidebar-accent rounded-lg transition-colors w-full">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{user.fullName || user.email}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.restaurants.find((r) => r.restaurantId === user.activeRestaurantId)?.role ?? 'Staff'}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/dashboard/change-password')}>
                  <Lock className="mr-2 h-4 w-4" />
                  <span>Change Password</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Separator />
          </>
        )}
        {collapsed && (
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={logout}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        )}
        {!user && !collapsed && (
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={logout}
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}