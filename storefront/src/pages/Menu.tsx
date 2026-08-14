import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMenu, useFavourites, useLastOrder, useRestaurant } from '../lib/queries';
import { useCartStore } from '../store/cart';
import { api, customerAuth } from '../lib/api';
import { currencySymbol } from '../lib/currency';
import { spiceIcon } from '../lib/spice';
import ModifierModal from '../components/ModifierModal';
import CartPanel from '../components/CartPanel';
import type { MenuItem, OrderType } from '../types/api';

type ViewMode = 'category' | 'best-sellers' | 'favourites';

export default function Menu() {
  const { data, isLoading, isError } = useMenu();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { itemId, categoryId } = useParams<{ itemId?: string; categoryId?: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>('category');
  const [changingType, setChangingType] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  const openItem = (item: MenuItem) =>
    navigate(`${categoryId ? `/menu/category/${categoryId}` : '/menu'}/item/${item.id}?${searchParams.toString()}`);
  const closeItem = () => navigate(`${categoryId ? `/menu/category/${categoryId}` : '/menu'}?${searchParams.toString()}`);
  const openCategory = (id: string) => { navigate(`/menu/category/${id}?${searchParams.toString()}`); setViewMode('category'); };
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
  const currentCategory = categories.find((c) => c.id === categoryId) ?? categories[0];
  const modalItem = itemId ? allItems.find((i) => i.id === itemId) ?? null : null;

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

  // Shared between the desktop vertical sidebar and the mobile category-picker sheet - afterSelect
  // closes the sheet on mobile and is a no-op (undefined) on desktop, where there's no sheet.
  const renderCategoryButtons = (afterSelect?: () => void) => (
    <>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => { openCategory(cat.id); afterSelect?.(); }}
          className={`shrink-0 text-left px-4 py-2.5 rounded text-sm font-medium transition-colors ${
            viewMode === 'category' && (currentCategory?.id ?? categories[0]?.id) === cat.id
              ? 'bg-brand-green text-white'
              : 'bg-brand-mint/20 hover:bg-brand-mint/30 text-brand-cream'
          }`}
        >
          {cat.name}
        </button>
      ))}

      <div className="h-px bg-brand-cream/10 my-1" />

      <button
        onClick={() => { setViewMode('best-sellers'); afterSelect?.(); }}
        className={`shrink-0 text-left px-4 py-2.5 rounded text-sm font-medium transition-colors ${
          viewMode === 'best-sellers' ? 'bg-brand-orange text-white' : 'bg-brand-mint/20 hover:bg-brand-mint/30 text-brand-cream'
        }`}
      >
        Best Sellers ★
      </button>

      {isMember && (
        <>
          <button
            onClick={() => { setViewMode('favourites'); afterSelect?.(); }}
            className={`shrink-0 text-left px-4 py-2.5 rounded text-sm font-medium transition-colors ${
              viewMode === 'favourites' ? 'bg-brand-orange text-white' : 'bg-brand-mint/20 hover:bg-brand-mint/30 text-brand-cream'
            }`}
          >
            My Favourites ♥
          </button>
          {lastOrderQuery.data && (
            <button
              onClick={() => { handleReorderLast(); afterSelect?.(); }}
              className="shrink-0 text-left px-4 py-2.5 rounded text-sm font-medium bg-brand-mint/20 hover:bg-brand-mint/30 text-brand-cream"
            >
              My Last Order ⟳
            </button>
          )}
        </>
      )}
    </>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-6">
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
              onClick={() => { navigate(`${categoryId ? `/menu/category/${categoryId}` : '/menu'}?type=Collection`); setChangingType(false); }}
              className={`px-4 py-2 rounded text-sm font-medium ${orderType === 'Collection' ? 'bg-brand-green text-white' : 'bg-brand-mint/20 text-brand-cream'}`}
            >
              Order for Collection
            </button>
            <button
              onClick={() => { navigate(`${categoryId ? `/menu/category/${categoryId}` : '/menu'}?type=Delivery`); setChangingType(false); }}
              className={`px-4 py-2 rounded text-sm font-medium ${orderType === 'Delivery' ? 'bg-brand-orange text-white' : 'bg-brand-mint/20 text-brand-cream'}`}
            >
              Order for Home Delivery
            </button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[220px_1fr_320px] gap-6">
        {/* Category sidebar: a "Change Category" button opening a picker sheet on mobile,
            a plain vertical list on desktop - no more horizontally-scrolling pill row. */}
        <nav className="hidden lg:flex lg:flex-col gap-2">
          {renderCategoryButtons()}
        </nav>

        <button
          onClick={() => setCategoryPickerOpen(true)}
          className="lg:hidden bg-brand-orange text-white font-semibold py-3 rounded-lg text-sm text-center"
        >
          {heading} · Change Category
        </button>

        {categoryPickerOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 lg:hidden" onClick={() => setCategoryPickerOpen(false)}>
            <div
              className="bg-brand-bg text-brand-cream w-full rounded-t-2xl overflow-hidden max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-brand-cream/10 shrink-0">
                <h3 className="font-display text-lg">Choose a Category</h3>
                <button onClick={() => setCategoryPickerOpen(false)} aria-label="Close" className="text-brand-cream/70 text-xl leading-none px-1">
                  ×
                </button>
              </div>
              <div className="overflow-y-auto p-3 flex flex-col gap-2">
                {renderCategoryButtons(() => setCategoryPickerOpen(false))}
              </div>
            </div>
          </div>
        )}

        {/* Item list */}
        <div className="bg-brand-cream text-brand-bg rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-bg/10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-lg">{heading}</h2>
              {viewMode === 'category' && currentCategory?.description && (
                <p className="text-xs text-brand-bg/60 mt-0.5">{currentCategory.description}</p>
              )}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name"
              className="text-sm px-3 py-1.5 rounded border border-brand-bg/20 w-32 sm:w-48"
            />
          </div>
          <div className="divide-y divide-brand-bg/10">
            {visibleItems.flatMap((item) => {
              const thumb = (
                <div className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-brand-bg-light">
                  {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />}
                  {item.isBestSeller && (
                    <span className="absolute -top-1 -left-1 bg-brand-orange text-white text-[8px] font-medium px-1 py-0.5 rounded-full">
                      ★
                    </span>
                  )}
                </div>
              );

              if (item.showVariantsAsRows && item.modifierGroups.length === 1) {
                return (
                  <div key={item.id} className="flex flex-col gap-3 p-3 sm:grid sm:grid-cols-[56px_1fr_auto] sm:items-start">
                    <div className="flex gap-3 sm:contents cursor-pointer" onClick={() => openItem(item)}>
                      {thumb}
                      <div className="min-w-0">
                        <p className="font-display text-base leading-tight">
                          {item.name}
                          {item.spiceLevel !== 'None' && (
                            <span className="text-xs ml-1.5 align-middle" title={item.spiceLevel}>{spiceIcon(item.spiceLevel)}</span>
                          )}
                        </p>
                        {item.description && <p className="text-sm text-brand-bg/70">{item.description}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {item.modifierGroups[0].options.map((option) => (
                        <div key={option.id} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-brand-bg/80 whitespace-nowrap">{option.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-brand-bg whitespace-nowrap w-16 text-right">
                              {currency}{(item.basePrice + option.priceDelta).toFixed(2)}
                            </span>
                            <button
                              onClick={() => addLine(item, [option])}
                              className="bg-brand-green text-white text-xs font-semibold px-4 py-2 rounded-lg"
                            >
                              Add +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              return [
                <div
                  key={item.id}
                  onClick={() => openItem(item)}
                  className="w-full text-left flex flex-col gap-2 p-3 sm:grid sm:grid-cols-[56px_1fr_auto_72px_auto] sm:items-start sm:gap-3 hover:bg-brand-bg/5 transition-colors cursor-pointer"
                >
                  <div className="flex gap-3 sm:contents">
                    {thumb}
                    <div className="min-w-0">
                      <p className="font-display text-base leading-tight">
                        {item.name}
                        {item.spiceLevel !== 'None' && (
                          <span className="text-xs ml-1.5 align-middle" title={item.spiceLevel}>{spiceIcon(item.spiceLevel)}</span>
                        )}
                      </p>
                      {item.description && <p className="text-sm text-brand-bg/70">{item.description}</p>}
                      {(item.isVegan || item.isVegetarian) && (
                        <div className="flex gap-1.5 mt-0.5 flex-wrap">
                          {item.isVegan && <span className="text-xs bg-green-600/10 text-green-700 px-1.5 py-0.5 rounded">Vegan</span>}
                          {item.isVegetarian && !item.isVegan && <span className="text-xs bg-green-600/10 text-green-700 px-1.5 py-0.5 rounded">Veg</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 sm:contents">
                    {isMember ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavouriteMutation.mutate({ menuItemId: item.id, isFavourite: favouriteIds.has(item.id) }); }}
                        aria-label="Toggle favourite"
                        className={`sm:self-center ${favouriteIds.has(item.id) ? 'text-brand-orange' : 'text-brand-bg/30'}`}
                      >
                        ♥
                      </button>
                    ) : <span />}
                    <div className="flex items-center gap-3 sm:contents">
                      <p className="font-semibold text-brand-bg text-right whitespace-nowrap sm:self-center">{currency}{item.basePrice.toFixed(2)}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          item.modifierGroups.length > 0 ? openItem(item) : addLine(item, []);
                        }}
                        className="sm:self-center bg-brand-green text-white text-xs font-semibold px-4 py-2 rounded-lg"
                      >
                        Add +
                      </button>
                    </div>
                  </div>
                </div>,
              ];
            })}
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
        <button onClick={() => navigate('/cart')} className="bg-white text-brand-green text-sm font-semibold px-4 py-1.5 rounded">
          View Cart
        </button>
      </div>

      {modalItem && <ModifierModal item={modalItem} onClose={closeItem} />}
    </div>
  );
}
