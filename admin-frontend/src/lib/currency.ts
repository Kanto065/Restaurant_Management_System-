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
  return CURRENCY_SYMBOLS[code ?? 'GBP'] ?? (code ?? '£');
}
