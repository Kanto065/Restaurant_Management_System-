import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMenu } from '../lib/queries';
import { useCartStore } from '../store/cart';
import ModifierModal from '../components/ModifierModal';
import CartPanel from '../components/CartPanel';
import type { MenuItem, OrderType } from '../types/api';

export default function Menu() {
  const { data, isLoading, isError } = useMenu();
  const [searchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [cartOpenMobile, setCartOpenMobile] = useState(false);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const itemCount = useCartStore((s) => s.itemCount());
  const subtotal = useCartStore((s) => s.subtotal());

  const orderType = (searchParams.get('type') as OrderType | null) ?? 'Collection';
  useMemo(() => setOrderType(orderType), [orderType, setOrderType]);

  const categories = data?.categories ?? [];
  const currentCategory = categories.find((c) => c.id === activeCategory) ?? categories[0];

  const visibleItems = useMemo(() => {
    if (!currentCategory) return [];
    if (!search.trim()) return currentCategory.items;
    const q = search.toLowerCase();
    return currentCategory.items.filter((i) => i.name.toLowerCase().includes(q));
  }, [currentCategory, search]);

  if (isLoading) return <div className="max-w-7xl mx-auto px-4 py-12 text-center">Loading menu...</div>;
  if (isError || !data) return <div className="max-w-7xl mx-auto px-4 py-12 text-center">Could not load the menu. Please try again shortly.</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-lg sm:text-xl mb-4">
        You are ordering for <span className="text-brand-mint font-semibold">{orderType === 'Delivery' ? 'Home Delivery' : 'Collection'}</span>
      </h1>

      <div className="grid lg:grid-cols-[220px_1fr_320px] gap-6">
        {/* Category sidebar: horizontal scroll on mobile, vertical list on desktop */}
        <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 text-left px-4 py-2.5 rounded text-sm font-medium whitespace-nowrap lg:whitespace-normal transition-colors ${
                (currentCategory?.id ?? categories[0]?.id) === cat.id
                  ? 'bg-brand-green text-white'
                  : 'bg-brand-mint/20 hover:bg-brand-mint/30 text-brand-cream'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </nav>

        {/* Item list */}
        <div className="bg-brand-cream text-brand-bg rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-bg/10 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg">{currentCategory?.name}</h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name"
              className="text-sm px-3 py-1.5 rounded border border-brand-bg/20 w-32 sm:w-48"
            />
          </div>
          <div className="divide-y divide-brand-bg/10">
            {visibleItems.map((item) => (
              <div key={item.id} className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{item.name}</p>
                  {item.description && <p className="text-sm text-brand-bg/70 mt-0.5">{item.description}</p>}
                  <div className="flex gap-1.5 mt-1">
                    {item.isVegan && <span className="text-xs bg-green-600/10 text-green-700 px-1.5 py-0.5 rounded">Vegan</span>}
                    {item.isVegetarian && !item.isVegan && <span className="text-xs bg-green-600/10 text-green-700 px-1.5 py-0.5 rounded">Veg</span>}
                    {item.spiceLevel !== 'None' && <span className="text-xs bg-orange-500/10 text-orange-700 px-1.5 py-0.5 rounded">{item.spiceLevel}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold mb-2">£{item.basePrice.toFixed(2)}</p>
                  <button
                    onClick={() => (item.modifierGroups.length > 0 ? setModalItem(item) : useCartStore.getState().addLine(item, []))}
                    className="bg-brand-green text-white text-xs font-medium px-3 py-1.5 rounded"
                  >
                    ADD
                  </button>
                </div>
              </div>
            ))}
            {visibleItems.length === 0 && <p className="p-4 text-sm text-brand-bg/60">No items found.</p>}
          </div>
        </div>

        {/* Cart panel: sticky sidebar on desktop */}
        <div className="hidden lg:block sticky top-4 self-start">
          <CartPanel />
        </div>
      </div>

      {/* Mobile cart bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-brand-green text-white px-4 py-3 flex items-center justify-between z-30">
        <span className="text-sm font-medium">{itemCount} item{itemCount === 1 ? '' : 's'} · £{subtotal.toFixed(2)}</span>
        <button onClick={() => setCartOpenMobile(true)} className="bg-white text-brand-green text-sm font-semibold px-4 py-1.5 rounded">
          View Order
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
