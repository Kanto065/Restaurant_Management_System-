import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useOrders, useRestaurant } from '../../lib/queries';
import { currencySymbol } from '../../lib/currency';

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
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function MyOrders() {
  const ordersQuery = useOrders();
  const { data: restaurant } = useRestaurant();
  const currency = currencySymbol(restaurant?.currency);
  const orders = ordersQuery.data ?? [];

  const totalSpent = orders.reduce((s, o) => s + o.totalAmount, 0);
  const averageSpend = orders.length > 0 ? totalSpent / orders.length : 0;

  return (
    <div className="bg-brand-cream text-brand-bg rounded-lg overflow-hidden">
      <div className="p-6 pb-4">
        <h1 className="font-display text-2xl mb-1 flex items-center gap-2"><ShoppingBag className="w-6 h-6" />My Orders</h1>
        <p className="text-sm text-brand-bg/70">This page shows a list of the orders you've placed with us whilst logged into your account.</p>
      </div>

      {ordersQuery.isLoading && <p className="px-6 pb-6 text-sm text-brand-bg/60">Loading your orders...</p>}
      {!ordersQuery.isLoading && orders.length === 0 && (
        <p className="px-6 pb-6 text-sm text-brand-bg/60">You haven't placed any orders yet.</p>
      )}

      {orders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-orange text-white text-left">
                <th className="px-4 py-2.5 font-medium">Order</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">For</th>
                <th className="px-4 py-2.5 font-medium">Paid By</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-bg/10">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-brand-bg/5">
                  <td className="px-4 py-2.5">
                    <Link to={`/order/${order.id}/track`} className="text-brand-green underline font-medium">
                      #{order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-2.5">{formatTime(order.createdAt)}</td>
                  <td className="px-4 py-2.5">{order.orderType}</td>
                  <td className="px-4 py-2.5">{order.paymentMethod}</td>
                  <td className="px-4 py-2.5">{STATUS_LABELS[order.status] ?? order.status}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{currency}{order.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-brand-bg/10">
                <td colSpan={6} className="px-4 py-2 text-right text-brand-bg/60">Total Orders:</td>
                <td className="px-4 py-2 text-right font-medium">{orders.length}</td>
              </tr>
              <tr>
                <td colSpan={6} className="px-4 py-2 text-right text-brand-bg/60">Average Spend:</td>
                <td className="px-4 py-2 text-right font-medium">{currency}{averageSpend.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan={6} className="px-4 py-2 text-right text-brand-bg/60">Total Spent:</td>
                <td className="px-4 py-2 text-right font-semibold">{currency}{totalSpent.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
