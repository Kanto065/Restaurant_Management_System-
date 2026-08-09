import { Navigate, Link } from 'react-router-dom';
import { customerAuth } from '../lib/api';

export default function Account() {
  if (!customerAuth.isLoggedIn()) {
    return <Navigate to="/account/members" replace />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-brand-cream text-brand-bg rounded-lg p-6">
        <h1 className="font-display text-2xl mb-4">My Account</h1>
        <p className="text-sm text-brand-bg/70 mb-6">
          Order history, saved addresses, and loyalty points are coming soon.
        </p>
        <div className="flex gap-3">
          <Link to="/menu" className="bg-brand-green text-white rounded px-4 py-2 text-sm font-medium">
            Order Now
          </Link>
          <button
            onClick={() => {
              customerAuth.clear();
              window.location.href = '/';
            }}
            className="border border-brand-bg/20 rounded px-4 py-2 text-sm font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
