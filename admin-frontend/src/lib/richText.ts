// Card previews show descriptions as plain text; the stored value may be rich HTML.
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';
  const spaced = html.replace(/<\/(p|li)>/gi, ' </$1>').replace(/<br\s*\/?>/gi, ' ');
  const doc = new DOMParser().parseFromString(spaced, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}
