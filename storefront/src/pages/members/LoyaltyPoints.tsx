import { useLoyalty, useRestaurant } from '../../lib/queries';
import { currencySymbol } from '../../lib/currency';

export default function LoyaltyPoints() {
  const { data: loyalty } = useLoyalty();
  const { data: restaurant } = useRestaurant();
  const currency = currencySymbol(restaurant?.currency);
  const pointsPerCurrencyUnit = restaurant?.loyaltyPointsPerCurrencyUnit ?? 1;
  const points = loyalty?.pointsBalance ?? 0;
  const value = points * 0.01;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl mb-2">Loyalty Points</h1>

      <div className="rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-amber-600 to-yellow-400 p-6 flex items-center justify-between flex-wrap gap-4">
          <p className="text-white text-2xl font-display">You have:</p>
          <div className="flex gap-3">
            <div className="bg-white rounded px-6 py-3 text-center">
              <p className="text-2xl font-bold text-green-700">{points}</p>
              <p className="text-xs text-brand-bg/60">points</p>
            </div>
            <div className="bg-white rounded px-6 py-3 text-center">
              <p className="text-2xl font-bold text-red-600">{currency}{value.toFixed(2)}</p>
              <p className="text-xs text-brand-bg/60">value</p>
            </div>
          </div>
        </div>
        <div className="bg-brand-bg-light text-white text-sm px-6 py-2 flex items-center justify-between">
          <span>{restaurant?.name ?? 'Restaurant'} Loyalty Card ★</span>
        </div>
      </div>

      <div className="bg-brand-cream text-brand-bg rounded-lg p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg mb-1">How do I get loyalty points?</h2>
          <p className="text-sm text-brand-bg/70">
            For every {currency}1 you spend, you'll receive {pointsPerCurrencyUnit} point{pointsPerCurrencyUnit === 1 ? '' : 's'}.
            From time to time we may run promotions that let you earn more points.
          </p>
        </div>
        <div>
          <h2 className="font-display text-lg mb-1">How do I redeem my loyalty points?</h2>
          <p className="text-sm text-brand-bg/70">
            Every point is worth £0.01. You can start spending your points on your next order at checkout.
          </p>
        </div>
        <p className="text-xs text-brand-bg/50 pt-3 border-t border-brand-bg/10">
          Points are not redeemable for cash and can only be redeemed online. They cannot be transferred to another
          account. We reserve the right to withdraw or remove points if we suspect fraud or wish to stop the scheme.
        </p>
      </div>

      {loyalty && loyalty.recentTransactions.length > 0 && (
        <div className="bg-brand-cream text-brand-bg rounded-lg p-6">
          <h2 className="font-display text-lg mb-3">Recent Activity</h2>
          <div className="divide-y divide-brand-bg/10 text-sm">
            {loyalty.recentTransactions.map((t, i) => (
              <div key={i} className="py-2 flex items-center justify-between">
                <span>{t.reason}</span>
                <span className={t.pointsDelta >= 0 ? 'text-green-700' : 'text-red-600'}>
                  {t.pointsDelta >= 0 ? '+' : ''}{t.pointsDelta}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
