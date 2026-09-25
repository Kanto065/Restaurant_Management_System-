export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

/** "Star Spice" -> "star-spice" */
export function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
