import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MenuItem, ModifierOption } from '../types/api';
import { useCartStore } from '../store/cart';
import { useFavourites, useRestaurant } from '../lib/queries';
import { api, customerAuth } from '../lib/api';
import { currencySymbol } from '../lib/currency';
import { spiceIcon } from '../lib/spice';


export default function ModifierModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const addLine = useCartStore((s) => s.addLine);
  const { data: restaurant } = useRestaurant();
  const currency = currencySymbol(restaurant?.currency);
  const isMember = customerAuth.isLoggedIn();
  const queryClient = useQueryClient();
  const favouritesQuery = useFavourites();
  const isFavourite = (favouritesQuery.data ?? []).some((f) => f.menuItemId === item.id);
  const toggleFavouriteMutation = useMutation({
    mutationFn: () =>
      isFavourite
        ? api.delete(`/api/account/favourites/${item.id}`)
        : api.post('/api/account/favourites', { menuItemId: item.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'favourites'] }),
  });
  const [selected, setSelected] = useState<Record<string, ModifierOption[]>>(() =>
    Object.fromEntries(item.modifierGroups.map((g) => [g.id, g.options.filter((o) => o.isDefault)]))
  );
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');

  const allSelected = Object.values(selected).flat();
  const unitTotal = item.basePrice + allSelected.reduce((s, o) => s + o.priceDelta, 0);
  const total = unitTotal * quantity;

  const requiredMet = item.modifierGroups
    .filter((g) => g.isRequired)
    .every((g) => (selected[g.id]?.length ?? 0) >= Math.max(g.minSelect, 1));

  function toggleOption(groupId: string, option: ModifierOption, maxSelect: number) {
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      const isSelected = current.some((o) => o.id === option.id);
      if (isSelected) return { ...prev, [groupId]: current.filter((o) => o.id !== option.id) };
      const next = maxSelect <= 1 ? [option] : [...current, option];
      return { ...prev, [groupId]: maxSelect > 0 ? next.slice(-maxSelect) : next };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-brand-bg text-brand-cream w-full sm:max-w-lg sm:rounded-lg overflow-hidden h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col">
        <div className="relative shrink-0">
          <div className="aspect-[16/9] bg-brand-bg-light">
            {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 left-3 w-9 h-9 rounded-full bg-brand-bg/70 text-brand-cream flex items-center justify-center"
          >
            ←
          </button>
          {isMember && (
            <button
              onClick={() => toggleFavouriteMutation.mutate()}
              aria-label="Toggle favourite"
              className={`absolute top-3 right-3 w-9 h-9 rounded-full bg-brand-bg/70 flex items-center justify-center ${
                isFavourite ? 'text-brand-orange' : 'text-brand-cream'
              }`}
            >
              ♥
            </button>
          )}
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-2xl">{item.name}</h3>
            {item.isBestSeller && (
              <span className="bg-brand-orange text-white text-xs font-medium px-2.5 py-1 rounded-full">
                Bestseller
              </span>
            )}
          </div>
          {item.description && <p className="text-sm text-brand-cream/70 mt-2 leading-relaxed">{item.description}</p>}

          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 border-t border-brand-cream/10 text-sm text-brand-cream/80">
            {item.spiceLevel !== 'None' && (
              <span className="flex items-center gap-1.5" title={item.spiceLevel}>{spiceIcon(item.spiceLevel)} {item.spiceLevel}</span>
            )}
            {item.preparationTimeMinutes > 0 && (
              <span className="flex items-center gap-1.5">⏱ {item.preparationTimeMinutes} min</span>
            )}
            {item.isVegan && <span className="flex items-center gap-1.5">🌱 Vegan</span>}
            {item.isVegetarian && !item.isVegan && <span className="flex items-center gap-1.5">🌱 Vegetarian</span>}
          </div>

          <p className="text-brand-mint text-xl font-semibold mt-4">{currency}{unitTotal.toFixed(2)}</p>

          {item.modifierGroups.length > 0 && (
            <div className="mt-5">
              {item.modifierGroups.map((group) => (
                <div key={group.id} className="mt-4 border-t border-brand-cream/10 pt-4">
                  <p className="font-medium text-sm mb-2">
                    {group.name} {group.isRequired && <span className="text-brand-orange">*</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((option) => {
                      const isSelected = (selected[group.id] ?? []).some((o) => o.id === option.id);
                      const priceLabel =
                        group.groupType === 'Variation'
                          ? `${currency}${(item.basePrice + option.priceDelta).toFixed(2)}`
                          : option.priceDelta !== 0
                          ? `${option.priceDelta > 0 ? '+' : ''}${currency}${option.priceDelta.toFixed(2)}`
                          : null;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleOption(group.id, option, group.maxSelect)}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            isSelected
                              ? 'bg-brand-green text-white border-brand-green'
                              : 'border-brand-cream/20 hover:border-brand-green'
                          }`}
                        >
                          {option.name}
                          {priceLabel && ` (${priceLabel})`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5">
            <p className="font-medium text-sm mb-2">Special Instructions</p>
            <input
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="E.g. No coriander, less spicy..."
              className="w-full rounded border border-brand-cream/20 bg-transparent px-3 py-2 text-sm placeholder:text-brand-cream/40"
            />
          </div>
        </div>

        <div className="border-t border-brand-cream/10 px-5 py-4 flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-3 border border-brand-cream/20 rounded-lg px-2 py-2">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-6 h-6 flex items-center justify-center text-brand-orange"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-4 text-center text-sm">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-6 h-6 flex items-center justify-center text-brand-orange"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <button
            disabled={!requiredMet}
            onClick={() => {
              addLine(item, allSelected, quantity, specialInstructions.trim() || undefined);
              onClose();
            }}
            className="flex-1 bg-brand-orange text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            Add to Cart <span>{currency}{total.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
