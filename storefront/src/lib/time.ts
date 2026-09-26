// Shared by both storefronts (Star Spice imports it via @shared).

/** "23:00" -> "11pm", "12:30" -> "12:30pm" (UK takeaway style). */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour12}:${String(m).padStart(2, '0')}${suffix}` : `${hour12}${suffix}`;
}

/** A date's time of day as "7:45pm". */
export function formatTimeOfDay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatClock(`${d.getHours()}:${d.getMinutes()}`);
}

/** "26 Sept 2026, 7:45pm" */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${formatTimeOfDay(d)}`;
}

/**
 * Customer-facing wording for the built-in order statuses (same on every storefront). Custom
 * statuses a restaurant adds in its admin show as-is - they're already plain text.
 */
export const ORDER_STEP_LABELS: Record<string, string> = {
  Pending: 'Order placed',
  Confirmed: 'Confirmed',
  Preparing: 'Being prepared',
  Ready: 'Ready',
  OutForDeliveryOrServed: 'On its way',
  Completed: 'Completed',
};

/** "Estimated delivery" / "Estimated ready" etc. for the tracking page. */
export function estimateLabel(orderType: string): string {
  if (orderType === 'Delivery') return 'Estimated delivery';
  if (orderType === 'DineIn') return 'Estimated serving time';
  return 'Estimated ready';
}
