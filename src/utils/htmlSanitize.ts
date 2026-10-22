const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'hr',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target']),
  img: new Set(['src', 'alt', 'width', 'height', 'style']),
  span: new Set(['style']),
  div: new Set(['style']),
  p: new Set(['style']),
  td: new Set(['style', 'colspan']),
  th: new Set(['style', 'colspan']),
  table: new Set(['style']),
  li: new Set(['style']),
};

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', 'data:']);

const SAFE_STYLE_PATTERN = /^(color|background-color|font-size|font-weight|font-style|text-align|text-decoration|width|height|margin|padding|line-height|border|border-radius|display):\s*[^;]+;?\s*$/i;

export function sanitizeHtml(html: string): string {
  if (typeof document === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  cleanNode(doc.body);
  return doc.body.innerHTML;
}

function cleanNode(node: Node): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'embed') {
          el.remove();
          continue;
        }
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
          continue;
        }
      }
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        const allowedForTag = ALLOWED_ATTRS[tag];
        if (!allowedForTag || !allowedForTag.has(name)) {
          if (name.startsWith('on')) {
            el.removeAttribute(attr.name);
            continue;
          }
          if (name === 'href' || name === 'src') {
            try {
              const url = new URL(el.getAttribute(attr.name) || '', window.location.origin);
              if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
                el.removeAttribute(attr.name);
              }
            } catch {
              el.removeAttribute(attr.name);
            }
            continue;
          }
          el.removeAttribute(attr.name);
        } else if (name === 'style') {
          const value = el.getAttribute(attr.name) || '';
          const declarations = value.split(';').map(d => d.trim()).filter(Boolean);
          const safe = declarations.filter(d => SAFE_STYLE_PATTERN.test(d));
          el.setAttribute('style', safe.join('; '));
        }
      }
      cleanNode(el);
    } else if (child.nodeType === Node.COMMENT_NODE) {
      node.removeChild(child);
    }
  }
}
