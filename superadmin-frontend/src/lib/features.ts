/** Labels for the backend's FeatureKeys. Unknown keys still render, with the raw key as label. */
export const FEATURES: { key: string; title: string; description: string; group: 'POS' | 'Online' }[] = [
  { key: 'pos', group: 'POS', title: 'POS apps',
    description: 'Sunmi terminals and the shop’s main POS. Turning it off signs out every paired device at once and switches off the POS options below.' },
  { key: 'pos.waiter', group: 'POS', title: 'Waiter tablets', description: 'Waiters take orders at the table on tablets paired to the main POS.' },
  { key: 'pos.kitchenPrint', group: 'POS', title: 'Kitchen tickets', description: 'Food prints on the kitchen printer when an order is sent.' },
  { key: 'pos.barPrint', group: 'POS', title: 'Bar tickets', description: 'Drinks print on the bar printer when an order is sent.' },
  { key: 'pos.discounts', group: 'POS', title: 'Discounts', description: 'Staff can take money off a bill (a manager PIN approves it).' },
  { key: 'pos.refunds', group: 'POS', title: 'Refunds', description: 'Full or part refunds on POS orders, at the till or from the admin.' },
  { key: 'pos.reports', group: 'POS', title: 'Sales reports', description: 'Daily and date-range sales reports in the restaurant’s admin.' },
  { key: 'pos.printOnlineOrders', group: 'POS', title: 'Print online orders', description: 'Web orders also print in the kitchen through the main POS.' },
  { key: 'online.ordering', group: 'Online', title: 'Online ordering', description: 'Storefront ordering. Always on for now; the restaurant opens and closes it from its own admin.' },
];
