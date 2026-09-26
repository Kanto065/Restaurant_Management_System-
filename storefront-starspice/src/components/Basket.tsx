import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RestaurantPublic } from '@shared/types/api';
import { useCartStore, type CartLine } from '@shared/store/cart';
import { formatPrice } from '../lib/site';

export function lineTotal(line: CartLine): number {
  return (line.menuItem.basePrice + line.selectedOptions.reduce((s, o) => s + o.priceDelta, 0)) * line.quantity;
}

/** Keeps the chosen order type valid for what the restaurant currently accepts. */
export function useValidOrderType(restaurant: RestaurantPublic | undefined) {
  const { orderType, setOrderType } = useCartStore();
  useEffect(() => {
    if (!restaurant) return;
    if (orderType === 'Delivery' && !restaurant.supportsDelivery && restaurant.supportsCollection) setOrderType('Collection');
    if (orderType !== 'Delivery' && !restaurant.supportsCollection && restaurant.supportsDelivery) setOrderType('Delivery');
    if (orderType === 'DineIn') setOrderType(restaurant.supportsCollection ? 'Collection' : 'Delivery');
  }, [restaurant, orderType, setOrderType]);
}

export function BasketLines({ currency, editable = true }: { currency: string | undefined; editable?: boolean }) {
  const { lines, incrementLine, decrementLine } = useCartStore();
  return (
    <ul className="basket-lines">
      {lines.map((l) => (
        <li key={l.lineId} className="basket-line">
          <span className="basket-line-name">{l.menuItem.name}</span>
          <span className="basket-line-price">{formatPrice(lineTotal(l), currency)}</span>
          {(l.selectedOptions.length > 0 || l.specialInstructions) && (
            <span className="basket-line-opts">
              {[...l.selectedOptions.map((o) => o.name), l.specialInstructions && `“${l.specialInstructions}”`].filter(Boolean).join(' · ')}
            </span>
          )}
          {editable ? (
            <span className="qty" aria-label={`Quantity of ${l.menuItem.name}`}>
              <button type="button" aria-label={`Remove one ${l.menuItem.name}`} onClick={() => decrementLine(l.lineId)}>−</button>
              <span>{l.quantity}</span>
              <button type="button" aria-label={`Add one ${l.menuItem.name}`} onClick={() => incrementLine(l.lineId)}>+</button>
            </span>
          ) : (
            <span className="basket-line-opts">× {l.quantity}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function BasketBody({ restaurant, onCheckout }: { restaurant: RestaurantPublic; onCheckout: () => void }) {
  const { lines, orderType, setOrderType } = useCartStore();
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const both = restaurant.supportsCollection && restaurant.supportsDelivery;

  return (
    <>
      <h2>Your order</h2>
      {both ? (
        <div className="order-type" role="group" aria-label="Collection or delivery">
          <button type="button" aria-pressed={orderType === 'Collection'} onClick={() => setOrderType('Collection')}>Collection</button>
          <button type="button" aria-pressed={orderType === 'Delivery'} onClick={() => setOrderType('Delivery')}>Delivery</button>
        </div>
      ) : (
        <p className="basket-note">{restaurant.supportsDelivery ? 'Delivery only' : 'Collection only'}</p>
      )}

      {lines.length === 0 ? (
        <p className="basket-empty">Your basket is empty. Add a dish from the menu to get started.</p>
      ) : (
        <>
          <BasketLines currency={restaurant.currency} />
          <div className="basket-totals">
            <div className="grand"><span>Subtotal</span><span>{formatPrice(subtotal, restaurant.currency)}</span></div>
          </div>
          <button type="button" className="button full" onClick={onCheckout}>
            Checkout <span className="arrow" aria-hidden="true">→</span>
          </button>
          <p className="basket-note">
            {orderType === 'Delivery' ? 'Delivery charge and any fees are shown at checkout.' : 'Any fees are shown at checkout.'}
          </p>
        </>
      )}
    </>
  );
}

/** Desktop: sticky panel beside the menu. Phones/tablets: a bottom bar that opens a sheet. */
export default function Basket({ restaurant }: { restaurant: RestaurantPublic }) {
  const navigate = useNavigate();
  const lines = useCartStore((s) => s.lines);
  const [sheetOpen, setSheetOpen] = useState(false);
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  useValidOrderType(restaurant);

  useEffect(() => {
    document.body.classList.toggle('has-basket-bar', count > 0);
    return () => document.body.classList.remove('has-basket-bar');
  }, [count]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheetOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  const checkout = () => { setSheetOpen(false); navigate('/checkout'); };

  return (
    <>
      <aside className="basket" aria-label="Your order">
        <BasketBody restaurant={restaurant} onCheckout={checkout} />
      </aside>

      {count > 0 && (
        <button type="button" className="basket-bar" onClick={() => setSheetOpen(true)}>
          <span>View basket ({count})</span>
          <span>{formatPrice(subtotal, restaurant.currency)}</span>
        </button>
      )}

      {sheetOpen && (
        <div className="basket-sheet" onMouseDown={(e) => { if (e.target === e.currentTarget) setSheetOpen(false); }}>
          <div className="basket" role="dialog" aria-modal="true" aria-label="Your order">
            <button type="button" className="sheet-close" aria-label="Close basket" onClick={() => setSheetOpen(false)}>✕</button>
            <BasketBody restaurant={restaurant} onCheckout={checkout} />
          </div>
        </div>
      )}
    </>
  );
}
