import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Checkout from './pages/Checkout';
import OrderTracking from './pages/OrderTracking';
import Login from './pages/Login';
import Register from './pages/Register';
import Account from './pages/Account';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order/:orderId/track" element={<OrderTracking />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/login" element={<Login />} />
        <Route path="/account/register" element={<Register />} />
      </Route>
    </Routes>
  );
}
