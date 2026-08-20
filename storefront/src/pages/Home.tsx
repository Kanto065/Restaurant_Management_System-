import { Link, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useMenu, useRestaurant } from '../lib/queries';
import { useCartStore } from '../store/cart';
import { currencySymbol } from '../lib/currency';
import HeroCarousel from '../components/HeroCarousel';
import MandalaAccent from '../components/MandalaAccent';
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
  const { data: menu } = useMenu();
  const [postcode, setPostcode] = useState('');
  const navigate = useNavigate();
  const addLine = useCartStore((s) => s.addLine);
  const currency = currencySymbol(restaurant?.currency);

  const categories = menu?.categories ?? [];
  const popularItems = useMemo(
    () => categories.flatMap((c) => c.items).filter((i) => i.isBestSeller).slice(0, 8),
    [categories]
  );

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
    <>
      <MandalaAccent position="bottom-left" />

      <HeroCarousel slides={heroSlides} />

      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl">Categories</h2>
            <Link to="/menu" className="text-sm text-brand-orange hover:underline">See All →</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => navigate(`/menu/category/${cat.id}`)}
                className="flex flex-col items-center gap-2 shrink-0 w-24 sm:w-32"
              >
                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-brand-bg-light border border-brand-cream/10 flex items-center justify-center">
                  {cat.imageUrl || cat.items[0]?.imageUrl ? (
                    <img src={cat.imageUrl ?? cat.items[0].imageUrl!} alt={cat.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-display text-2xl sm:text-3xl text-brand-mint">{cat.name.charAt(0)}</span>
                  )}
                </div>
                <span className="text-base text-brand-cream/80 text-center leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {popularItems.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl">Popular Items</h2>
            <Link to="/menu" className="text-sm text-brand-orange hover:underline">See All →</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {popularItems.map((item) => (
              <Link
                key={item.id}
                to={`/menu/item/${item.id}`}
                className="shrink-0 w-44 sm:w-60 bg-brand-bg-light rounded-lg overflow-hidden"
              >
                <div className="relative aspect-[4/3] bg-brand-bg">
                  {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />}
                  <span className="absolute top-2 left-2 bg-brand-orange text-white text-xs font-medium px-1.5 py-0.5 rounded-full">
                    Bestseller
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-base font-medium truncate">{item.name}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-brand-mint text-base font-semibold">{currency}{item.basePrice.toFixed(2)}</span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        if (item.modifierGroups.length === 0) addLine(item, []);
                        else navigate(`/menu/item/${item.id}`);
                      }}
                      aria-label={`Add ${item.name}`}
                      className="w-8 h-8 rounded-full bg-brand-orange text-white flex items-center justify-center text-lg leading-none"
                    >
                      +
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
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
    </>
  );
}
