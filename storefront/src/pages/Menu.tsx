import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMenu, useFavourites, useLastOrder, useRestaurant } from '../lib/queries';
import { useCartStore } from '../store/cart';
import { api, customerAuth } from '../lib/api';
import { currencySymbol } from '../lib/currency';
import ModifierModal from '../components/ModifierModal';
import CartPanel from '../components/CartPanel';
import type { MenuItem, OrderType } from '../types/api';

type ViewMode = 'category' | 'best-sellers' | 'favourites';

export default function Menu() {
  const { data, isLoading, isError } = useMenu();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('category');
  const [changingType, setChangingType] = useState(false);
  const [search, setSearch] = useState('');
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [cartOpenMobile, setCartOpenMobile] = useState(false);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const addLine = useCartStore((s) => s.addLine);
  const itemCount = useCartStore((s) => s.itemCount());
  const subtotal = useCartStore((s) => s.subtotal());
  const isMember = customerAuth.isLoggedIn();
  const { data: restaurant } = useRestaurant();
  const currency = currencySymbol(restaurant?.currency);

  const favouritesQuery = useFavourites();
  const lastOrderQuery = useLastOrder();
  const queryClient = useQueryClient();
  const favouriteIds = new Set((favouritesQuery.data ?? []).map((f) => f.menuItemId));

  const toggleFavouriteMutation = useMutation({
    mutationFn: ({ menuItemId, isFavourite }: { menuItemId: string; isFavourite: boolean }) =>
      isFavourite ? api.delete(`/api/account/favourites/${menuItemId}`) : api.post('/api/account/favourites', { menuItemId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'favourites'] }),
  });

  const orderType = (searchParams.get('type') as OrderType | null) ?? 'Collection';
  useMemo(() => setOrderType(orderType), [orderType, setOrderType]);

  const categories = data?.categories ?? [];
  const allItems = useMemo(() => categories.flatMap((c) => c.items), [categories]);
  const currentCategory = categories.find((c) => c.id === activeCategory) ?? categories[0];

  const categoryParam = searchParams.get('category');
  useEffect(() => {
    if (categoryParam && categories.some((c) => c.id === categoryParam)) {
      setActiveCategory(categoryParam);
      setViewMode('category');
    }
  }, [categoryParam, categories]);

  const bestSellers = useMemo(() => allItems.filter((i) => i.isBestSeller), [allItems]);
  const favouriteItems = useMemo(() => {
    const favIds = new Set((favouritesQuery.data ?? []).map((f) => f.menuItemId));
    return allItems.filter((i) => favIds.has(i.id));
  }, [allItems, favouritesQuery.data]);

  const baseItems = viewMode === 'best-sellers' ? bestSellers : viewMode === 'favourites' ? favouriteItems : currentCategory?.items ?? [];

  const visibleItems = useMemo(() => {
    if (!search.trim()) return baseItems;
    const q = search.toLowerCase();
    return baseItems.filter((i) => i.name.toLowerCase().includes(q));
  }, [baseItems, search]);

  const heading = viewMode === 'best-sellers' ? 'Best Sellers' : viewMode === 'favourites' ? 'My Favourites' : currentCategory?.name;

  const handleReorderLast = () => {
    const lastOrder = lastOrderQuery.data as { items?: { nameSnapshot: string }[] } | undefined;
    if (!lastOrder?.items) return;
    for (const li of lastOrder.items) {
      const match = allItems.find((i) => i.name === li.nameSnapshot);
      if (match) addLine(match, []);
    }
  };

  if (isLoading) return <div className="max-w-7xl mx-auto px-4 py-12 text-center">Loading menu...</div>;
  if (isError || !data) return <div className="max-w-7xl mx-auto px-4 py-12 text-center">Could not load the menu. Please try again shortly.</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4">
        <h1 className="text-lg sm:text-xl">
          You are ordering for <span className="text-brand-mint font-semibold">{orderType === 'Delivery' ? 'Home Delivery' : 'Collection'}</span>{' '}
          <button onClick={() => setChangingType((v) => !v)} className="text-sm underline text-brand-cream/70 hover:text-brand-cream">
            Change
          </button>
        </h1>
        {changingType && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => { navigate('/menu?type=Collection'); setChangingType(false); }}
              className={`px-4 py-2 rounded text-sm font-medium ${orderType === 'Collection' ? 'bg-brand-green text-white' : 'bg-brand-mint/20 text-brand-cream'}`}
            >
              Order for Collection
            </button>
            <button
              onClick={() => { navigate('/menu?type=Delivery'); setChangingType(false); }}
              className={`px-4 py-2 rounded text-sm font-medium ${orderType === 'Delivery' ? 'bg-brand-orange text-white' : 'bg-brand-mint/20 text-brand-cream'}`}
            >
              Order for Home Delivery
            </button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[220px_1fr_320px] gap-6">
        {/* Category sidebar: horizontal scroll on mobile, vertical list on desktop */}
        <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setViewMode('category'); }}
              className={`shrink-0 text-left px-4 py-2.5 rounded text-sm font-medium whitespace-nowrap lg:whitespace-normal transition-colors ${
                viewMode === 'category' && (currentCategory?.id ?? categories[0]?.id) === cat.id
                  ? 'bg-brand-green text-white'
                  : 'bg-brand-mint/20 hover:bg-brand-mint/30 text-brand-cream'
              }`}
            >
              {cat.name}
            </button>
          ))}

          <div className="h-px bg-brand-cream/10 lg:my-1 shrink-0 w-px lg:w-auto lg:h-px" />

          <button
            onClick={() => setViewMode('best-sellers')}
            className={`shrink-0 text-left px-4 py-2.5 rounded text-sm font-medium whitespace-nowrap lg:whitespace-normal transition-colors ${
              viewMode === 'best-sellers' ? 'bg-brand-orange text-white' : 'bg-brand-mint/20 hover:bg-brand-mint/30 text-brand-cream'
            }`}
          >
            Best Sellers ★
          </button>

          {isMember && (
            <>
              <button
                onClick={() => setViewMode('favourites')}
                className={`shrink-0 text-left px-4 py-2.5 rounded text-sm font-medium whitespace-nowrap lg:whitespace-normal transition-colors ${
                  viewMode === 'favourites' ? 'bg-brand-orange text-white' : 'bg-brand-mint/20 hover:bg-brand-mint/30 text-brand-cream'
                }`}
              >
                My Favourites ♥
              </button>
              {lastOrderQuery.data && (
                <button
                  onClick={handleReorderLast}
                  className="shrink-0 text-left px-4 py-2.5 rounded text-sm font-medium whitespace-nowrap lg:whitespace-normal bg-brand-mint/20 hover:bg-brand-mint/30 text-brand-cream"
                >
                  My Last Order ⟳
                </button>
              )}
            </>
          )}
        </nav>

        {/* Item list */}
        <div className="bg-brand-cream text-brand-bg rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-bg/10 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg">{heading}</h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name"
              className="text-sm px-3 py-1.5 rounded border border-brand-bg/20 w-32 sm:w-48"
            />
          </div>
          <div className="divide-y divide-brand-bg/10">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setModalItem(item)}
                className="w-full text-left p-4 flex items-start gap-4 hover:bg-brand-bg/5 transition-colors"
              >
                <div className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-brand-bg-light">
                  {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />}
                  {item.isBestSeller && (
                    <span className="absolute top-1 left-1 bg-brand-orange text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                      Bestseller
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg leading-tight">{item.name}</p>
                  {item.description && <p className="text-sm text-brand-bg/70 mt-1 line-clamp-2">{item.description}</p>}
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {item.spiceLevel !== 'None' && (
                      <span className="text-xs text-brand-orange">🌶️ {item.spiceLevel}</span>
                    )}
                    {item.isVegan && <span className="text-xs bg-green-600/10 text-green-700 px-1.5 py-0.5 rounded">Vegan</span>}
                    {item.isVegetarian && !item.isVegan && <span className="text-xs bg-green-600/10 text-green-700 px-1.5 py-0.5 rounded">Veg</span>}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="font-semibold text-brand-bg">{currency}{item.basePrice.toFixed(2)}</p>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {isMember && (
                        <button
                          onClick={() => toggleFavouriteMutation.mutate({ menuItemId: item.id, isFavourite: favouriteIds.has(item.id) })}
                          aria-label="Toggle favourite"
                          className={favouriteIds.has(item.id) ? 'text-brand-orange' : 'text-brand-bg/30'}
                        >
                          ♥
                        </button>
                      )}
                      <button
                        onClick={() => (item.modifierGroups.length > 0 ? setModalItem(item) : addLine(item, []))}
                        className="bg-brand-green text-white text-xs font-semibold px-4 py-2 rounded-lg"
                      >
                        Add +
                      </button>
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {visibleItems.length === 0 && (
              <p className="p-4 text-sm text-brand-bg/60">
                {viewMode === 'favourites' ? "You haven't added any favourites yet." : 'No items found.'}
              </p>
            )}
          </div>
        </div>

        {/* Cart panel: sticky sidebar on desktop */}
        <div className="hidden lg:block sticky top-4 self-start">
          <CartPanel />
        </div>
      </div>

      {/* Mobile cart bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-brand-green text-white px-4 py-3 flex items-center justify-between z-30">
        <span className="text-sm font-medium">{itemCount} item{itemCount === 1 ? '' : 's'} · {currency}{subtotal.toFixed(2)}</span>
        <button onClick={() => setCartOpenMobile(true)} className="bg-white text-brand-green text-sm font-semibold px-4 py-1.5 rounded">
          View Cart
        </button>
      </div>

      {cartOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 flex items-end" onClick={() => setCartOpenMobile(false)}>
          <div className="w-full" onClick={(e) => e.stopPropagation()}>
            <CartPanel />
            <button onClick={() => setCartOpenMobile(false)} className="w-full bg-brand-bg text-brand-cream py-3 text-sm">
              Close
            </button>
          </div>
        </div>
      )}

      {modalItem && <ModifierModal item={modalItem} onClose={() => setModalItem(null)} />}
    </div>
  );
}
