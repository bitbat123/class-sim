import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

/**
 * Convert Markdown to HTML and sanitize it with DOMPurify.
 * Raw HTML in the source is never trusted: the output always goes through DOMPurify.
 */
export function renderMarkdown(text) {
  const raw = marked.parse(String(text ?? ''), { async: false });
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}
