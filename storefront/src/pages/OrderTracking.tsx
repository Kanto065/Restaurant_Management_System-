import { useParams, Link } from 'react-router-dom';
import { useTrackOrder } from '../lib/queries';
import type { OrderStatus } from '../types/api';

const STEPS: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'OutForDeliveryOrServed', 'Completed'];

const STEP_LABELS: Record<OrderStatus, string> = {
  Pending: 'Order Placed',
  Confirmed: 'Confirmed',
  Preparing: 'Preparing',
  Ready: 'Ready',
  OutForDeliveryOrServed: 'On the Way',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
};

export default function OrderTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: order, isLoading } = useTrackOrder(orderId);

  if (isLoading) return <div className="max-w-2xl mx-auto px-4 py-16 text-center">Loading order...</div>;
  if (!order) return <div className="max-w-2xl mx-auto px-4 py-16 text-center">Order not found.</div>;

  const currentIndex = STEPS.indexOf(order.status);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-2xl sm:text-3xl mb-1">Order #{order.orderNumber}</h1>
      <p className="text-brand-cream/70 text-sm mb-6">Placed {new Date(order.createdAt).toLocaleString('en-GB')}</p>

      {order.status === 'Cancelled' ? (
        <p className="text-red-400 font-medium mb-6">This order has been cancelled.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-8">
          {STEPS.filter((s) => s !== 'Cancelled').map((step, i) => (
            <div
              key={step}
              className={`px-3 py-2 rounded text-xs sm:text-sm font-medium ${
                i <= currentIndex ? 'bg-brand-green text-white' : 'bg-brand-cream/10 text-brand-cream/50'
              }`}
            >
              {STEP_LABELS[step]}
            </div>
          ))}
        </div>
      )}

      <div className="bg-brand-cream text-brand-bg rounded-lg p-5">
        <h2 className="font-semibold mb-3">Order Summary</h2>
        <div className="divide-y divide-brand-bg/10 text-sm">
          {order.items.map((item, i) => (
            <div key={i} className="py-2 flex justify-between">
              <span>{item.quantity} x {item.nameSnapshot}</span>
              <span>£{item.lineTotal.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="pt-3 mt-2 border-t border-brand-bg/10 font-semibold flex justify-between">
          <span>Total</span>
          <span>£{order.totalAmount.toFixed(2)}</span>
        </div>
        {order.estimatedReadyAt && (
          <p className="mt-3 text-sm text-brand-bg/70">
            Estimated ready: {new Date(order.estimatedReadyAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      <Link to="/menu" className="inline-block mt-6 text-brand-mint underline text-sm">
        Order again
      </Link>
    </div>
  );
}
