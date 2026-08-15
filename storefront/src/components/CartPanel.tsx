import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cart';
import { useRestaurant } from '../lib/queries';
import { currencySymbol } from '../lib/currency';

export default function CartPanel() {
  const { lines, orderType, setOrderType, incrementLine, decrementLine, clear, subtotal } = useCartStore();
  const total = subtotal();
  const { data: restaurant } = useRestaurant();
  const currency = currencySymbol(restaurant?.currency);
  const navigate = useNavigate();
  const [confirmingCheckout, setConfirmingCheckout] = useState(false);

  return (
    <div className="bg-brand-cream text-brand-bg rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-brand-bg/10">
        <h3 className="font-display text-xl">Your Order</h3>
      </div>

      <div className="divide-y divide-brand-bg/10">
        {lines.length === 0 && <p className="p-4 text-sm text-brand-bg/60">Your cart is empty.</p>}
        {lines.map((line) => (
          <div key={line.lineId} className="p-3 flex items-start justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium truncate">{line.quantity} x {line.menuItem.name}</p>
              {line.selectedOptions.map((o) => (
                <p key={o.id} className="text-xs text-brand-green truncate">+{o.name}</p>
              ))}
              {line.specialInstructions && (
                <p className="text-xs text-brand-bg/50 truncate italic">"{line.specialInstructions}"</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <p className="font-medium">
                {currency}{((line.menuItem.basePrice + line.selectedOptions.reduce((s, o) => s + o.priceDelta, 0)) * line.quantity).toFixed(2)}
              </p>
              <button onClick={() => decrementLine(line.lineId)} className="w-6 h-6 rounded bg-red-500 text-white text-xs">−</button>
              <span>{line.quantity}</span>
              <button onClick={() => incrementLine(line.lineId)} className="w-6 h-6 rounded bg-brand-green text-white text-xs">+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-brand-bg/10 flex items-center justify-between text-sm font-semibold">
        <span>Subtotal:</span>
        <span>{currency}{total.toFixed(2)}</span>
      </div>

      <div className="p-3 flex gap-2">
        <button
          onClick={clear}
          disabled={lines.length === 0}
          className="flex-1 bg-red-600 text-white rounded py-2 text-sm font-medium disabled:opacity-40"
        >
          Clear All
        </button>
        <button
          type="button"
          disabled={lines.length === 0}
          onClick={() => setConfirmingCheckout(true)}
          className="flex-1 text-center bg-brand-green text-white rounded py-2 text-sm font-medium disabled:opacity-40"
        >
          Checkout
        </button>
      </div>

      {confirmingCheckout && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
          onClick={() => setConfirmingCheckout(false)}
        >
          <div
            className="bg-brand-bg text-brand-cream w-full sm:max-w-sm sm:rounded-lg overflow-hidden p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg mb-1">Confirm your order type</h3>
            <p className="text-sm text-brand-cream/70 mb-4">
              You're ordering for <span className="text-brand-mint font-semibold">{orderType === 'Delivery' ? 'Home Delivery' : 'Collection'}</span>. Is that right?
            </p>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setOrderType('Collection')}
                className={`flex-1 rounded py-2 text-sm font-medium ${orderType === 'Collection' ? 'bg-brand-green text-white' : 'bg-brand-mint/20 text-brand-cream'}`}
              >
                Collection
              </button>
              <button
                type="button"
                onClick={() => setOrderType('Delivery')}
                className={`flex-1 rounded py-2 text-sm font-medium ${orderType === 'Delivery' ? 'bg-brand-orange text-white' : 'bg-brand-mint/20 text-brand-cream'}`}
              >
                Home Delivery
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingCheckout(false)}
                className="flex-1 rounded py-2 text-sm font-medium border border-brand-cream/30 text-brand-cream"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => navigate('/checkout')}
                className="flex-1 rounded py-2 text-sm font-semibold bg-brand-orange text-white"
              >
                Confirm & Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
