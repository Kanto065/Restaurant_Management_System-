import { useMemo } from 'react';
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i'];
const HAS_MARKUP = /<\/?(p|ul|ol|li|br|strong|em|b|i)\b/i;

// Item descriptions are HTML from the admin rich editor; older ones are plain text with \n.
export default function RichDescription({ html, className = '' }: { html: string; className?: string }) {
  const clean = useMemo(
    () => (HAS_MARKUP.test(html) ? DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] }) : null),
    [html]
  );

  if (clean === null) return <p className={`whitespace-pre-line ${className}`}>{html}</p>;
  return <div className={`rich-description ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
