import { useRestaurant, useDeliveryZones } from '../lib/queries';
import { currencySymbol } from '../lib/currency';

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
  const { data: deliveryZones } = useDeliveryZones();
  const currency = currencySymbol(restaurant?.currency);

  const today = new Date().getDay();
  const fullAddress = restaurant
    ? [restaurant.addressLine1, restaurant.addressLine2, restaurant.city, restaurant.postcode].filter(Boolean).join(', ')
    : '';

  return (
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

        {deliveryZones && deliveryZones.length > 0 && (
          <div className="bg-brand-green rounded-lg overflow-hidden">
            <h2 className="font-display text-xl text-white px-5 py-3">Delivery Information</h2>
            <div className="bg-brand-cream text-brand-bg p-5">
              <p className="text-sm mb-3">We offer home delivery under the following order conditions:</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-brand-bg/10">
                    <th className="pb-2 font-medium">Mileage</th>
                    <th className="pb-2 font-medium">Minimum Order *</th>
                    <th className="pb-2 font-medium">Delivery Charge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-bg/10">
                  {deliveryZones.map((z) => (
                    <tr key={z.id}>
                      <td className="py-2">Up to {z.maxMileage} miles</td>
                      <td className="py-2">{currency}{z.minimumOrderAmount.toFixed(2)}</td>
                      <td className="py-2">{currency}{z.deliveryFee.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-brand-bg/60 mt-3">
                * you must spend at least this amount on the items, after discount, excluding any delivery or processing fees.
              </p>
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
              const hour = restaurant?.openingHours.find((h) => h.dayOfWeek === i);
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
  );
}
