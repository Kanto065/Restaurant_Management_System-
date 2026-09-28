import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '@shared/store/cart';
import { useCreateCheckoutSession, useCreateOrder, useLoyalty, useProfile, useRestaurant } from '@shared/lib/queries';
import { api, customerAuth } from '@shared/lib/api';
import { looksLikePostcode, quoteFromMyLocation, tidyPostcode, useDeliveryQuote } from '@shared/lib/delivery';
import type { CreateOrderRequest, PaymentMethod } from '@shared/types/api';
import { BasketLines, lineTotal, useValidOrderType } from '../components/Basket';
import { formatPrice, GUEST_KEY, isOrderingOpen, usePageTitle } from '../lib/site';

interface ValidateVoucherResponse {
  valid: boolean;
  discountAmount: number;
  message: string | null;
}

export default function Checkout() {
  usePageTitle('Checkout');
  const navigate = useNavigate();
  const { orderType, setOrderType, lines, clear, deliveryPostcode: postcode, setDeliveryPostcode: setPostcode } = useCartStore();
  const queryClient = useQueryClient();
  const { data: restaurant } = useRestaurant();
  const isMember = customerAuth.isLoggedIn();
  const { data: profile } = useProfile();
  const { data: loyalty } = useLoyalty();
  const createOrder = useCreateOrder();
  const createCheckoutSession = useCreateCheckoutSession();
  useValidOrderType(restaurant);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Card');
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discountAmount: number } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Remembered for this browser tab, so going back to the menu doesn't ask again.
  const [guestChosen, setGuestChosen] = useState(() => {
    try { return sessionStorage.getItem(GUEST_KEY) === '1'; } catch { return false; }
  });
  const chooseGuest = () => {
    try { sessionStorage.setItem(GUEST_KEY, '1'); } catch { /* private mode - just this visit */ }
    setGuestChosen(true);
  };

  const cardAvailable = restaurant?.cardPaymentsAvailable !== false;
  useEffect(() => { if (!cardAvailable) setPaymentMethod('Cash'); }, [cardAvailable]);

  // Signed-in members: prefill from their profile and default address.
  useEffect(() => {
    if (!profile) return;
    setName((p) => p || profile.fullName);
    setPhone((p) => p || profile.phone || '');
    setEmail((p) => p || profile.email);
    const address = profile.addresses.find((a) => a.id === profile.defaultAddressId);
    if (address) {
      setLine1((p) => p || address.line1);
      setLine2((p) => p || address.line2 || '');
      setCity((p) => p || address.city);
      if (!useCartStore.getState().deliveryPostcode) setPostcode(address.postcode);
    }
  }, [profile, setPostcode]);

  const currency = restaurant?.currency;
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const processingFee = restaurant
    ? Math.round((restaurant.processingFeeFlat + (subtotal * restaurant.processingFeePercentage) / 100) * 100) / 100
    : 0;
  const isDelivery = orderType === 'Delivery';
  const { data: deliveryQuote, isFetching: checkingDelivery, isError: deliveryCheckFailed } = useDeliveryQuote(postcode, isDelivery);
  const deliveryFee = isDelivery && deliveryQuote?.canDeliver ? deliveryQuote.deliveryFee : 0;
  const voucherDiscount = appliedVoucher?.discountAmount ?? 0;
  const afterVoucher = Math.max(0, subtotal + deliveryFee + processingFee - voucherDiscount);

  // The same rules the server applies when the order is placed. Minimum = food after voucher.
  const foodAfterVoucher = subtotal - voucherDiscount;
  const deliveryBlocker = !isDelivery
    ? null
    : !deliveryQuote
      ? (deliveryCheckFailed ? 'We couldn’t check your postcode just now. Please try again.'
        : checkingDelivery ? 'Checking your delivery address…' : 'Enter your postcode so we can work out the delivery charge.')
      : !deliveryQuote.canDeliver
        ? deliveryQuote.message ?? 'Sorry, we can’t deliver to this address.'
        : foodAfterVoucher < deliveryQuote.minimumOrderAmount
          ? `The minimum order for delivery is ${formatPrice(deliveryQuote.minimumOrderAmount, restaurant?.currency)} of food.`
          : null;

  const useMyLocation = async () => {
    setLocating(true);
    setLocateError(null);
    try {
      const quote = await quoteFromMyLocation();
      if (quote.postcode) {
        queryClient.setQueryData(['public', 'delivery-quote', tidyPostcode(quote.postcode)], quote);
        setPostcode(quote.postcode);
      } else {
        setLocateError(quote.message ?? 'We couldn’t find a postcode for your location. Please type it instead.');
      }
    } catch (e) {
      setLocateError(e instanceof Error ? e.message : 'Please type your postcode instead.');
    } finally {
      setLocating(false);
    }
  };
  const pointsBalance = loyalty?.pointsBalance ?? 0;
  const redeemableValue = Math.min(pointsBalance * 0.01, afterVoucher);
  const loyaltyDiscount = redeemPoints ? redeemableValue : 0;
  const estimatedTotal = Math.max(0, afterVoucher - loyaltyDiscount);

  const validateVoucher = useMutation({
    mutationFn: (code: string) => api.post<ValidateVoucherResponse>('/api/public/vouchers/validate', { code, subtotal }),
    onSuccess: (res) => {
      if (res.valid) {
        setAppliedVoucher({ code: voucherCode.trim(), discountAmount: res.discountAmount });
        setVoucherError(null);
      } else {
        setAppliedVoucher(null);
        setVoucherError(res.message ?? 'This voucher code isn’t valid.');
      }
    },
    onError: () => { setAppliedVoucher(null); setVoucherError('Could not check this voucher right now. Please try again.'); },
  });

  if (restaurant && !isOrderingOpen(restaurant)) {
    return (
      <div className="wrap not-found">
        <p className="eyebrow">ORDERING</p>
        <h1>Not open for orders yet.</h1>
        <p>We’re preparing to reopen. Have a look at the menu in the meantime.</p>
        <Link className="button" to="/menu">View the menu <span aria-hidden="true">→</span></Link>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="wrap not-found">
        <p className="eyebrow">CHECKOUT</p>
        <h1>Your basket is empty.</h1>
        <p>Add a few dishes from the menu first.</p>
        <Link className="button" to="/menu">Back to the menu <span aria-hidden="true">→</span></Link>
      </div>
    );
  }

  // Customers who aren't signed in choose first: sign in (or create an account) for saved
  // details and loyalty points, or carry on as a guest. Signed-in customers skip this.
  if (!isMember && !guestChosen) {
    return (
      <>
        <div className="wrap page-intro menu-intro">
          <p className="eyebrow">CHECKOUT</p>
          <h1>How would you like to order?</h1>
          <p>Sign in to use your saved details and collect loyalty points, or order as a guest - no account needed.</p>
        </div>
        <div className="paper">
          <div className="wrap checkout-choice">
            <section className="choice-card">
              <p className="eyebrow">MEMBERS</p>
              <h2>Sign in or create an account</h2>
              <p>Your details and addresses are filled in for you, and every order earns loyalty points.</p>
              <div className="choice-actions">
                <Link className="button" to="/sign-in?next=/checkout">Sign in <span aria-hidden="true">→</span></Link>
                <Link className="button ghost" to="/sign-in?next=/checkout#register">Create an account</Link>
              </div>
            </section>
            <section className="choice-card guest">
              <p className="eyebrow">GUEST</p>
              <h2>Order as a guest</h2>
              <p>Just add your name, number and address at the next step. You can create an account another time.</p>
              <div className="choice-actions">
                <button type="button" className="button" onClick={chooseGuest}>Continue as guest <span aria-hidden="true">→</span></button>
              </div>
            </section>
          </div>
        </div>
      </>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (deliveryBlocker) {
      setError(deliveryBlocker);
      return;
    }
    setSubmitting(true);

    const request: CreateOrderRequest = {
      orderType,
      customerName: name,
      customerPhone: phone,
      customerEmail: email || undefined,
      paymentMethod,
      specialRequests: specialRequests || undefined,
      voucherCode: appliedVoucher?.code || undefined,
      redeemLoyaltyPoints: redeemPoints,
      deliveryAddress: orderType === 'Delivery' ? { line1, line2: line2 || undefined, city, postcode } : undefined,
      items: lines.map((l) => ({
        menuItemId: l.menuItem.id,
        quantity: l.quantity,
        selectedModifierOptionIds: l.selectedOptions.map((o) => o.id),
        specialInstructions: l.specialInstructions,
      })),
    };

    try {
      const order = await createOrder.mutateAsync(request);
      clear();
      if (paymentMethod === 'Card') {
        try {
          const { checkoutUrl } = await createCheckoutSession.mutateAsync(order.id);
          window.location.href = checkoutUrl;
          return;
        } catch {
          // The order exists - land on tracking with a way to retry the payment.
          navigate(`/order/${order.id}/track?payment=error`);
          return;
        }
      }
      navigate(`/order/${order.id}/track`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong placing your order. Please check your details and try again.');
      setSubmitting(false);
    }
  }

  const both = restaurant?.supportsCollection && restaurant?.supportsDelivery;

  return (
    <>
      <div className="wrap page-intro menu-intro">
        <p className="eyebrow">CHECKOUT</p>
        <h1>Nearly there.</h1>
        <p>Check your order, add your details and choose how to pay.</p>
      </div>

      <div className="paper">
        <form className="wrap checkout-layout" onSubmit={handleSubmit}>
          <div>
            <section className="checkout-section">
              <h2>Collection or delivery</h2>
              {both ? (
                <div className="pay-options">
                  <label className="pay-option">
                    <input type="radio" name="orderType" checked={orderType === 'Collection'} onChange={() => setOrderType('Collection')} />
                    Collection
                  </label>
                  <label className="pay-option">
                    <input type="radio" name="orderType" checked={orderType === 'Delivery'} onChange={() => setOrderType('Delivery')} />
                    Delivery
                  </label>
                </div>
              ) : (
                <p>{orderType === 'Delivery' ? 'We’ll deliver your order.' : 'Collect your order from the takeaway.'}</p>
              )}
            </section>

            <section className="checkout-section">
              <h2>Your details</h2>
              {!isMember && (
                <p className="small" style={{ color: '#636456', marginBottom: 18 }}>
                  Have an account? <Link to="/sign-in?next=/checkout" style={{ textDecoration: 'underline' }}>Sign in</Link> to use saved details and earn loyalty points.
                </p>
              )}
              <div className="form-grid">
                <label className="field span-2"><span>Full name</span>
                  <input type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} /></label>
                <label className="field"><span>Mobile number</span>
                  <input type="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
                <label className="field"><span>Email (for your receipt)</span>
                  <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              </div>
            </section>

            {orderType === 'Delivery' && (
              <section className="checkout-section">
                <h2>Delivery address</h2>
                <div className="form-grid">
                  <label className="field span-2"><span>Address line 1</span>
                    <input type="text" autoComplete="address-line1" required value={line1} onChange={(e) => setLine1(e.target.value)} /></label>
                  <label className="field span-2"><span>Address line 2 (optional)</span>
                    <input type="text" autoComplete="address-line2" value={line2} onChange={(e) => setLine2(e.target.value)} /></label>
                  <label className="field"><span>Town</span>
                    <input type="text" autoComplete="address-level2" required value={city} onChange={(e) => setCity(e.target.value)} /></label>
                  <label className="field"><span>Postcode</span>
                    <input type="text" autoComplete="postal-code" required value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} /></label>
                  <div className="span-2">
                    <button type="button" className="link-button" onClick={useMyLocation} disabled={locating}>
                      {locating ? 'Finding you…' : 'Use my location'}
                    </button>
                    {locateError && <p className="form-error">{locateError}</p>}
                    {looksLikePostcode(postcode) && deliveryQuote && (
                      deliveryQuote.canDeliver ? (
                        <p className="form-success">
                          Delivery to {deliveryQuote.postcode}{deliveryQuote.inZone ? ` (${deliveryQuote.zoneName})` : ''}: {formatPrice(deliveryQuote.deliveryFee, currency)}
                          {deliveryQuote.minimumOrderAmount > 0 && <> · minimum order {formatPrice(deliveryQuote.minimumOrderAmount, currency)}</>}
                        </p>
                      ) : (
                        <p className="form-error">{deliveryQuote.message}</p>
                      )
                    )}
                  </div>
                </div>
              </section>
            )}

            <section className="checkout-section">
              <h2>Anything we should know?</h2>
              <label className="field"><span>Order notes, including allergies (optional)</span>
                <textarea rows={3} maxLength={500} value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} /></label>
            </section>

            <section className="checkout-section" style={{ borderBottom: 0 }}>
              <h2>Payment</h2>
              <div className="pay-options">
                {cardAvailable && (
                  <label className="pay-option">
                    <input type="radio" name="payment" checked={paymentMethod === 'Card'} onChange={() => setPaymentMethod('Card')} />
                    Pay by card
                  </label>
                )}
                <label className="pay-option">
                  <input type="radio" name="payment" checked={paymentMethod === 'Cash'} onChange={() => setPaymentMethod('Cash')} />
                  {orderType === 'Delivery' ? 'Cash on delivery' : 'Pay on collection'}
                </label>
              </div>
              {paymentMethod === 'Card' && (
                <p className="small" style={{ color: '#636456', marginTop: 12 }}>You’ll be taken to our secure card payment page (Stripe) to finish.</p>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
            </section>
          </div>

          <aside className="summary" aria-label="Order summary">
            <h2>Your order</h2>
            <BasketLines currency={currency} />
            <p style={{ marginTop: 8 }}><Link to="/menu" className="link-button">Edit basket</Link></p>

            <div style={{ marginTop: 20 }}>
              <label className="field"><span>Voucher code</span></label>
              <div className="voucher-row">
                <input type="text" aria-label="Voucher code" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value)} />
                <button type="button" className="button ghost small" disabled={!voucherCode.trim() || validateVoucher.isPending}
                  onClick={() => validateVoucher.mutate(voucherCode.trim())}>Apply</button>
              </div>
              {voucherError && <p className="form-error">{voucherError}</p>}
              {appliedVoucher && <p className="form-success">Voucher {appliedVoucher.code} applied.</p>}
            </div>

            {isMember && pointsBalance > 0 && (
              <label className="check" style={{ marginTop: 16 }}>
                <input type="checkbox" checked={redeemPoints} onChange={(e) => setRedeemPoints(e.target.checked)} />
                Use {pointsBalance} loyalty points (−{formatPrice(redeemableValue, currency)})
              </label>
            )}

            <div className="basket-totals">
              <div><span>Subtotal</span><span>{formatPrice(subtotal, currency)}</span></div>
              {processingFee > 0 && <div><span>Service fee</span><span>{formatPrice(processingFee, currency)}</span></div>}
              {voucherDiscount > 0 && <div><span>Voucher</span><span>−{formatPrice(voucherDiscount, currency)}</span></div>}
              {loyaltyDiscount > 0 && <div><span>Loyalty points</span><span>−{formatPrice(loyaltyDiscount, currency)}</span></div>}
              {isDelivery && (
                <div><span>Delivery</span><span>{deliveryQuote?.canDeliver ? formatPrice(deliveryFee, currency) : '—'}</span></div>
              )}
              <div className="grand"><span>Estimated total</span><span>{formatPrice(estimatedTotal, currency)}</span></div>
            </div>
            {!error && deliveryBlocker && <p className="form-error">{deliveryBlocker}</p>}
            <button type="submit" className="button full" disabled={submitting || !!deliveryBlocker}>
              {submitting ? 'Placing your order…' : paymentMethod === 'Card' ? 'Continue to payment' : 'Place order'}
              <span className="arrow" aria-hidden="true">→</span>
            </button>
            <p className="basket-note" style={{ color: '#595a4e' }}>
              Your final total is confirmed on the next page.
            </p>
          </aside>
        </form>
      </div>
    </>
  );
}
