import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LocateFixed, Loader2 } from 'lucide-react';
import { useCartStore } from '../store/cart';
import { useRestaurant } from '../lib/queries';
import { currencySymbol } from '../lib/currency';
import { looksLikePostcode, quoteFromMyLocation, tidyPostcode, useDeliveryInfo, useDeliveryQuote } from '../lib/delivery';

type Tone = 'dark' | 'light';

/** "Use my location" button: fills in the delivery postcode from the device's location. */
export function UseMyLocationButton({ tone, onFound }: { tone: Tone; onFound?: (postcode: string) => void }) {
  const setDeliveryPostcode = useCartStore((s) => s.setDeliveryPostcode);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = async () => {
    setBusy(true);
    setError(null);
    try {
      const quote = await quoteFromMyLocation();
      if (quote.postcode) {
        // Seed the postcode's quote so the status line shows at once, without asking again.
        queryClient.setQueryData(['public', 'delivery-quote', tidyPostcode(quote.postcode)], quote);
        setDeliveryPostcode(quote.postcode);
        onFound?.(quote.postcode);
      } else {
        setError(quote.message ?? "We couldn't find a postcode for your location - please type it instead.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please type your postcode instead.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={locate}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 text-sm font-medium underline-offset-2 hover:underline disabled:opacity-60 ${
          tone === 'dark' ? 'text-brand-mint' : 'text-brand-green'
        }`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
        {busy ? 'Finding you...' : 'Use my location'}
      </button>
      {error && <p className={`text-xs mt-1 ${tone === 'dark' ? 'text-red-300' : 'text-red-600'}`}>{error}</p>}
    </div>
  );
}

/** One line saying what delivery to this postcode costs (or why it isn't possible). */
export function DeliveryStatus({ postcode, tone, foodTotal }: { postcode: string; tone: Tone; foodTotal?: number }) {
  const { data: restaurant } = useRestaurant();
  const currency = currencySymbol(restaurant?.currency);
  const { data: quote, isFetching, isError } = useDeliveryQuote(postcode);
  const muted = tone === 'dark' ? 'text-brand-cream/70' : 'text-brand-bg/60';
  const bad = tone === 'dark' ? 'text-red-300' : 'text-red-600';
  const good = tone === 'dark' ? 'text-brand-mint' : 'text-green-700';

  if (!postcode.trim()) return null;
  if (quote && !quote.pricingEnabled) return null; // delivery charges switched off - nothing to say
  if (!looksLikePostcode(postcode)) return <p className={`text-xs ${muted}`}>Enter your full postcode to see the delivery charge.</p>;
  if (isFetching && !quote) return <p className={`text-xs ${muted} flex items-center gap-1`}><Loader2 className="w-3 h-3 animate-spin" />Checking delivery...</p>;
  if (isError || !quote) return <p className={`text-xs ${bad}`}>We couldn't check that postcode just now. Please try again.</p>;
  if (!quote.canDeliver) return <p className={`text-sm ${bad}`}>{quote.message}</p>;

  const short = foodTotal !== undefined ? quote.minimumOrderAmount - foodTotal : 0;
  return (
    <div className="text-sm">
      <p className={good}>
        Delivering to {quote.postcode}{quote.inZone ? ` (${quote.zoneName})` : ''}: <strong>{currency}{quote.deliveryFee.toFixed(2)}</strong> delivery
        {quote.minimumOrderAmount > 0 && <> · minimum order {currency}{quote.minimumOrderAmount.toFixed(2)}</>}
      </p>
      {short > 0.004 && (
        <p className={`text-xs mt-0.5 ${bad}`}>Add {currency}{short.toFixed(2)} more food to reach the delivery minimum.</p>
      )}
    </div>
  );
}

/** Postcode box + "Use my location" + live price, bound to the cart's delivery postcode. */
export default function DeliveryPostcodeBox({ tone, foodTotal }: { tone: Tone; foodTotal?: number }) {
  const { deliveryPostcode, setDeliveryPostcode } = useCartStore();
  const { data: info } = useDeliveryInfo();
  const [draft, setDraft] = useState(deliveryPostcode);
  // Follow changes made elsewhere (the home page's box, "Use my location", checkout).
  useEffect(() => setDraft(deliveryPostcode), [deliveryPostcode]);

  const commit = (value: string) => setDeliveryPostcode(tidyPostcode(value));

  // With delivery charges switched off there's no price to check.
  if (info && !info.pricingEnabled) return null;

  return (
    <div className="space-y-2">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); commit(draft); }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          onBlur={() => draft.trim() && commit(draft)}
          placeholder="Your postcode, e.g. SA1 8JF"
          aria-label="Delivery postcode"
          className={`w-44 rounded px-3 py-1.5 text-sm border ${
            tone === 'dark' ? 'bg-brand-cream text-brand-bg border-transparent' : 'border-brand-bg/20'
          }`}
        />
        <button type="submit" className="bg-brand-orange text-white rounded px-3 py-1.5 text-sm font-medium">Check</button>
        <UseMyLocationButton tone={tone} onFound={setDraft} />
      </form>
      <DeliveryStatus postcode={deliveryPostcode} tone={tone} foodTotal={foodTotal} />
    </div>
  );
}
