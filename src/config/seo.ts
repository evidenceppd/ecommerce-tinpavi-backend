export const BASE_URL = (process.env['APP_BASE_URL'] ?? 'http://localhost:3000').replace(/\/$/, '');

// Static pages to include in sitemap (per D-02)
export const STATIC_PAGES: { path: string; changefreq?: string }[] = [
  { path: '/sobre' },
  { path: '/contato' },
  { path: '/faq' },
];

export const SITEMAP_CACHE_TTL_SECONDS = 60 * 60; // 1 hour (D-03)
export const SITEMAP_CACHE_KEY = 'seo:sitemap';
