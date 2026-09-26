import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Story from './pages/Story';
import FindUs from './pages/FindUs';
import Checkout from './pages/Checkout';
import OrderTrack from './pages/OrderTrack';
import SignIn from './pages/SignIn';
import Account from './pages/Account';
import NotFound from './pages/NotFound';

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo(0, 0); }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="menu" element={<Menu />} />
          <Route path="story" element={<Story />} />
          <Route path="find-us" element={<FindUs />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order/:orderId/track" element={<OrderTrack />} />
          <Route path="sign-in" element={<SignIn />} />
          <Route path="account/*" element={<Account />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
