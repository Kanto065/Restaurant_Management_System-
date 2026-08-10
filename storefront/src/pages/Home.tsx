import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useRestaurant } from '../lib/queries';
import HeroCarousel from '../components/HeroCarousel';
import type { HeroSlide } from '../types/api';

const DEFAULT_ORDER_ONLINE_TITLE = 'Order Online';
const DEFAULT_ORDER_ONLINE_TEXT = 'Enter your postcode to begin your order for collection or delivery.';
const DEFAULT_LOYALTY_TITLE = 'Loyalty Points';
const DEFAULT_LOYALTY_TEXT = 'Register as a member to earn and redeem loyalty points on every order.';
const DEFAULT_DELIVER_TITLE = 'We Deliver!';
const DEFAULT_DELIVER_TEXT = 'Order online today and our drivers will bring your food straight to your door.';
const DEFAULT_WELCOME_TITLE = 'Welcome!';
const DEFAULT_WELCOME_TEXT =
  "Experience the bold flavours of Indian cuisine, from rich curries to sizzling starters. Don't forget to try our freshly baked naan and signature biryanis.";

export default function Home() {
  const { data: restaurant } = useRestaurant();
  const [postcode, setPostcode] = useState('');

  const content = restaurant?.homepageContent;
  const heroSlides: HeroSlide[] =
    content?.heroSlides && content.heroSlides.length > 0
      ? content.heroSlides
      : [
          {
            imageUrl: restaurant?.heroImageUrl ?? '',
            heading: 'Order Online Today',
            subheading:
              restaurant?.description ??
              'Experience the bold flavours of authentic Indian cuisine, from rich curries to sizzling starters.',
          },
        ];

  return (
    <div>
      <HeroCarousel slides={heroSlides} />

      <section className="bg-pattern-paisley">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 grid sm:grid-cols-3 gap-4">
          <div className="bg-brand-mint text-brand-bg rounded-lg p-6">
            <h3 className="font-display text-2xl mb-2">{content?.orderOnlineTitle || DEFAULT_ORDER_ONLINE_TITLE}</h3>
            <p className="text-sm mb-4">{content?.orderOnlineText || DEFAULT_ORDER_ONLINE_TEXT}</p>
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
            <h3 className="font-display text-2xl mb-2">{content?.loyaltyTitle || DEFAULT_LOYALTY_TITLE}</h3>
            <p className="text-sm mb-4">{content?.loyaltyText || DEFAULT_LOYALTY_TEXT}</p>
            <Link to="/account/register" className="inline-block bg-brand-cream text-brand-bg rounded px-4 py-2 text-sm font-medium">
              Register Now
            </Link>
          </div>

          <div className="bg-brand-green text-white rounded-lg p-6">
            <h3 className="font-display text-2xl mb-2">{content?.deliverTitle || DEFAULT_DELIVER_TITLE}</h3>
            <p className="text-sm mb-4">{content?.deliverText || DEFAULT_DELIVER_TEXT}</p>
            <Link to="/menu?type=Delivery" className="inline-block bg-brand-cream text-brand-bg rounded px-4 py-2 text-sm font-medium">
              Order For Delivery
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 grid sm:grid-cols-2 gap-6">
        <div className="bg-brand-cream text-brand-bg rounded-lg p-8">
          <h2 className="font-display text-3xl mb-3">{content?.welcomeTitle || DEFAULT_WELCOME_TITLE}</h2>
          <p className="font-semibold mb-2">{restaurant?.name ?? 'Port Tennant Tandoori'}</p>
          <p className="text-sm leading-relaxed">{content?.welcomeText || DEFAULT_WELCOME_TEXT}</p>
          <Link to="/menu" className="inline-block mt-4 bg-brand-orange text-white rounded px-5 py-2.5 text-sm font-medium">
            Order Online
          </Link>
        </div>
        <div className="rounded-lg overflow-hidden aspect-video sm:aspect-auto bg-brand-bg-light" />
      </section>
    </div>
  );
}
