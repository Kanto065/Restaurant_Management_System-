import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMenu, useRestaurant } from '@shared/lib/queries';
import { useCartStore } from '@shared/store/cart';
import RichDescription from '@shared/components/RichDescription';
import type { MenuItem } from '@shared/types/api';
import Basket from '../components/Basket';
import DishDialog from '../components/DishDialog';
import { categoryAnchor, formatPrice, isOrderingOpen, usePageTitle } from '../lib/site';

function dishTags(item: MenuItem): string[] {
  const tags: string[] = [];
  if (item.isVegan) tags.push('Vegan');
  else if (item.isVegetarian) tags.push('Vegetarian');
  if (item.spiceLevel !== 'None') tags.push(item.spiceLevel);
  if (item.isBestSeller) tags.push('Favourite');
  return tags;
}

/** "from £9.95" when a Variation group changes the price, e.g. chicken vs lamb. */
function priceLabel(item: MenuItem, currency: string | undefined): string {
  const variations = item.modifierGroups.filter((g) => g.groupType === 'Variation' && g.options.length > 0);
  if (variations.length === 0) return formatPrice(item.basePrice, currency);
  const cheapest = item.basePrice + Math.min(...variations.flatMap((g) => g.options.map((o) => o.priceDelta)));
  return `from ${formatPrice(cheapest, currency)}`;
}

export default function Menu() {
  const { data: restaurant } = useRestaurant();
  const { data: menu, isLoading } = useMenu();
  const addLine = useCartStore((s) => s.addLine);
  const location = useLocation();
  const [dialogItem, setDialogItem] = useState<MenuItem | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const orderingOpen = isOrderingOpen(restaurant);
  const currency = restaurant?.currency;
  usePageTitle(orderingOpen ? 'Order online' : 'The sample menu');

  const categories = (menu?.categories ?? []).filter((c) => c.items.length > 0);

  // /menu#to-start from the home page index - scroll once the menu has rendered.
  useEffect(() => {
    if (!location.hash || categories.length === 0) return;
    document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }, [location.hash, categories.length]);

  // site.js: highlight the category currently in view.
  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>('.menu-category')];
    if (sections.length === 0 || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const active = entries.filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (active) setActiveAnchor(active.target.id);
    }, { rootMargin: '-5% 0px -65% 0px', threshold: 0 });
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [categories.length]);

  function add(item: MenuItem) {
    if (item.modifierGroups.length > 0) setDialogItem(item);
    else addLine(item, []);
  }

  return (
    <>
      <div className="wrap page-intro menu-intro">
        <p className="eyebrow">{orderingOpen ? 'THE STAR SPICE MENU · ORDER ONLINE' : 'THE STAR SPICE MENU · A FIRST LOOK'}</p>
        <h1>The menu.</h1>
        <p>Indian classics. Bangladeshi specialities. Something on the side.</p>
        {!orderingOpen && (
          <div className="notice">
            <strong>Sample menu · Provisional prices.</strong> These dishes, descriptions and prices are illustrative, not our final menu. We’re preparing to reopen and are not accepting orders.
          </div>
        )}
      </div>

      <div className="paper">
        <div className={`wrap menu-layout${orderingOpen && restaurant ? ' ordering' : ''}`}>
          <nav className="category-nav" aria-label="Menu categories">
            <p className="eyebrow">ON THE MENU</p>
            {categories.map((c) => {
              const anchor = categoryAnchor(c);
              return (
                <a key={c.id} href={`#${anchor}`} aria-current={activeAnchor === anchor ? 'true' : undefined}>{c.name}</a>
              );
            })}
          </nav>

          <div>
            {isLoading && <p className="menu-empty">Loading the menu…</p>}
            {!isLoading && categories.length === 0 && <p className="menu-empty">The menu is being prepared. Please check back soon.</p>}

            {categories.map((c) => (
              <section key={c.id} className="menu-category" id={categoryAnchor(c)}>
                <h2>{c.name}</h2>
                {c.description && <p className="category-note">{c.description}</p>}
                {c.items.map((item) => {
                  const tags = dishTags(item);
                  return (
                    <article key={item.id} className="dish">
                      <div>
                        <h3>{item.name}</h3>
                        {item.description && <RichDescription html={item.description} />}
                        {tags.length > 0 && (
                          <div className="dish-tags">{tags.map((t) => <span key={t} className="dish-tag">{t}</span>)}</div>
                        )}
                        {item.containsAllergens && item.allergenInfo && (
                          <p className="dish-options-hint">Allergens: {item.allergenInfo}</p>
                        )}
                      </div>
                      <div className="dish-actions">
                        <p className="dish-price">
                          {!orderingOpen && <span className="sr-only">Provisional price </span>}
                          {priceLabel(item, currency)}
                        </p>
                        {orderingOpen && (
                          <button type="button" className="add-button" onClick={() => add(item)} aria-label={`Add ${item.name}`}>
                            Add <span aria-hidden="true">+</span>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            ))}

            {categories.length > 0 && (
              <>
                <p className="allergen-note">
                  <strong>Allergens &amp; dietary information</strong><br />
                  {orderingOpen
                    ? 'If you have an allergy or dietary requirement, please tell us before ordering. Add a note to your order or call us.'
                    : 'Recipes and allergen information are not confirmed for this sample menu. Please do not use these descriptions to make allergy or dietary decisions. Confirmed information will be available before ordering opens.'}
                </p>
                <a href="#main" className="back-top">Back to top ↑</a>
              </>
            )}
          </div>

          {orderingOpen && restaurant && <Basket restaurant={restaurant} />}
        </div>
      </div>

      {dialogItem && <DishDialog item={dialogItem} currency={currency} onClose={() => setDialogItem(null)} />}
    </>
  );
}
