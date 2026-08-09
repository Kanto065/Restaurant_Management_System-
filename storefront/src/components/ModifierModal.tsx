import { useState } from 'react';
import type { MenuItem, ModifierOption } from '../types/api';
import { useCartStore } from '../store/cart';

export default function ModifierModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const addLine = useCartStore((s) => s.addLine);
  const [selected, setSelected] = useState<Record<string, ModifierOption[]>>(() =>
    Object.fromEntries(item.modifierGroups.map((g) => [g.id, g.options.filter((o) => o.isDefault)]))
  );

  const allSelected = Object.values(selected).flat();
  const total = item.basePrice + allSelected.reduce((s, o) => s + o.priceDelta, 0);

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-brand-cream text-brand-bg w-full sm:max-w-lg sm:rounded-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-brand-green text-white px-5 py-4">
          <h3 className="font-display text-xl">Customise the product</h3>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <p className="font-semibold">{item.name}</p>
          {item.description && <p className="text-sm text-brand-bg/70 mt-1">{item.description}</p>}

          {item.modifierGroups.map((group) => (
            <div key={group.id} className="mt-5 border-t border-brand-bg/10 pt-4">
              <p className="font-medium text-sm mb-2">
                {group.name} {group.isRequired && <span className="text-brand-orange">*</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.options.map((option) => {
                  const isSelected = (selected[group.id] ?? []).some((o) => o.id === option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleOption(group.id, option, group.maxSelect)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        isSelected
                          ? 'bg-brand-green text-white border-brand-green'
                          : 'border-brand-bg/20 hover:border-brand-green'
                      }`}
                    >
                      {option.name}
                      {option.priceDelta !== 0 && ` (${option.priceDelta > 0 ? '+' : ''}£${option.priceDelta.toFixed(2)})`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-brand-bg/10 px-5 py-4 flex items-center justify-between">
          <p className="font-semibold">Total: £{total.toFixed(2)}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded border border-brand-bg/20 text-sm">
              Cancel
            </button>
            <button
              disabled={!requiredMet}
              onClick={() => {
                addLine(item, allSelected);
                onClose();
              }}
              className="px-4 py-2 rounded bg-brand-green text-white text-sm font-medium disabled:opacity-40"
            >
              Add to Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
