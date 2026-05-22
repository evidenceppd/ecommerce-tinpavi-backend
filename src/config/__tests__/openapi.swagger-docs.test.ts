import { describe, expect, it } from 'vitest';

import { openApiDocument, swaggerHtml, swaggerInitScript, swaggerUiAssetsPath } from '../openapi';

describe('swagger docs csp compatibility', () => {
  it('serves Swagger assets from self origin only', () => {
    expect(swaggerHtml).toContain('/docs/assets/swagger-ui.css');
    expect(swaggerHtml).toContain('/docs/assets/swagger-ui-bundle.js');
    expect(swaggerHtml).toContain('/docs/assets/swagger-ui-standalone-preset.js');
    expect(swaggerHtml).not.toContain('https://cdn.jsdelivr.net');
  });

  it('uses external init script instead of inline script', () => {
    expect(swaggerHtml).toContain('/docs/swagger-init.js');
    expect(swaggerHtml).not.toContain('<script>');
    expect(swaggerInitScript).toContain("url: '/docs/openapi.json'");
  });

  it('resolves local swagger ui assets path', () => {
    expect(typeof swaggerUiAssetsPath).toBe('string');
    expect(swaggerUiAssetsPath.length).toBeGreaterThan(0);
  });

  it('documents backend routes that are mounted in app', () => {
    const requiredPaths = [
      '/auth/register',
      '/users/me',
      '/me/profile',
      '/admin/customers/{id}',
      '/admin/products/{id}',
      '/orders/{id}/cancel',
      '/admin/orders/{id}/status',
      '/me/orders/{id}/pay',
      '/me/shipping/quotes',
      '/analytics/track',
      '/blogs/published',
      '/admin/reports/low-stock',
    ];

    for (const path of requiredPaths) {
      expect(openApiDocument.paths[path as keyof typeof openApiDocument.paths]).toBeDefined();
    }
  });

  it('uses response codes aligned with implemented auth controllers', () => {
    expect(openApiDocument.paths['/auth/register']?.post?.responses?.['201']).toBeDefined();
    expect(openApiDocument.paths['/auth/logout']?.post?.responses?.['204']).toBeDefined();
  });
});
