import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MenuItem, ModifierOption } from '../types/api';
import { useCartStore } from '../store/cart';
import { useFavourites, useRestaurant } from '../lib/queries';
import { api, customerAuth } from '../lib/api';
import { currencySymbol } from '../lib/currency';
import { spiceIcon } from '../lib/spice';
import RichDescription from './RichDescription';

// Groups with more options than this render as a dropdown instead of a wall of chips.
const DROPDOWN_THRESHOLD = 4;

function MultiSelectDropdown({ placeholder, options, selectedIds, labelFor, onToggle }: {
  placeholder: string;
  options: ModifierOption[];
  selectedIds: string[];
  labelFor: (option: ModifierOption) => string;
  onToggle: (option: ModifierOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const summary = options.filter((o) => selectedIds.includes(o.id)).map((o) => o.name).join(', ');

  return (
    <div className="rounded-lg border border-brand-cream/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left"
      >
        <span className={`truncate ${summary ? '' : 'text-brand-cream/50'}`}>
          {summary || placeholder}
        </span>
        <span aria-hidden className={`shrink-0 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="max-h-56 overflow-y-auto border-t border-brand-cream/10 py-1">
          {options.map((option) => {
            const checked = selectedIds.includes(option.id);
            return (
              <label key={option.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-brand-cream/5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(option)}
                  className="accent-brand-green w-4 h-4"
                />
                <span>{labelFor(option)}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
          <div className="bg-brand-bg-light max-h-[45vh] overflow-hidden">
            {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-auto max-h-[45vh] object-contain mx-auto" />}
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
          {item.description && <RichDescription html={item.description} className="text-sm text-brand-cream/70 mt-2 leading-relaxed" />}

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
                  {(() => {
                    const groupSelected = selected[group.id] ?? [];
                    const labelFor = (option: ModifierOption) => {
                      const priceLabel =
                        group.groupType === 'Variation'
                          ? `${currency}${(item.basePrice + option.priceDelta).toFixed(2)}`
                          : option.priceDelta !== 0
                          ? `${option.priceDelta > 0 ? '+' : ''}${currency}${option.priceDelta.toFixed(2)}`
                          : null;
                      return priceLabel ? `${option.name} (${priceLabel})` : option.name;
                    };

                    if (group.options.length > DROPDOWN_THRESHOLD && group.maxSelect <= 1) {
                      return (
                        <select
                          aria-label={group.name}
                          value={groupSelected[0]?.id ?? ''}
                          onChange={(e) => {
                            const option = group.options.find((o) => o.id === e.target.value);
                            setSelected((prev) => ({ ...prev, [group.id]: option ? [option] : [] }));
                          }}
                          className="w-full rounded-lg border border-brand-cream/20 bg-brand-bg px-3 py-2.5 text-sm text-brand-cream focus:border-brand-green focus:outline-none"
                        >
                          <option value="" disabled={group.isRequired} className="bg-brand-bg text-brand-cream">
                            {group.isRequired ? `Select ${group.name.toLowerCase()}...` : 'None'}
                          </option>
                          {group.options.map((option) => (
                            <option key={option.id} value={option.id} className="bg-brand-bg text-brand-cream">
                              {labelFor(option)}
                            </option>
                          ))}
                        </select>
                      );
                    }

                    if (group.options.length > DROPDOWN_THRESHOLD) {
                      return (
                        <MultiSelectDropdown
                          placeholder={`Choose up to ${group.maxSelect}...`}
                          options={group.options}
                          selectedIds={groupSelected.map((o) => o.id)}
                          labelFor={labelFor}
                          onToggle={(option) => toggleOption(group.id, option, group.maxSelect)}
                        />
                      );
                    }

                    return (
                      <div className="flex flex-wrap gap-2">
                        {group.options.map((option) => {
                          const isSelected = groupSelected.some((o) => o.id === option.id);
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
                              {labelFor(option)}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

          {item.containsAllergens && (
            <div className="mt-5 bg-brand-orange/10 border border-brand-orange/30 rounded-lg px-3 py-2.5 text-sm text-brand-orange">
              <span className="font-semibold">This item may contain allergens.</span>
              {item.allergenInfo && <span className="text-brand-cream/90"> {item.allergenInfo}</span>}
            </div>
          )}

          <div className="mt-5">
            <p className="font-medium text-sm mb-2">Special Instructions</p>
            <input
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder={item.containsAllergens ? 'Let us know about any allergies or dietary requirements...' : 'E.g. No coriander, less spicy...'}
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
