import { prisma } from '@/shared/infra/prisma';
import { cache } from '@/shared/infra/memory-cache';
import { BASE_URL, STATIC_PAGES, SITEMAP_CACHE_KEY, SITEMAP_CACHE_TTL_SECONDS } from '@/config/seo';

type CategoryWithParent = {
  id: string;
  title: string;
};

function buildBreadcrumbItems(
  category: CategoryWithParent | null | undefined,
  baseUrl: string,
): Array<{ '@type': string; position: number; name: string; item: string }> {
  if (!category) return [];

  return [category].map((cat, idx) => ({
    '@type': 'ListItem',
    position: idx + 2, // position 1 = Home
    name: cat.title,
    item: `${baseUrl}/categories/${cat.id}`,
  }));
}

export class SeoService {
  async generateSitemap(): Promise<string> {
    // Check cache first (D-03)
    const cached = cache.get<string>(SITEMAP_CACHE_KEY);
    if (cached) return cached;

    // Fetch all products and categories
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        select: { code: true, updatedAt: true },
      }),
      prisma.productCategory.findMany({
        select: { id: true, updatedAt: true },
      }),
    ]);

    const toDateStr = (d: Date) => d.toISOString().split('T')[0];

    const urls: string[] = [];

    // Static pages (no lastmod — no DB record)
    for (const page of STATIC_PAGES) {
      urls.push(`  <url>\n    <loc>${BASE_URL}${page.path}</loc>\n  </url>`);
    }

    // Categories
    for (const cat of categories) {
      urls.push(
        `  <url>\n    <loc>${BASE_URL}/categories/${cat.id}</loc>\n    <lastmod>${toDateStr(cat.updatedAt)}</lastmod>\n  </url>`,
      );
    }

    // Products (D-04: lastmod from updatedAt)
    for (const prod of products) {
      urls.push(
        `  <url>\n    <loc>${BASE_URL}/products/${prod.code}</loc>\n    <lastmod>${toDateStr(prod.updatedAt)}</lastmod>\n  </url>`,
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;

    // Store in cache for 1 hour (D-03)
    cache.set(SITEMAP_CACHE_KEY, xml, SITEMAP_CACHE_TTL_SECONDS);

    return xml;
  }

  getRobotsTxt(): string {
    // D-15: configurable via ROBOTS_TXT_RULES env, fallback to permissive default
    if (process.env['ROBOTS_TXT_RULES']) {
      return process.env['ROBOTS_TXT_RULES'];
    }
    return `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml`;
  }

  // Schema.org Product JSON-LD (D-09, D-10)
  async getProductSchema(code: string): Promise<object> {
    const product = await prisma.product.findUnique({
      where: { code },
      include: {
        category: true,
      },
    });
    if (!product) throw new Error('PRODUCT_NOT_FOUND');

    // Build breadcrumb trail (D-11: dynamic via parentId)
    const breadcrumbItems = buildBreadcrumbItems(product.category, BASE_URL);

    const productSchema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      description: product.description ?? undefined,
      image: Array.isArray(product.carousel_image)
        ? (product.carousel_image[0] as string | undefined)
        : undefined,
      offers: {
        '@type': 'Offer',
        price: Number(product.pricing),
        priceCurrency: 'BRL',
        availability:
          product.quantity_stock > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        url: `${BASE_URL}/products/${product.code}`,
      },
      aggregateRating:
        product.reviews > 0
          ? {
              '@type': 'AggregateRating',
              ratingValue: product.reviews,
              reviewCount: product.reviews,
            }
          : undefined,
    };

    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
        ...breadcrumbItems,
        {
          '@type': 'ListItem',
          position: breadcrumbItems.length + 2,
          name: product.title,
          item: `${BASE_URL}/products/${product.code}`,
        },
      ],
    };

    return [productSchema, breadcrumbSchema];
  }

  // Schema.org BreadcrumbList for category (D-09, D-10)
  async getCategorySchema(id: string): Promise<object> {
    const category = await prisma.productCategory.findUnique({
      where: { id },
    });
    if (!category) throw new Error('CATEGORY_NOT_FOUND');

    const breadcrumbItems = buildBreadcrumbItems(category, BASE_URL);

    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
        ...breadcrumbItems,
      ],
    };
  }
}
