import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cart';
import { useCreateOrder } from '../lib/queries';
import type { CreateOrderRequest, PaymentMethod } from '../types/api';

export default function Checkout() {
  const navigate = useNavigate();
  const { orderType, lines, subtotal, clear } = useCartStore();
  const createOrder = useCreateOrder();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Card');
  const [error, setError] = useState<string | null>(null);

  const total = subtotal();

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
    } catch {
      setError('Something went wrong placing your order. Please check your details and try again.');
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
        <div className="bg-brand-cream text-brand-bg rounded-lg p-5 h-fit">
          <h2 className="font-semibold mb-3">Your order for {orderType === 'Delivery' ? 'Delivery' : 'Collection'}</h2>
          <div className="divide-y divide-brand-bg/10 text-sm">
            {lines.map((l) => (
              <div key={l.lineId} className="py-2 flex justify-between">
                <span>{l.quantity} x {l.menuItem.name}</span>
                <span>£{((l.menuItem.basePrice + l.selectedOptions.reduce((s, o) => s + o.priceDelta, 0)) * l.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="pt-3 mt-2 border-t border-brand-bg/10 font-semibold flex justify-between">
            <span>Total</span>
            <span>£{total.toFixed(2)}</span>
          </div>
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
            <h2 className="font-semibold mb-3">How do you want to pay?</h2>
            <div className="flex gap-3">
              {(['Card', 'Cash'] as PaymentMethod[]).map((method) => (
                <button
                  type="button"
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`flex-1 border rounded-lg py-4 text-sm font-medium ${
                    paymentMethod === method ? 'border-brand-green bg-brand-green/10' : 'border-brand-bg/20'
                  }`}
                >
                  {method}
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
            {createOrder.isPending ? 'Placing order...' : `Confirm and Place Order (£${total.toFixed(2)})`}
          </button>
        </div>
      </form>
    </div>
  );
}
