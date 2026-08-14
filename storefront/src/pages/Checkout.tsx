import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cart';
import { useCreateOrder, useRestaurant } from '../lib/queries';
import { customerAuth } from '../lib/api';
import { currencySymbol } from '../lib/currency';
import type { CreateOrderRequest, PaymentMethod } from '../types/api';

export default function Checkout() {
  const navigate = useNavigate();
  const { orderType, lines, subtotal, clear, incrementLine, decrementLine } = useCartStore();
  const createOrder = useCreateOrder();
  const { data: restaurant } = useRestaurant();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Card');
  const [voucherCode, setVoucherCode] = useState('');
  const [showFeeInfo, setShowFeeInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawSubtotal = subtotal();
  const processingFee = restaurant
    ? Math.round((restaurant.processingFeeFlat + (rawSubtotal * restaurant.processingFeePercentage) / 100) * 100) / 100
    : 0;
  const estimatedTotal = rawSubtotal + processingFee;
  const estimatedLoyaltyPoints = restaurant ? Math.floor(estimatedTotal * restaurant.loyaltyPointsPerCurrencyUnit) : 0;
  const isMember = customerAuth.isLoggedIn();
  const currency = currencySymbol(restaurant?.currency);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const request: CreateOrderRequest = {
      orderType,
      customerName: name,
      customerPhone: phone,
      customerEmail: email || undefined,
      paymentMethod,
      specialRequests: specialRequests || undefined,
      voucherCode: voucherCode.trim() || undefined,
      deliveryAddress:
        orderType === 'Delivery' ? { line1: addressLine1, line2: addressLine2 || undefined, city, postcode } : undefined,
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
      navigate(`/order/${order.id}/track`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong placing your order. Please check your details and try again.');
    }
  }

  if (lines.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="mb-4">Your cart is empty.</p>
        <button onClick={() => navigate('/menu')} className="bg-brand-green text-white px-5 py-2.5 rounded">
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl sm:text-3xl mb-6">Checkout &ndash; Confirm your order</h1>

      <form onSubmit={handleSubmit} className="grid md:grid-cols-[1fr_1.4fr] gap-6">
        <div className="space-y-4">
          <div className="bg-brand-cream text-brand-bg rounded-lg p-5 h-fit">
            <h2 className="font-semibold mb-3">Your Order ({lines.length} item{lines.length === 1 ? '' : 's'})</h2>
            <div className="divide-y divide-brand-bg/10 text-sm">
              {lines.map((l) => (
                <div key={l.lineId} className="py-3 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-brand-bg/10 shrink-0">
                    {l.menuItem.imageUrl && (
                      <img src={l.menuItem.imageUrl} alt={l.menuItem.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{l.menuItem.name}</p>
                    {l.selectedOptions.map((o) => (
                      <p key={o.id} className="text-xs text-brand-bg/60 truncate">+{o.name}</p>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium">
                      {currency}{((l.menuItem.basePrice + l.selectedOptions.reduce((s, o) => s + o.priceDelta, 0)) * l.quantity).toFixed(2)}
                    </span>
                    <button type="button" onClick={() => decrementLine(l.lineId)} className="w-5 h-5 rounded bg-brand-bg/10 text-xs">−</button>
                    <span className="text-xs w-4 text-center">{l.quantity}</span>
                    <button type="button" onClick={() => incrementLine(l.lineId)} className="w-5 h-5 rounded bg-brand-bg/10 text-xs">+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-3 mt-2 border-t border-brand-bg/10 text-sm space-y-1.5">
              <div className="flex justify-between"><span>Subtotal</span><span>{currency}{rawSubtotal.toFixed(2)}</span></div>
              {processingFee > 0 && (
                <div className="flex justify-between items-center relative">
                  <span className="flex items-center gap-1">
                    Processing Fee
                    <button
                      type="button"
                      onClick={() => setShowFeeInfo((v) => !v)}
                      className="w-4 h-4 rounded-full bg-brand-bg/20 text-[10px] leading-4 text-center"
                      aria-label="What is a processing fee?"
                    >
                      ?
                    </button>
                  </span>
                  <span>{currency}{processingFee.toFixed(2)}</span>
                  {showFeeInfo && (
                    <div className="absolute left-0 top-6 z-10 w-64 bg-brand-bg text-brand-cream text-xs rounded-lg p-3 shadow-lg">
                      This fee applies to all orders to help cover the operational costs of handling your order online.
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between font-semibold pt-1.5 border-t border-brand-bg/10">
                <span>Total</span>
                <span>{currency}{estimatedTotal.toFixed(2)}</span>
              </div>
              {voucherCode.trim() && (
                <p className="text-xs text-brand-bg/60 pt-1">Voucher discount (if valid) applied when you place the order.</p>
              )}
            </div>
          </div>

          <div className="bg-brand-cream text-brand-bg rounded-lg p-5">
            <h2 className="font-semibold mb-3">Got a voucher or coupon code?</h2>
            <input
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              placeholder="Enter code here..."
              className="w-full rounded border border-brand-bg/20 px-3 py-2 text-sm uppercase"
            />
          </div>

          {restaurant && restaurant.loyaltyPointsPerCurrencyUnit > 0 && (
            <div className="bg-brand-green text-white rounded-lg p-5">
              <h2 className="font-semibold mb-1">Earn Loyalty Points</h2>
              {isMember ? (
                <p className="text-sm text-white/90">You'll earn approximately {estimatedLoyaltyPoints} points for this order.</p>
              ) : (
                <p className="text-sm text-white/90">
                  <a href="/account/register" className="underline font-medium">Register</a> or{' '}
                  <a href="/account/login" className="underline font-medium">sign in</a> to collect points with this order.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-brand-cream text-brand-bg rounded-lg p-5">
            <h2 className="font-semibold mb-3">Name and contact details</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
                className="rounded border border-brand-bg/20 px-3 py-2 text-sm sm:col-span-2" />
              <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Contact phone number"
                className="rounded border border-brand-bg/20 px-3 py-2 text-sm" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address"
                className="rounded border border-brand-bg/20 px-3 py-2 text-sm" />
            </div>

            {orderType === 'Delivery' && (
              <div className="grid sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-brand-bg/10">
                <input required value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Address line 1"
                  className="rounded border border-brand-bg/20 px-3 py-2 text-sm sm:col-span-2" />
                <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Address line 2 (optional)"
                  className="rounded border border-brand-bg/20 px-3 py-2 text-sm sm:col-span-2" />
                <input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Town/City"
                  className="rounded border border-brand-bg/20 px-3 py-2 text-sm" />
                <input required value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode"
                  className="rounded border border-brand-bg/20 px-3 py-2 text-sm" />
              </div>
            )}
          </div>

          <div className="bg-brand-cream text-brand-bg rounded-lg p-5">
            <h2 className="font-semibold mb-3">Payment Method</h2>
            <div className="space-y-2">
              {(['Card', 'Cash'] as PaymentMethod[]).map((method) => (
                <button
                  type="button"
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`w-full flex items-center justify-between border rounded-lg px-4 py-3 text-sm font-medium ${
                    paymentMethod === method ? 'border-brand-green bg-brand-green/10' : 'border-brand-bg/20'
                  }`}
                >
                  <span>{method === 'Card' ? 'Pay by Card' : 'Cash on ' + (orderType === 'Delivery' ? 'Delivery' : 'Collection')}</span>
                  <span
                    className={`w-4 h-4 rounded-full border-2 ${
                      paymentMethod === method ? 'border-brand-green bg-brand-green' : 'border-brand-bg/30'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-brand-cream text-brand-bg rounded-lg p-5">
            <h2 className="font-semibold mb-3">Any special requests or comments?</h2>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="Allergies, dietary requirements, delivery notes..."
              className="w-full rounded border border-brand-bg/20 px-3 py-2 text-sm h-20"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={createOrder.isPending}
            className="w-full bg-brand-green text-white rounded-lg py-3.5 font-semibold disabled:opacity-50"
          >
            {createOrder.isPending ? 'Placing order...' : `Confirm and Place Order (${currency}${estimatedTotal.toFixed(2)})`}
          </button>
        </div>
      </form>
    </div>
  );
}
