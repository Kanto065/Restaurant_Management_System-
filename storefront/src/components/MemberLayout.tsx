import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { customerAuth } from '../lib/api';
import { useProfile, useRestaurant } from '../lib/queries';
import { currencySymbol } from '../lib/currency';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-1 py-1 text-sm ${isActive ? 'text-brand-green font-semibold' : 'text-brand-bg/80 hover:text-brand-bg'}`;

export default function MemberLayout() {
  if (!customerAuth.isLoggedIn()) {
    return <Navigate to="/account/members" replace />;
  }

  const profileQuery = useProfile();
  const { data: restaurant } = useRestaurant();
  const currency = currencySymbol(restaurant?.currency);
  const profile = profileQuery.data;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid md:grid-cols-[220px_1fr] gap-6">
      <div className="space-y-4">
        <div className="bg-brand-cream text-brand-bg rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-bg/50 mb-2">Member Navigation</p>
          <nav className="space-y-1 mb-4">
            <NavLink to="/account" end className={navLinkClass}>Members Home</NavLink>
            <NavLink to="/account/loyalty" className={navLinkClass}>Loyalty Points</NavLink>
          </nav>

          <p className="text-xs font-semibold uppercase tracking-wide text-brand-bg/50 mb-2">Account</p>
          <nav className="space-y-1 mb-4">
            <NavLink to="/account/orders" className={navLinkClass}>My Orders</NavLink>
            <NavLink to="/account/profile" className={navLinkClass}>My Profile</NavLink>
            <NavLink to="/account/addresses" className={navLinkClass}>My Addresses</NavLink>
            <span className="block px-1 py-1 text-sm text-brand-bg/30">My Numbers <span className="text-xs">(Coming soon)</span></span>
          </nav>

          <p className="text-xs font-semibold uppercase tracking-wide text-brand-bg/50 mb-2">My Statistics</p>
          <div className="text-sm space-y-1 mb-4">
            <div className="flex justify-between"><span className="text-brand-bg/60">Orders:</span><span>{profile?.orderCount ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-brand-bg/60">Order Total:</span><span>{currency}{(profile?.orderTotal ?? 0).toFixed(2)}</span></div>
          </div>

          <button
            onClick={() => { customerAuth.clear(); window.location.href = '/'; }}
            className="text-sm text-brand-bg/70 hover:text-brand-bg border-t border-brand-bg/10 pt-3 w-full text-left"
          >
            ⏻ Logout
          </button>
        </div>

        <Link to="/menu" className="block text-center bg-brand-green text-white rounded-lg py-2.5 text-sm font-medium">
          🛒 Order Now
        </Link>
      </div>

      <div>
        <Outlet />
      </div>
    </div>
  );
}
