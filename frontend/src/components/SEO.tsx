import React, { useEffect } from 'react';

export const DEFAULT_SITE_NAME = 'GhostURL';
export const DEFAULT_TITLE = 'GhostURL — Share links and files that disappear.';
export const DEFAULT_DESCRIPTION =
  "GhostURL lets you share links and files that automatically disappear. No account needed. Nothing stored. Just share and it's gone.";
export const DEFAULT_CANONICAL = 'https://www.ghosturl.web.id/';
export const DEFAULT_OG_IMAGE = 'https://www.ghosturl.web.id/og-image.svg';

export interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  noIndex?: boolean;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export const SEO: React.FC<SEOProps> = ({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  noIndex = false,
  jsonLd,
}) => {
  const fullTitle = title ? `${title} — ${DEFAULT_SITE_NAME}` : DEFAULT_TITLE;
  const canonicalUrl = canonical || (noIndex ? '' : DEFAULT_CANONICAL);

  useEffect(() => {
    // Synchronize document title
    document.title = fullTitle;

    // Helper to update or create meta tag
    const updateMeta = (nameOrProperty: 'name' | 'property', key: string, content: string) => {
      let element = document.querySelector(`meta[${nameOrProperty}="${key}"]`) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(nameOrProperty, key);
        document.head.appendChild(element);
      }
      element.content = content;
    };

    // Helper to update or create link tag
    const updateLink = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!element) {
        element = document.createElement('link');
        element.rel = rel;
        document.head.appendChild(element);
      }
      element.href = href;
    };

    updateMeta('name', 'description', description);
    updateMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    updateMeta('property', 'og:title', fullTitle);
    updateMeta('property', 'og:description', description);
    updateMeta('property', 'og:type', ogType);
    if (canonicalUrl) {
      updateMeta('property', 'og:url', canonicalUrl);
      updateLink('canonical', canonicalUrl);
    }
    updateMeta('property', 'og:image', ogImage);
    updateMeta('name', 'twitter:title', fullTitle);
    updateMeta('name', 'twitter:description', description);
    updateMeta('name', 'twitter:image', ogImage);
  }, [fullTitle, description, canonicalUrl, ogImage, ogType, noIndex]);

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      <meta property="og:site_name" content={DEFAULT_SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:image" content={ogImage} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          }}
        />
      )}
    </>
  );
};

export default SEO;
