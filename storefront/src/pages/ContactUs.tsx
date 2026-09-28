import { useRestaurant } from '../lib/queries';
import { currencySymbol } from '../lib/currency';
import { useDeliveryInfo } from '../lib/delivery';
import MandalaAccent from '../components/MandalaAccent';
import DeliveryPostcodeBox from '../components/DeliveryCheck';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime(t: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${m ? `:${m.toString().padStart(2, '0')}` : ''}${period}`;
}

export default function ContactUs() {
  const { data: restaurant } = useRestaurant();
  const { data: deliveryInfo } = useDeliveryInfo();
  // One row per price, listing every area charged it (Hafod, Marina, St Thomas... all £2.00).
  const priceRows = Object.values(
    (deliveryInfo?.zones ?? []).reduce<Record<string, { fee: number; min: number; areas: string[] }>>((rows, z) => {
      const key = `${z.deliveryFee}|${z.minimumOrderAmount}`;
      rows[key] ??= { fee: z.deliveryFee, min: z.minimumOrderAmount, areas: [] };
      if (!rows[key].areas.includes(z.name)) rows[key].areas.push(z.name);
      return rows;
    }, {}),
  ).sort((a, b) => a.fee - b.fee || a.min - b.min);
  const currency = currencySymbol(restaurant?.currency);

  const today = new Date().getDay();
  const fullAddress = restaurant
    ? [restaurant.addressLine1, restaurant.addressLine2, restaurant.city, restaurant.postcode].filter(Boolean).join(', ')
    : '';

  return (
    <>
      <MandalaAccent position="bottom-right" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        <div className="rounded-lg overflow-hidden aspect-video bg-brand-cream">
          {fullAddress && (
            <iframe
              title="Restaurant location"
              className="w-full h-full border-0"
              loading="lazy"
              src={`https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`}
            />
          )}
        </div>

        {deliveryInfo && restaurant?.supportsDelivery && (priceRows.length > 0 || deliveryInfo.outsideZoneFee !== null) && (
          <div className="bg-brand-green rounded-lg overflow-hidden">
            <h2 className="font-display text-xl text-white px-5 py-3">Delivery Information</h2>
            <div className="bg-brand-cream text-brand-bg p-5">
              <p className="text-sm mb-3">We deliver up to {deliveryInfo.maxDeliveryMiles} miles away. The charge depends on your area:</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-brand-bg/10">
                    <th className="pb-2 font-medium">Area</th>
                    <th className="pb-2 pl-3 font-medium whitespace-nowrap">Minimum Order *</th>
                    <th className="pb-2 pl-3 font-medium whitespace-nowrap">Delivery Charge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-bg/10">
                  {priceRows.map((row) => (
                    <tr key={`${row.fee}|${row.min}`}>
                      <td className="py-2">{row.areas.join(', ')}</td>
                      <td className="py-2 pl-3">{currency}{row.min.toFixed(2)}</td>
                      <td className="py-2 pl-3">{currency}{row.fee.toFixed(2)}</td>
                    </tr>
                  ))}
                  {deliveryInfo.outsideZoneFee !== null && (
                    <tr>
                      <td className="py-2">Anywhere else within {deliveryInfo.maxDeliveryMiles} miles</td>
                      <td className="py-2 pl-3">{currency}{(deliveryInfo.outsideZoneMinimumOrder ?? 0).toFixed(2)}</td>
                      <td className="py-2 pl-3">{currency}{deliveryInfo.outsideZoneFee.toFixed(2)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="text-xs text-brand-bg/60 mt-3">
                * you must spend at least this amount on the items, after discount, excluding any delivery or processing fees.
              </p>
              <div className="mt-4 pt-4 border-t border-brand-bg/10">
                <p className="text-sm font-medium mb-2">Check your postcode</p>
                <DeliveryPostcodeBox tone="light" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-brand-green rounded-lg overflow-hidden">
          <h2 className="font-display text-xl text-white px-5 py-3">Company Information</h2>
          <div className="bg-brand-cream text-brand-bg p-5 space-y-3 text-sm">
            <p className="font-semibold">{restaurant?.name}</p>
            <div>
              <p className="font-medium">Our Address</p>
              <p>{restaurant?.addressLine1}</p>
              {restaurant?.addressLine2 && <p>{restaurant.addressLine2}</p>}
              <p>{restaurant?.city}</p>
              <p>{restaurant?.postcode}</p>
            </div>
            <div>
              <p className="font-medium">Our Contact Information</p>
              {restaurant?.phone && <p>{restaurant.phone}</p>}
              {restaurant?.email && <a href={`mailto:${restaurant.email}`} className="underline">{restaurant.email}</a>}
            </div>
          </div>
        </div>

        <div className="bg-brand-green rounded-lg overflow-hidden">
          <h2 className="font-display text-xl text-white px-5 py-3">Opening Hours</h2>
          <div className="bg-brand-cream text-brand-bg divide-y divide-brand-bg/10">
            {DAY_NAMES.map((day, i) => {
              const hour = restaurant?.openingHours.find((h) => h.dayOfWeek === DAY_NAMES[i]);
              const isToday = i === today;
              return (
                <div key={i} className={`flex justify-between px-4 py-2.5 text-sm ${isToday ? 'bg-brand-orange text-white font-semibold' : ''}`}>
                  <span>{day}</span>
                  <span>{hour?.isClosed || !hour ? 'Closed' : `${formatTime(hour.openTime)} – ${formatTime(hour.closeTime)}`}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
