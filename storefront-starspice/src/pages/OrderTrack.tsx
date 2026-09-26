import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCreateCheckoutSession, useOrderStatuses, useRestaurant, useTrackOrder } from '@shared/lib/queries';
import { formatPrice, usePageTitle } from '../lib/site';

const STEP_LABELS: Record<string, string> = {
  Pending: 'Order placed',
  Confirmed: 'Confirmed',
  Preparing: 'Being prepared',
  Ready: 'Ready',
  OutForDeliveryOrServed: 'On its way',
  Completed: 'Completed',
};

export default function OrderTrack() {
  usePageTitle('Your order');
  const { orderId } = useParams<{ orderId: string }>();
  const [params] = useSearchParams();
  const { data: order, isLoading } = useTrackOrder(orderId);
  const { data: restaurant } = useRestaurant();
  const { data: statuses } = useOrderStatuses();
  const createCheckoutSession = useCreateCheckoutSession();
  const [payError, setPayError] = useState<string | null>(null);
  const currency = restaurant?.currency;
  const outcome = params.get('payment');

  if (isLoading) return <div className="wrap not-found"><p>Loading your order…</p></div>;
  if (!order) {
    return (
      <div className="wrap not-found">
        <p className="eyebrow">ORDER</p>
        <h1>Order not found.</h1>
        <Link className="button" to="/menu">Back to the menu <span aria-hidden="true">→</span></Link>
      </div>
    );
  }

  const cancelled = order.status === 'Cancelled';
  const steps = (statuses ?? []).filter((s) => s !== 'Cancelled');
  const current = steps.indexOf(order.status);
  const needsPayment = order.paymentMethod === 'Card' && order.paymentStatus !== 'Paid' && !cancelled;

  async function payNow() {
    if (!order) return;
    setPayError(null);
    try {
      const { checkoutUrl } = await createCheckoutSession.mutateAsync(order.id);
      window.location.href = checkoutUrl;
    } catch {
      setPayError('Could not start card payment. Please try again, or call us.');
    }
  }

  return (
    <>
      <div className="wrap page-intro menu-intro">
        <p className="eyebrow">ORDER #{order.orderNumber}</p>
        <h1>{cancelled ? 'Order cancelled.' : 'Thank you.'}</h1>
        <p>
          Placed {new Date(order.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
          {order.orderType === 'Delivery' ? 'Delivery' : 'Collection'}
          {order.estimatedReadyAt && !cancelled && (
            <> · Estimated {order.orderType === 'Delivery' ? 'delivery' : 'ready'} {new Date(order.estimatedReadyAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</>
          )}
        </p>
        {outcome === 'success' && order.paymentStatus === 'Paid' && (
          <div className="notice"><strong>Payment received.</strong> Thank you, your order is with the kitchen.</div>
        )}
        {needsPayment && (
          <div className="notice">
            <strong>{outcome === 'cancelled' ? 'Payment was cancelled.' : outcome === 'success' ? 'Confirming your payment…' : 'Payment not completed yet.'}</strong>{' '}
            {outcome === 'success'
              ? 'This usually takes a few seconds. Refresh the page if it doesn’t update.'
              : 'Your order is on hold until it’s paid.'}
            {outcome !== 'success' && (
              <div style={{ marginTop: 12 }}>
                <button type="button" className="button small" onClick={payNow} disabled={createCheckoutSession.isPending}>
                  Pay now <span aria-hidden="true">→</span>
                </button>
              </div>
            )}
            {payError && <p className="form-error">{payError}</p>}
          </div>
        )}
      </div>

      <div className="paper">
        <div className="wrap checkout-layout">
          <section>
            <h2 style={{ fontSize: '2rem' }}>Order progress</h2>
            {cancelled ? (
              <p style={{ marginTop: 16 }}>This order was cancelled. Please contact us if you have any questions.</p>
            ) : (
              <ol className="status-steps">
                {steps.map((s, i) => (
                  <li key={s} className={i < current ? 'done' : i === current ? 'current' : undefined}>
                    {STEP_LABELS[s] ?? s}
                  </li>
                ))}
              </ol>
            )}
          </section>
          <aside className="summary" aria-label="Order summary">
            <h2>Your order</h2>
            <ul className="basket-lines" style={{ maxHeight: 'none' }}>
              {order.items.map((item, i) => (
                <li key={i} className="basket-line">
                  <span className="basket-line-name">{item.quantity} × {item.nameSnapshot}</span>
                  <span className="basket-line-price">{formatPrice(item.lineTotal, currency)}</span>
                  {(item.modifiers.length > 0 || item.specialInstructions) && (
                    <span className="basket-line-opts">
                      {[...item.modifiers.map((m) => m.nameSnapshot), item.specialInstructions && `“${item.specialInstructions}”`].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="basket-totals">
              <div><span>Payment</span><span>{order.paymentMethod === 'Card' ? `Card · ${order.paymentStatus}` : 'Cash'}</span></div>
              <div className="grand"><span>Total</span><span>{formatPrice(order.totalAmount, currency)}</span></div>
            </div>
            <Link className="text-link" to="/menu">Back to the menu <span aria-hidden="true">→</span></Link>
          </aside>
        </div>
      </div>
    </>
  );
}
