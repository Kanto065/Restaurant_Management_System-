import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MenuItem, ModifierOption, OrderType } from '../types/api';

export interface CartLine {
  lineId: string; // client-generated, distinguishes two lines of the same item with different modifiers
  menuItem: MenuItem;
  quantity: number;
  selectedOptions: ModifierOption[];
  specialInstructions?: string;
}

interface CartState {
  orderType: OrderType;
  lines: CartLine[];
  setOrderType: (type: OrderType) => void;
  addLine: (menuItem: MenuItem, selectedOptions: ModifierOption[], quantity?: number, specialInstructions?: string) => void;
  incrementLine: (lineId: string) => void;
  decrementLine: (lineId: string) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
  subtotal: () => number;
  itemCount: () => number;
}

// Client-side cart is optimistic UI only — the server always recomputes prices
// from current MenuItem/ModifierOption rows at checkout, so this total is a preview.
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      orderType: 'Collection',
      lines: [],

      setOrderType: (orderType) => set({ orderType }),

      addLine: (menuItem, selectedOptions, quantity = 1, specialInstructions) => {
        const lineId = `${menuItem.id}:${selectedOptions.map((o) => o.id).sort().join(',')}:${Date.now()}`;
        set((state) => ({
          lines: [...state.lines, { lineId, menuItem, quantity, selectedOptions, specialInstructions }],
        }));
      },

      incrementLine: (lineId) =>
        set((state) => ({
          lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + 1 } : l)),
        })),

      decrementLine: (lineId) =>
        set((state) => ({
          lines: state.lines
            .map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity - 1 } : l))
            .filter((l) => l.quantity > 0),
        })),

      removeLine: (lineId) => set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) })),

      clear: () => set({ lines: [] }),

      subtotal: () =>
        get().lines.reduce((sum, l) => {
          const unit = l.menuItem.basePrice + l.selectedOptions.reduce((s, o) => s + o.priceDelta, 0);
          return sum + unit * l.quantity;
        }, 0),

      itemCount: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),
    }),
    { name: 'ptt-storefront-cart' }
  )
);
