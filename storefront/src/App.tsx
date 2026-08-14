import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderTracking from './pages/OrderTracking';
import Members from './pages/Members';
import MemberLayout from './components/MemberLayout';
import MembersHome from './pages/members/MembersHome';
import LoyaltyPoints from './pages/members/LoyaltyPoints';
import MyOrders from './pages/members/MyOrders';
import MyProfile from './pages/members/MyProfile';
import MyAddresses from './pages/members/MyAddresses';
import Reviews from './pages/Reviews';
import ContactUs from './pages/ContactUs';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/menu/category/:categoryId" element={<Menu />} />
        <Route path="/menu/item/:itemId" element={<Menu />} />
        <Route path="/menu/category/:categoryId/item/:itemId" element={<Menu />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order/:orderId/track" element={<OrderTracking />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/account" element={<MemberLayout />}>
          <Route index element={<MembersHome />} />
          <Route path="loyalty" element={<LoyaltyPoints />} />
          <Route path="orders" element={<MyOrders />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="addresses" element={<MyAddresses />} />
        </Route>
        <Route path="/account/members" element={<Members />} />
        {/* Old separate login/register routes now redirect to the combined Members page. */}
        <Route path="/account/login" element={<Navigate to="/account/members" replace />} />
        <Route path="/account/register" element={<Navigate to="/account/members" replace />} />
      </Route>
    </Routes>
  );
}
