import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useRestaurant } from '../lib/queries';

export default function Home() {
  const { data: restaurant } = useRestaurant();
  const [postcode, setPostcode] = useState('');

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-brand-mint leading-tight">
              Order Online Today
            </h1>
            <p className="mt-4 text-brand-cream/90 max-w-md">
              {restaurant?.description ??
                'Experience the bold flavours of authentic Indian cuisine, from rich curries to sizzling starters.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/menu?type=Collection"
                className="bg-brand-green text-white px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                Order for Collection
              </Link>
              <Link
                to="/menu?type=Delivery"
                className="bg-brand-orange text-white px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                Order for Delivery
              </Link>
            </div>
          </div>
          <div className="rounded-lg overflow-hidden aspect-video bg-brand-bg-light">
            {restaurant?.heroImageUrl && (
              <img src={restaurant.heroImageUrl} alt={restaurant.name} className="w-full h-full object-cover" />
            )}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 grid sm:grid-cols-3 gap-4">
        <div className="bg-brand-mint text-brand-bg rounded-lg p-6">
          <h3 className="font-display text-2xl mb-2">Order Online</h3>
          <p className="text-sm mb-4">Enter your postcode to begin your order for collection or delivery.</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              window.location.href = `/menu?type=Delivery&postcode=${encodeURIComponent(postcode)}`;
            }}
          >
            <input
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="E.G. SA8 4JN"
              className="flex-1 min-w-0 rounded px-3 py-2 text-brand-bg text-sm"
            />
            <button className="bg-brand-orange text-white rounded px-4 py-2 text-sm font-medium shrink-0">
              Order
            </button>
          </form>
        </div>

        <div className="bg-brand-orange text-white rounded-lg p-6">
          <h3 className="font-display text-2xl mb-2">Loyalty Points</h3>
          <p className="text-sm mb-4">Register as a member to earn and redeem loyalty points on every order.</p>
          <Link to="/account/register" className="inline-block bg-brand-cream text-brand-bg rounded px-4 py-2 text-sm font-medium">
            Register Now
          </Link>
        </div>

        <div className="bg-brand-green text-white rounded-lg p-6">
          <h3 className="font-display text-2xl mb-2">We Deliver!</h3>
          <p className="text-sm mb-4">Order online today and our drivers will bring your food straight to your door.</p>
          <Link to="/menu?type=Delivery" className="inline-block bg-brand-cream text-brand-bg rounded px-4 py-2 text-sm font-medium">
            Order For Delivery
          </Link>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 grid sm:grid-cols-2 gap-6">
        <div className="bg-brand-cream text-brand-bg rounded-lg p-8">
          <h2 className="font-display text-3xl mb-3">Welcome!</h2>
          <p className="font-semibold mb-2">{restaurant?.name ?? 'Port Tennant Tandoori'}</p>
          <p className="text-sm leading-relaxed">
            {restaurant?.description ??
              "Experience the bold flavours of Indian cuisine, from rich curries to sizzling starters. Don't forget to try our freshly baked naan and signature biryanis."}
          </p>
          <Link to="/menu" className="inline-block mt-4 bg-brand-orange text-white rounded px-5 py-2.5 text-sm font-medium">
            Order Online
          </Link>
        </div>
        <div className="rounded-lg overflow-hidden aspect-video sm:aspect-auto bg-brand-bg-light" />
      </section>
    </div>
  );
}
