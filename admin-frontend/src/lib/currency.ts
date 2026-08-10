const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  AUD: '$',
  CAD: '$',
  INR: '₹',
  BDT: '৳',
};

export function currencySymbol(code: string | undefined | null): string {
  const normalized = code || 'GBP';
  return CURRENCY_SYMBOLS[normalized] ?? normalized;
}
