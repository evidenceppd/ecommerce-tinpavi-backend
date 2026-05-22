import { describe, expect, it } from 'vitest';
import type { Router } from 'express';

import { vi } from 'vitest';

vi.mock('../admin.controller', () => ({
  dashboardOverviewController: vi.fn(),
  salesReportController: vi.fn(),
  lowStockReportController: vi.fn(),
}));

vi.mock('@/modules/customers/customers.controller', () => ({
  adminGetCustomerController: vi.fn(),
  adminListCustomersController: vi.fn(),
  adminUpdateCustomerController: vi.fn(),
  adminCreateCustomerController: vi.fn(),
  adminDeleteCustomerController: vi.fn(),
  createAddressController: vi.fn(),
  deleteAddressController: vi.fn(),
  getOrderHistoryController: vi.fn(),
  getProfileController: vi.fn(),
  listAddressesController: vi.fn(),
  updateAddressController: vi.fn(),
  updateProfileController: vi.fn(),
}));

vi.mock('@/modules/orders/orders.controller', () => ({
  checkoutController: vi.fn(),
  listMyOrdersController: vi.fn(),
  getMyOrderController: vi.fn(),
  cancelMyOrderController: vi.fn(),
  adminListOrdersController: vi.fn(),
  adminGetOrderController: vi.fn(),
  adminUpdateOrderStatusController: vi.fn(),
}));

vi.mock('@/modules/catalog/catalog.controller', () => ({
  listProductsController: vi.fn(),
  getProductController: vi.fn(),
  listAdminProductsController: vi.fn(),
  getAdminProductController: vi.fn(),
  createProductController: vi.fn(),
  updateProductController: vi.fn(),
  deleteProductController: vi.fn(),
  addVariantController: vi.fn(),
  deleteVariantController: vi.fn(),
  uploadImageController: vi.fn(),
  deleteImageController: vi.fn(),
  reorderImagesController: vi.fn(),
}));

vi.mock('@/modules/reviews/reviews.controller', () => ({
  listReviewsController: vi.fn(),
  reviewEligibilityController: vi.fn(),
  createReviewController: vi.fn(),
  updateMyReviewController: vi.fn(),
  deleteMyReviewController: vi.fn(),
  adminListReviewsController: vi.fn(),
  adminModerateReviewController: vi.fn(),
}));

import { adminOperationsRouter } from '../admin.routes';
import { adminCustomersRouter } from '@/modules/customers/customers.routes';
import { adminOrdersRouter } from '@/modules/orders/orders.routes';
import { adminCatalogRouter } from '@/modules/catalog/catalog.routes';
import { adminReviewsRouter } from '@/modules/reviews/reviews.routes';

type RouteSignature = {
  method: string;
  path: string;
};

function getRouteSignatures(router: Router): RouteSignature[] {
  const stack = ((router as unknown as { stack?: unknown[] }).stack ?? []) as Array<{
    route?: { path?: string; methods?: Record<string, boolean> };
  }>;

  const routes: RouteSignature[] = [];

  for (const layer of stack) {
    if (!layer.route?.path || !layer.route.methods) {
      continue;
    }

    for (const [method, enabled] of Object.entries(layer.route.methods)) {
      if (enabled) {
        routes.push({ method: method.toUpperCase(), path: String(layer.route.path) });
      }
    }
  }

  return routes;
}

function hasRequireAdminMiddleware(router: Router): boolean {
  const stack = ((router as unknown as { stack?: unknown[] }).stack ?? []) as Array<{
    route?: unknown;
    name?: string;
    handle?: { name?: string };
  }>;

  return stack.some((layer) => {
    if (layer.route) {
      return false;
    }

    return layer.name === 'requireAdmin' || layer.handle?.name === 'requireAdmin';
  });
}

function expectRoutes(router: Router, expected: RouteSignature[]): void {
  const actual = getRouteSignatures(router);

  for (const route of expected) {
    expect(actual).toContainEqual(route);
  }
}

describe('Admin Route Contracts', () => {
  it('exposes dashboard and report endpoints behind admin middleware', () => {
    expect(hasRequireAdminMiddleware(adminOperationsRouter)).toBe(true);
    expectRoutes(adminOperationsRouter, [
      { method: 'GET', path: '/dashboard' },
      { method: 'GET', path: '/reports/sales' },
      { method: 'GET', path: '/reports/low-stock' },
    ]);
  });

  it('keeps admin customer management endpoints available', () => {
    expect(hasRequireAdminMiddleware(adminCustomersRouter)).toBe(true);
    expectRoutes(adminCustomersRouter, [
      { method: 'GET', path: '/' },
      { method: 'GET', path: '/:id' },
      { method: 'PATCH', path: '/:id' },
    ]);
  });

  it('keeps admin order management endpoints available', () => {
    expect(hasRequireAdminMiddleware(adminOrdersRouter)).toBe(true);
    expectRoutes(adminOrdersRouter, [
      { method: 'GET', path: '/' },
      { method: 'GET', path: '/:id' },
      { method: 'PATCH', path: '/:id/status' },
    ]);
  });

  it('keeps admin product management collection and item endpoints available', () => {
    expectRoutes(adminCatalogRouter, [
      { method: 'GET', path: '/' },
      { method: 'GET', path: '/:id' },
      { method: 'POST', path: '/' },
      { method: 'PUT', path: '/:id' },
      { method: 'DELETE', path: '/:id' },
    ]);
  });

  it('keeps admin review moderation endpoints available', () => {
    expect(hasRequireAdminMiddleware(adminReviewsRouter)).toBe(true);
    expectRoutes(adminReviewsRouter, [
      { method: 'GET', path: '/' },
      { method: 'PATCH', path: '/:id' },
    ]);
  });
});
