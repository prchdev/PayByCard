import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getSeoMeta } from './seoConfig';

const OG_IMAGE = 'https://paybycard.in/PayByCard-Logo.png';

function setMetaTag(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonical(href: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export function useSeoMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = getSeoMeta(pathname);

    document.title = meta.title;
    setMetaTag('name', 'description', meta.description);
    setMetaTag('name', 'keywords', meta.keywords);
    setCanonical(meta.canonical ?? `https://paybycard.in${pathname}`);

    setMetaTag('property', 'og:title', meta.title);
    setMetaTag('property', 'og:description', meta.description);
    setMetaTag('property', 'og:url', meta.canonical ?? `https://paybycard.in${pathname}`);
    setMetaTag('property', 'og:image', OG_IMAGE);

    setMetaTag('name', 'twitter:title', meta.title);
    setMetaTag('name', 'twitter:description', meta.description);
    setMetaTag('name', 'twitter:image', OG_IMAGE);
  }, [pathname]);
}
