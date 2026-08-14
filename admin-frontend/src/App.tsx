import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RestaurantSettings from "./pages/RestaurantSettings";
import Tables from "./pages/Tables";
import Menu from "./pages/Menu";
import Menus from "./pages/Menus";
import Orders from "./pages/Orders";
import Reviews from "./pages/Reviews";
import Vouchers from "./pages/Vouchers";
import DeliveryZones from "./pages/DeliveryZones";
import OpeningHours from "./pages/OpeningHours";
import Notifications from "./pages/Notifications";
import Configurations from "./pages/Configurations";
import ChangePassword from "./pages/ChangePassword";
import Takeout from "./pages/Takeout";
import DashboardLayout from "./layouts/DashboardLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="settings" element={<RestaurantSettings />} />
              <Route path="tables" element={<Tables />} />
              <Route path="menu" element={<Menu />} />
              <Route path="menus" element={<Menus />} />
              <Route path="orders" element={<Orders />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="vouchers" element={<Vouchers />} />
              <Route path="delivery-zones" element={<DeliveryZones />} />
              <Route path="opening-hours" element={<OpeningHours />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="configurations" element={<Configurations />} />
              <Route path="takeout" element={<Takeout />} />
              <Route path="change-password" element={<ChangePassword />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
