import { Link } from 'react-router-dom';
import { useCartStore } from '../store/cart';
import { useRestaurant } from '../lib/queries';
import { currencySymbol } from '../lib/currency';

export default function CartPanel() {
  const { lines, incrementLine, decrementLine, clear, subtotal } = useCartStore();
  const total = subtotal();
  const { data: restaurant } = useRestaurant();
  const currency = currencySymbol(restaurant?.currency);

  return (
    <div className="bg-brand-cream text-brand-bg rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-brand-bg/10">
        <h3 className="font-display text-xl">Your Order</h3>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-brand-bg/10">
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
            <div className="flex flex-col items-end gap-1 shrink-0">
              <p className="font-medium">
                {currency}{((line.menuItem.basePrice + line.selectedOptions.reduce((s, o) => s + o.priceDelta, 0)) * line.quantity).toFixed(2)}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => decrementLine(line.lineId)} className="w-6 h-6 rounded bg-red-500 text-white text-xs">−</button>
                <span>{line.quantity}</span>
                <button onClick={() => incrementLine(line.lineId)} className="w-6 h-6 rounded bg-brand-green text-white text-xs">+</button>
              </div>
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
        <Link
          to="/checkout"
          aria-disabled={lines.length === 0}
          onClick={(e) => lines.length === 0 && e.preventDefault()}
          className="flex-1 text-center bg-brand-green text-white rounded py-2 text-sm font-medium aria-disabled:opacity-40"
        >
          Checkout
        </Link>
      </div>
    </div>
  );
}
