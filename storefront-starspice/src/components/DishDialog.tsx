import { useEffect, useRef, useState } from 'react';
import type { MenuItem, ModifierGroup, ModifierOption } from '@shared/types/api';
import { useCartStore } from '@shared/store/cart';
import RichDescription from '@shared/components/RichDescription';
import { formatPrice } from '../lib/site';

function groupHint(g: ModifierGroup): string {
  if (g.maxSelect === 1) return g.isRequired ? 'Choose one' : 'Optional';
  if (g.maxSelect > 1) return `Choose up to ${g.maxSelect}${g.isRequired ? ` (at least ${Math.max(g.minSelect, 1)})` : ''}`;
  return g.isRequired ? 'Choose at least one' : 'Optional';
}

/** Options picker for a dish with choices (e.g. chicken / lamb / prawn), styled like the menu page. */
export default function DishDialog({ item, currency, onClose }: {
  item: MenuItem;
  currency: string | undefined;
  onClose: () => void;
}) {
  const addLine = useCartStore((s) => s.addLine);
  const [selected, setSelected] = useState<Record<string, ModifierOption[]>>(() =>
    Object.fromEntries(item.modifierGroups.map((g) => [g.id, g.options.filter((o) => o.isDefault)])),
  );
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Once per open. Re-running this on every parent render (focus + scroll lock) shifted layout,
  // which fired the menu's category observer, re-rendered the menu, and looped.
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, []);

  const chosen = Object.values(selected).flat();
  const unit = item.basePrice + chosen.reduce((s, o) => s + o.priceDelta, 0);
  const requiredMet = item.modifierGroups
    .filter((g) => g.isRequired)
    .every((g) => (selected[g.id]?.length ?? 0) >= Math.max(g.minSelect, 1));

  function toggle(group: ModifierGroup, option: ModifierOption) {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      if (current.some((o) => o.id === option.id)) {
        return { ...prev, [group.id]: current.filter((o) => o.id !== option.id) };
      }
      const next = group.maxSelect <= 1 ? [option] : [...current, option];
      return { ...prev, [group.id]: group.maxSelect > 0 ? next.slice(-group.maxSelect) : next };
    });
  }

  function add() {
    addLine(item, chosen, quantity, notes.trim() || undefined);
    onClose();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dish-dialog-title" tabIndex={-1} ref={dialogRef}>
        <p className="eyebrow" style={{ color: '#865817' }}>ADD TO YOUR ORDER</p>
        <h2 id="dish-dialog-title" style={{ marginTop: 12 }}>{item.name}</h2>
        {item.description && <RichDescription html={item.description} className="dialog-desc" />}

        {item.modifierGroups.map((group) => (
          <fieldset key={group.id} className="option-group">
            <legend>{group.name}<small>{groupHint(group)}</small></legend>
            {group.options.map((option) => {
              const single = group.maxSelect === 1;
              const checked = (selected[group.id] ?? []).some((o) => o.id === option.id);
              return (
                <label key={option.id} className="option">
                  <input type={single ? 'radio' : 'checkbox'} name={group.id} checked={checked}
                    onChange={() => toggle(group, option)} />
                  <span>{option.name}</span>
                  {option.priceDelta !== 0 && (
                    <span className="option-price">
                      {group.groupType === 'Variation'
                        ? formatPrice(item.basePrice + option.priceDelta, currency)
                        : `+${formatPrice(option.priceDelta, currency)}`}
                    </span>
                  )}
                </label>
              );
            })}
          </fieldset>
        ))}

        <label className="field" style={{ marginTop: 24 }}>
          <span>Notes for the kitchen (optional)</span>
          <textarea rows={2} maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <div className="dialog-footer">
          <div className="qty" aria-label="Quantity">
            <button type="button" aria-label="One fewer" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
            <span>{quantity}</span>
            <button type="button" aria-label="One more" onClick={() => setQuantity((q) => q + 1)}>+</button>
          </div>
          <button type="button" className="button" disabled={!requiredMet} onClick={add}>
            Add · {formatPrice(unit * quantity, currency)}
          </button>
        </div>
        <button type="button" className="link-button" style={{ marginTop: 18 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
