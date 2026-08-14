import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useRestaurant, useProfile } from '../lib/queries';
import { useCartStore } from '../store/cart';
import { customerAuth } from '../lib/api';
import { User, MapPin } from 'lucide-react';
import type { DayOfWeekName, OpeningHour, OpeningHourException } from '../types/api';

const DAY_NAMES: DayOfWeekName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function localDateIso(date: Date): string {
  // Local calendar date, not UTC - toISOString() would roll over to the wrong day
  // near midnight during BST (UTC+1), breaking "today's exception" lookups.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todaysException(exceptions: OpeningHourException[]): OpeningHourException | undefined {
  const todayIso = localDateIso(new Date());
  return exceptions.find((e) => e.date.slice(0, 10) === todayIso);
}

function isOpenNow(hours: OpeningHour[], exceptions: OpeningHourException[]) {
  const now = new Date();
  const exception = todaysException(exceptions);
  const today = exception ?? hours.find((h) => h.dayOfWeek === DAY_NAMES[now.getDay()]);
  if (!today || today.isClosed || !today.openTime || !today.closeTime) return false;
  const [oh, om] = today.openTime.split(':').map(Number);
  const [ch, cm] = today.closeTime.split(':').map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= oh * 60 + om && nowMinutes <= ch * 60 + cm;
}

export default function Layout() {
  const { data: restaurant } = useRestaurant();
  const itemCount = useCartStore((s) => s.itemCount());
  const setOrderType = useCartStore((s) => s.setOrderType);
  const [menuOpen, setMenuOpen] = useState(false);
  const [orderingDropdownOpen, setOrderingDropdownOpen] = useState(false);
  const orderingDropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const loggedIn = customerAuth.isLoggedIn();
  const { data: profile } = useProfile();

  useEffect(() => {
    if (!orderingDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (orderingDropdownRef.current && !orderingDropdownRef.current.contains(e.target as Node)) {
        setOrderingDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [orderingDropdownOpen]);

  const open = restaurant ? isOpenNow(restaurant.openingHours, restaurant.openingHourExceptions) : null;
  const exceptionToday = restaurant ? todaysException(restaurant.openingHourExceptions) : undefined;

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      onClick={() => setMenuOpen(false)}
      className={`px-4 py-2 border rounded text-sm transition-colors ${
        location.pathname === to
          ? 'bg-brand-mint text-brand-bg border-brand-mint'
          : 'border-brand-cream/30 hover:border-brand-cream text-brand-cream'
      }`}
    >
      {label}
    </Link>
  );

  const goOrder = (type: 'Delivery' | 'Collection') => {
    setOrderType(type);
    setOrderingDropdownOpen(false);
    setMenuOpen(false);
    navigate(`/menu?type=${type}`);
  };

  const orderingOptions = (
    <>
      {(restaurant?.supportsDelivery ?? true) && (
        <button onClick={() => goOrder('Delivery')} className="block w-full text-left px-4 py-2 text-sm text-brand-bg hover:bg-brand-mint/30">
          Order for Home Delivery
        </button>
      )}
      {(restaurant?.supportsCollection ?? true) && (
        <button onClick={() => goOrder('Collection')} className="block w-full text-left px-4 py-2 text-sm text-brand-bg hover:bg-brand-mint/30">
          Order for Collection
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg text-brand-cream">
      <header className="border-b border-brand-cream/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-display text-2xl sm:text-3xl">
            {restaurant?.name ?? 'Port Tennant Tandoori'}
          </Link>

          <button
            className="md:hidden p-2 border border-brand-cream/30 rounded"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span className="block w-5 h-0.5 bg-brand-cream mb-1" />
            <span className="block w-5 h-0.5 bg-brand-cream mb-1" />
            <span className="block w-5 h-0.5 bg-brand-cream" />
          </button>

          <nav className="hidden md:flex items-center gap-3">
            {navLink('/', 'Home')}

            <div className="relative" ref={orderingDropdownRef}>
              <button
                type="button"
                onClick={() => setOrderingDropdownOpen((v) => !v)}
                className={`px-4 py-2 border rounded text-sm transition-colors ${
                  location.pathname === '/menu'
                    ? 'bg-brand-mint text-brand-bg border-brand-mint'
                    : 'border-brand-cream/30 hover:border-brand-cream text-brand-cream'
                }`}
              >
                Menu &amp; Ordering ▾
              </button>
              {orderingDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-brand-cream rounded shadow-lg overflow-hidden z-30">
                  {orderingOptions}
                </div>
              )}
            </div>

            {navLink('/reviews', 'Reviews')}
            {navLink('/contact-us', 'Contact Us')}
            {navLink('/account', loggedIn ? 'My Account' : 'Members')}
            {open !== null && (
              <span
                className={`ml-2 text-sm font-medium ${open ? 'text-brand-mint' : 'text-red-400'}`}
                title={exceptionToday?.note ?? undefined}
              >
                {open ? "We're Open" : "We're Closed"}
                {exceptionToday?.note && <span className="ml-1 text-xs text-brand-orange">({exceptionToday.note})</span>}
              </span>
            )}
          </nav>
        </div>

        {menuOpen && (
          <nav className="md:hidden flex flex-col gap-2 px-4 pb-4">
            {navLink('/', 'Home')}
            <div className="border border-brand-cream/30 rounded overflow-hidden">
              <p className="px-4 py-2 text-sm font-medium border-b border-brand-cream/10">Menu &amp; Ordering</p>
              {orderingOptions}
            </div>
            {navLink('/reviews', 'Reviews')}
            {navLink('/contact-us', 'Contact Us')}
            {navLink('/account', loggedIn ? 'My Account' : 'Members')}
          </nav>
        )}

        <div className="bg-brand-bg-light/60 border-t border-brand-cream/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs sm:text-sm text-brand-cream/80">
            <p className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {loggedIn ? (
                <>
                  Welcome back <span className="font-semibold text-brand-cream">{profile?.fullName?.split(' ')[0] ?? ''}</span>
                  {' ['}
                  <Link to="/account" className="underline">My Account</Link>
                  {' | '}
                  <button
                    onClick={() => { customerAuth.clear(); window.location.href = '/'; }}
                    className="underline"
                  >
                    Logout
                  </button>
                  {']'}
                </>
              ) : (
                <>Welcome guest! Please <Link to="/account/members" className="underline">login</Link> or{' '}
                  <Link to="/account/members" className="underline">register</Link> so we know who you are.</>
              )}
            </p>
            {restaurant && (
              <p className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {restaurant.city}, {restaurant.addressLine1}, {restaurant.postcode}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <Link
        to={itemCount > 0 ? '/cart' : '/menu'}
        className="md:hidden fixed bottom-4 right-4 bg-brand-orange text-white rounded-full px-5 py-3 shadow-lg font-medium text-sm z-40"
      >
        Cart {itemCount > 0 && `(${itemCount})`}
      </Link>

      <footer className="bg-brand-green/90 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm text-white/90">
          <p>Copyright &copy; {new Date().getFullYear()} {restaurant?.name ?? 'Port Tennant Tandoori'}. All Rights Reserved.</p>
          <p>{restaurant?.phone}</p>
        </div>
      </footer>
    </div>
  );
}
