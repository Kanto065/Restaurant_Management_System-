/** 12-hour clock without leading zero, UK takeaway style: "7:45pm", "12pm". */
export function formatClock(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour12}:${String(m).padStart(2, '0')}${suffix}` : `${hour12}${suffix}`;
}

/** "26 Sep, 7:45pm" - or just "7:45pm" when it's today. */
export function formatDayAndClock(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? formatClock(d) : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${formatClock(d)}`;
}

/** Whole minutes from now until `date` (negative when it's in the past). */
export function minutesUntil(date: Date | string, now: number = Date.now()): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Math.round((d.getTime() - now) / 60000);
}

/** "in 18 min", "in 1 hr 5 min", "due now", "12 min late". */
export function describeCountdown(minutes: number): string {
  if (minutes === 0) return 'due now';
  const abs = Math.abs(minutes);
  const text = abs >= 60 ? `${Math.floor(abs / 60)} hr${abs % 60 ? ` ${abs % 60} min` : ''}` : `${abs} min`;
  return minutes > 0 ? `in ${text}` : `${text} late`;
}
