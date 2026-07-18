import DOMPurify, { type Config } from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Allows common markdown output tags, blocks scripts and event handlers.
 */
const ALLOWED_TAGS = [
  'a', 'strong', 'em', 'code', 'pre', 'p', 'br', 'hr',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'img', 'span', 'div', 'table', 'thead',
  'tbody', 'tr', 'th', 'td', 'del', 'ins', 'sub', 'sup',
];

const ALLOWED_ATTR = [
  'href', 'title', 'alt', 'src', 'class', 'target', 'rel',
  'width', 'height', 'colspan', 'rowspan',
];

const SANITIZE_CONFIG: Config = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp|tel|data:image\/(?:png|jpeg|gif|webp)):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea'],
};

/**
 * Sanitize HTML string to prevent XSS.
 * @param html - Raw HTML string from user input
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG) as string;
}
