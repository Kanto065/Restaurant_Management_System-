import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useRestaurant } from '@shared/lib/queries';
import { customerAuth } from '@shared/lib/api';
import { useCartStore } from '@shared/store/cart';
import { confirmed, isOrderingOpen } from '../lib/site';

const MOBILE = '(max-width: 760px)';

function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Star Spice home">
      <img src="/assets/logo-original.png" alt="Star Spice" width={1536} height={1024} />
    </Link>
  );
}

/** The client's header/footer (dist/index.html), plus basket + account links once ordering opens. */
export default function Layout() {
  const { data: restaurant } = useRestaurant();
  const orderingOpen = isOrderingOpen(restaurant);
  const itemCount = useCartStore((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const location = useLocation();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // site.js: nav collapses behind the toggle on phones, Escape closes it.
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE).matches);
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE);
    const onChange = () => { setIsMobile(mq.matches); setNavOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  useEffect(() => { setNavOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setNavOpen(false); toggleRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const navLink = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="wrap nav-row">
          <Brand />
          <button ref={toggleRef} className="menu-toggle" aria-expanded={navOpen} aria-controls="main-nav"
            onClick={() => setNavOpen((o) => !o)}>
            Menu <span aria-hidden="true">☰</span>
          </button>
          <nav className="nav-links" id="main-nav" aria-label="Main navigation" hidden={isMobile && !navOpen}>
            <NavLink to="/" end className={navLink}>Home</NavLink>
            <NavLink to="/menu" className={navLink}>{orderingOpen ? 'Order online' : 'The menu'}</NavLink>
            <NavLink to="/story" className={navLink}>Our story</NavLink>
            <NavLink to="/find-us" className={navLink}>Find us</NavLink>
            {orderingOpen && isMobile && (
              <NavLink to={customerAuth.isLoggedIn() ? '/account' : '/sign-in'} className={navLink}>
                {customerAuth.isLoggedIn() ? 'My account' : 'Sign in'}
              </NavLink>
            )}
          </nav>
          {!orderingOpen && <span className="nav-status">A new chapter is coming</span>}
          {orderingOpen && (
            <div className="nav-actions">
              <Link className="account-link" to={customerAuth.isLoggedIn() ? '/account' : '/sign-in'}>
                {customerAuth.isLoggedIn() ? 'My account' : 'Sign in'}
              </Link>
              <Link className="basket-link" to="/menu" aria-label={`Basket, ${itemCount} items`}>
                Basket <b>{itemCount}</b>
              </Link>
            </div>
          )}
        </div>
      </header>

      <main id="main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <div className="footer-top">
            <div>
              <Link className="brand" style={{ display: 'block' }} to="/" aria-label="Star Spice home">
                <img src="/assets/logo-original.png" alt="Star Spice" width={1536} height={1024} loading="lazy" />
              </Link>
              <p>Indian &amp; Bangladeshi takeaway<br />Tumble, Carmarthenshire</p>
            </div>
            <nav className="footer-nav" aria-label="Footer navigation">
              <Link to="/menu">The menu</Link>
              <Link to="/story">Our story</Link>
              <Link to="/find-us">Find us</Link>
            </nav>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Star Spice</span>
            <span>{confirmed(restaurant?.phone) ?? (orderingOpen ? 'Order online for collection or delivery' : 'Tumble, Carmarthenshire')}</span>
          </div>
        </div>
      </footer>
    </>
  );
}
