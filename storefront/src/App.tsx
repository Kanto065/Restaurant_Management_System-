import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderTracking from './pages/OrderTracking';
import Members from './pages/Members';
import Account from './pages/Account';
import Reviews from './pages/Reviews';
import ContactUs from './pages/ContactUs';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/menu/item/:itemId" element={<Menu />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order/:orderId/track" element={<OrderTracking />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/members" element={<Members />} />
        {/* Old separate login/register routes now redirect to the combined Members page. */}
        <Route path="/account/login" element={<Navigate to="/account/members" replace />} />
        <Route path="/account/register" element={<Navigate to="/account/members" replace />} />
      </Route>
    </Routes>
  );
}
