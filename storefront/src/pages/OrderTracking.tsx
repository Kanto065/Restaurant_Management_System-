import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useTrackOrder, useRestaurant, useOrderStatuses, useCreateCheckoutSession } from '../lib/queries';
import { currencySymbol } from '../lib/currency';

// Nicer wording for the built-in status names; anything else (a custom admin-added status)
// just displays as-is, since it's already admin-authored plain text.
const STEP_LABELS: Record<string, string> = {
  Pending: 'Order Placed',
  Confirmed: 'Confirmed',
  Preparing: 'Preparing',
  Ready: 'Ready',
  OutForDeliveryOrServed: 'On the Way',
  Completed: 'Completed',
};

export default function OrderTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const { data: order, isLoading } = useTrackOrder(orderId);
  const { data: restaurant } = useRestaurant();
  const { data: allStatuses } = useOrderStatuses();
  const createCheckoutSession = useCreateCheckoutSession();
  const [payError, setPayError] = useState<string | null>(null);
  const currency = currencySymbol(restaurant?.currency);
  const paymentOutcome = searchParams.get('payment');

  if (isLoading) return <div className="max-w-2xl mx-auto px-4 py-16 text-center">Loading order...</div>;
  if (!order) return <div className="max-w-2xl mx-auto px-4 py-16 text-center">Order not found.</div>;

  const steps = (allStatuses ?? []).filter((s) => s !== 'Cancelled');
  const currentIndex = steps.indexOf(order.status);
  const needsPayment = order.paymentMethod === 'Card' && order.paymentStatus !== 'Paid';

  async function payNow() {
    if (!order) return;
    setPayError(null);
    try {
      const { checkoutUrl } = await createCheckoutSession.mutateAsync(order.id);
      window.location.href = checkoutUrl;
    } catch {
      setPayError('Could not start card payment. Please try again.');
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-2xl sm:text-3xl mb-1">Order #{order.orderNumber}</h1>
      <p className="text-brand-cream/70 text-sm mb-6">Placed {new Date(order.createdAt).toLocaleString('en-GB')}</p>

      {paymentOutcome === 'success' && (
        <div className="mb-6 rounded-lg bg-brand-green/15 border border-brand-green/40 text-brand-green px-4 py-3 text-sm font-medium">
          Payment successful - thank you!
        </div>
      )}
      {paymentOutcome === 'cancelled' && needsPayment && (
        <div className="mb-6 rounded-lg bg-yellow-500/15 border border-yellow-500/40 text-yellow-200 px-4 py-3 text-sm">
          <p className="font-medium mb-2">Payment was cancelled. Your order is still on hold.</p>
          <button
            onClick={payNow}
            disabled={createCheckoutSession.isPending}
            className="bg-brand-green text-white rounded px-4 py-1.5 text-sm font-semibold disabled:opacity-60"
          >
            {createCheckoutSession.isPending ? 'Redirecting...' : 'Try payment again'}
          </button>
        </div>
      )}
      {paymentOutcome === 'error' && needsPayment && (
        <div className="mb-6 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 px-4 py-3 text-sm">
          <p className="font-medium mb-2">We couldn't start the card payment for this order.</p>
          <button
            onClick={payNow}
            disabled={createCheckoutSession.isPending}
            className="bg-brand-green text-white rounded px-4 py-1.5 text-sm font-semibold disabled:opacity-60"
          >
            {createCheckoutSession.isPending ? 'Redirecting...' : 'Pay now'}
          </button>
        </div>
      )}
      {!paymentOutcome && needsPayment && (
        <div className="mb-6 rounded-lg bg-brand-cream/10 border border-brand-cream/20 px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
          <span>This order is still awaiting card payment.</span>
          <button
            onClick={payNow}
            disabled={createCheckoutSession.isPending}
            className="bg-brand-green text-white rounded px-4 py-1.5 text-sm font-semibold disabled:opacity-60"
          >
            {createCheckoutSession.isPending ? 'Redirecting...' : 'Pay now'}
          </button>
        </div>
      )}
      {payError && <p className="mb-6 text-sm text-red-400">{payError}</p>}

      {order.status === 'Cancelled' ? (
        <p className="text-red-400 font-medium mb-6">This order has been cancelled.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-8">
          {steps.map((step, i) => (
            <div
              key={step}
              className={`px-3 py-2 rounded text-xs sm:text-sm font-medium ${
                i <= currentIndex ? 'bg-brand-green text-white' : 'bg-brand-cream/10 text-brand-cream/50'
              }`}
            >
              {STEP_LABELS[step] ?? step}
            </div>
          ))}
        </div>
      )}

      <div className="bg-brand-cream text-brand-bg rounded-lg p-5">
        <h2 className="font-semibold mb-3">Order Summary</h2>
        <div className="divide-y divide-brand-bg/10 text-sm">
          {order.items.map((item, i) => (
            <div key={i} className="py-2">
              <div className="flex justify-between">
                <span>{item.quantity} x {item.nameSnapshot}</span>
                <span>{currency}{item.lineTotal.toFixed(2)}</span>
              </div>
              {item.modifiers.length > 0 && (
                <p className="text-brand-bg/60 text-xs mt-0.5">
                  {item.modifiers.map((m) => m.nameSnapshot).join(', ')}
                </p>
              )}
              {item.specialInstructions && (
                <p className="text-amber-700 text-xs mt-0.5 font-medium">{item.specialInstructions}</p>
              )}
            </div>
          ))}
        </div>
        {order.specialRequests && (
          <div className="mt-3 pt-3 border-t border-brand-bg/10 text-sm">
            <p className="text-brand-bg/60 text-xs font-semibold uppercase tracking-wide mb-1">Special requests</p>
            <p>{order.specialRequests}</p>
          </div>
        )}
        <div className="pt-3 mt-2 border-t border-brand-bg/10 font-semibold flex justify-between">
          <span>Total</span>
          <span>{currency}{order.totalAmount.toFixed(2)}</span>
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
