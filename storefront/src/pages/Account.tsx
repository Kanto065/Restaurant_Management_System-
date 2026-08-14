import { Navigate, Link } from 'react-router-dom';
import { customerAuth } from '../lib/api';
import { useOrders, useRestaurant } from '../lib/queries';
import { currencySymbol } from '../lib/currency';

const STATUS_LABELS: Record<string, string> = {
  Pending: 'Pending',
  Confirmed: 'Confirmed',
  Preparing: 'Preparing',
  Ready: 'Ready',
  OutForDeliveryOrServed: 'Out for Delivery',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Account() {
  const ordersQuery = useOrders();
  const { data: restaurant } = useRestaurant();
  const currency = currencySymbol(restaurant?.currency);

  if (!customerAuth.isLoggedIn()) {
    return <Navigate to="/account/members" replace />;
  }

  const orders = ordersQuery.data ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-brand-cream text-brand-bg rounded-lg p-6">
        <h1 className="font-display text-2xl mb-4">My Account</h1>
        <p className="text-sm text-brand-bg/70 mb-6">
          Saved addresses and loyalty points are coming soon.
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

      <div className="bg-brand-cream text-brand-bg rounded-lg p-6 mt-4">
        <h2 className="font-display text-xl mb-4">My Orders</h2>

        {ordersQuery.isLoading && <p className="text-sm text-brand-bg/60">Loading your orders...</p>}

        {!ordersQuery.isLoading && orders.length === 0 && (
          <p className="text-sm text-brand-bg/60">You haven't placed any orders yet.</p>
        )}

        <div className="divide-y divide-brand-bg/10">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/order/${order.id}/track`}
              className="py-3 flex items-center justify-between gap-3 hover:bg-brand-bg/5 -mx-2 px-2 rounded"
            >
              <div className="min-w-0">
                <p className="font-medium">Order #{order.orderNumber}</p>
                <p className="text-sm text-brand-bg/60">{formatDate(order.createdAt)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold">{currency}{order.totalAmount.toFixed(2)}</p>
                <p className="text-xs text-brand-bg/60">{STATUS_LABELS[order.status] ?? order.status}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
