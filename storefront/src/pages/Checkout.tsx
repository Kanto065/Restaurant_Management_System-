import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useCartStore } from '../store/cart';
import { useCreateOrder, useRestaurant, useProfile, useLoyalty } from '../lib/queries';
import { api, customerAuth } from '../lib/api';
import { currencySymbol } from '../lib/currency';
import { CreditCard, Banknote, Check } from 'lucide-react';
import type { CreateOrderRequest, PaymentMethod } from '../types/api';

interface ValidateVoucherResponse {
  valid: boolean;
  discountAmount: number;
  message: string | null;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { orderType, lines, subtotal, clear, incrementLine, decrementLine } = useCartStore();
  const createOrder = useCreateOrder();
  const { data: restaurant } = useRestaurant();
  const isMember = customerAuth.isLoggedIn();
  const { data: profile } = useProfile();
  const { data: loyalty } = useLoyalty();

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
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discountAmount: number } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [showFeeInfo, setShowFeeInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Because you are logged in, we auto-fill the form for you.
  useEffect(() => {
    if (!profile) return;
    setName((prev) => prev || profile.fullName);
    setPhone((prev) => prev || profile.phone || '');
    setEmail((prev) => prev || profile.email);
    const defaultAddress = profile.addresses.find((a) => a.id === profile.defaultAddressId);
    if (defaultAddress) {
      setAddressLine1((prev) => prev || defaultAddress.line1);
      setAddressLine2((prev) => prev || defaultAddress.line2 || '');
      setCity((prev) => prev || defaultAddress.city);
      setPostcode((prev) => prev || defaultAddress.postcode);
    }
  }, [profile]);

  const rawSubtotal = subtotal();
  const processingFee = restaurant
    ? Math.round((restaurant.processingFeeFlat + (rawSubtotal * restaurant.processingFeePercentage) / 100) * 100) / 100
    : 0;

  const voucherDiscount = appliedVoucher?.discountAmount ?? 0;
  const afterVoucher = Math.max(0, rawSubtotal + processingFee - voucherDiscount);

  const pointsBalance = loyalty?.pointsBalance ?? 0;
  const pointsValue = pointsBalance * 0.01;
  const redeemableValue = Math.min(pointsValue, afterVoucher);
  const loyaltyDiscount = redeemPoints ? redeemableValue : 0;
  const discount = voucherDiscount + loyaltyDiscount;

  const validateVoucher = useMutation({
    mutationFn: (code: string) => api.post<ValidateVoucherResponse>('/api/public/vouchers/validate', { code, subtotal: rawSubtotal }),
    onSuccess: (res) => {
      if (res.valid) {
        setAppliedVoucher({ code: voucherCode.trim(), discountAmount: res.discountAmount });
        setVoucherError(null);
      } else {
        setAppliedVoucher(null);
        setVoucherError(res.message ?? "This voucher code isn't valid.");
      }
    },
    onError: () => { setAppliedVoucher(null); setVoucherError('Could not check this voucher right now. Please try again.'); },
  });

  const estimatedTotal = Math.max(0, rawSubtotal + processingFee - discount);
  const estimatedLoyaltyPoints = restaurant ? Math.floor(estimatedTotal * restaurant.loyaltyPointsPerCurrencyUnit) : 0;
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
      voucherCode: appliedVoucher?.code || undefined,
      redeemLoyaltyPoints: redeemPoints,
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl sm:text-3xl mb-6">Checkout &ndash; Confirm your order</h1>

      <form onSubmit={handleSubmit} className="grid md:grid-cols-[1fr_1.2fr_auto] gap-6">
        <div className="space-y-4">
          <div className="bg-brand-cream text-brand-bg rounded-lg p-5 h-fit">
            <h2 className="font-semibold mb-3">Your order for {orderType === 'Delivery' ? 'Delivery' : 'Collection'}</h2>
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
                      <p key={o.id} className="text-xs text-brand-green truncate">+{o.name}</p>
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
              <div className="flex justify-between"><span>Discount</span><span>-{currency}{discount.toFixed(2)}</span></div>
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
            </div>
            <button type="button" onClick={() => navigate('/menu')} className="w-full mt-3 bg-brand-orange text-white rounded-lg py-2.5 text-sm font-semibold">
              Go Back and Edit Your Order
            </button>
          </div>

          <div className="bg-brand-cream text-brand-bg rounded-lg p-5">
            <h2 className="font-semibold mb-3">Got a voucher, coupon or gift certificate?</h2>
            <div className="flex gap-2">
              <input
                value={voucherCode}
                onChange={(e) => {
                  setVoucherCode(e.target.value);
                  setAppliedVoucher(null);
                  setVoucherError(null);
                }}
                placeholder="Enter code here..."
                className="flex-1 min-w-0 rounded border border-brand-bg/20 px-3 py-2 text-sm uppercase"
              />
              <button
                type="button"
                disabled={!voucherCode.trim() || validateVoucher.isPending}
                onClick={() => validateVoucher.mutate(voucherCode.trim())}
                className="bg-brand-green text-white text-sm font-medium px-4 py-2 rounded shrink-0 disabled:opacity-50"
              >
                {validateVoucher.isPending ? 'Checking...' : 'Apply'}
              </button>
            </div>
            {appliedVoucher && (
              <p className="text-xs text-green-700 pt-2">
                "{appliedVoucher.code}" applied — {currency}{appliedVoucher.discountAmount.toFixed(2)} off.
              </p>
            )}
            {voucherError && <p className="text-xs text-red-600 pt-2">{voucherError}</p>}
          </div>

          {restaurant && restaurant.loyaltyPointsPerCurrencyUnit > 0 && (
            isMember ? (
              <div className="bg-brand-cream text-brand-bg rounded-lg p-5">
                <h2 className="font-semibold mb-3 flex items-center gap-1.5">🏆 Loyalty Points</h2>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-brand-bg text-brand-cream rounded p-3 text-center">
                    <p className="text-xl font-bold">{pointsBalance}</p>
                    <p className="text-xs text-brand-cream/60">Points</p>
                  </div>
                  <div className="bg-brand-bg text-brand-cream rounded p-3 text-center">
                    <p className="text-xl font-bold">{currency}{pointsValue.toFixed(2)}</p>
                    <p className="text-xs text-brand-cream/60">Value/Credit</p>
                  </div>
                </div>
                {pointsBalance > 0 && (
                  <label className="flex items-start gap-2 text-sm mb-2">
                    <input type="checkbox" checked={redeemPoints} onChange={(e) => setRedeemPoints(e.target.checked)} className="mt-0.5" />
                    <span>Do you want to redeem &amp; spend your points on this order?</span>
                  </label>
                )}
                <p className="text-xs text-brand-bg/60">You'll earn approximately {estimatedLoyaltyPoints} points for this order.</p>
              </div>
            ) : (
              <div className="bg-brand-green text-white rounded-lg p-5">
                <h2 className="font-semibold mb-1">Earn Loyalty Points</h2>
                <p className="text-sm text-white/90">
                  <a href="/account/members" className="underline font-medium">Register or sign in</a> to collect points with this order.
                </p>
              </div>
            )
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
            <p className="text-xs text-brand-bg/50 mt-2">Note: mobile number is preferred. It's important that you check the number.</p>

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
            <h2 className="font-semibold mb-3">How do you want to pay?</h2>
            <div className="grid grid-cols-2 gap-3">
              {(['Card', 'Cash'] as PaymentMethod[]).map((method) => (
                <button
                  type="button"
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`relative flex flex-col items-center gap-2.5 rounded-xl py-5 px-3 transition-colors ${
                    paymentMethod === method ? 'bg-brand-bg/10' : 'bg-black/5 hover:bg-black/[0.07]'
                  }`}
                >
                  {paymentMethod === method && (
                    <Check className="absolute bottom-2 right-2 w-4 h-4 text-brand-green" strokeWidth={3} />
                  )}
                  <span
                    className={`w-14 h-14 rounded-lg flex items-center justify-center ${
                      method === 'Card' ? 'bg-blue-500' : 'bg-green-600'
                    }`}
                  >
                    {method === 'Card' ? (
                      <CreditCard className="w-7 h-7 text-white" strokeWidth={1.75} />
                    ) : (
                      <Banknote className="w-7 h-7 text-white" strokeWidth={1.75} />
                    )}
                  </span>
                  <span className="text-sm font-medium">{method === 'Card' ? 'Card' : 'Cash'}</span>
                </button>
              ))}
            </div>
            {paymentMethod === 'Cash' && (
              <p className="text-xs text-brand-bg/60 mt-3">
                Cash on {orderType === 'Delivery' ? 'delivery' : 'collection'}.
              </p>
            )}
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

        {isMember && profile && (
          <div className="space-y-4 md:w-64">
            <div className="bg-brand-cream text-brand-bg rounded-lg p-5">
              <h2 className="font-semibold mb-2">Hi {profile.fullName.split(' ')[0]}.</h2>
              <p className="text-sm text-brand-bg/70 mb-3">
                Because you're logged in, we've automatically filled in the form for you. Please double check all the details are correct!
              </p>
              <p className="text-sm">
                Not {profile.fullName.split(' ')[0]}?{' '}
                <button
                  type="button"
                  onClick={() => { customerAuth.clear(); window.location.reload(); }}
                  className="bg-red-600 text-white rounded px-3 py-1.5 text-xs font-medium"
                >
                  Logout
                </button>
              </p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
