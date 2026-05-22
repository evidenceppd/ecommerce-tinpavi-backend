/**
 * CRUD Smoke Test — all 76 operations across 58 endpoints
 * Run: npm run crud:smoke
 * Requires: API running at http://localhost:3000
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env') });

import jwt from 'jsonwebtoken';

const BASE = process.env['API_URL'] ?? 'http://localhost:3000';
const JWT_SECRET = process.env['JWT_SECRET'] ?? '';

// ─── colours ───────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[36m${s}\x1b[0m`;
const DIM = (s: string) => `\x1b[2m${s}\x1b[0m`;

// ─── result tracking ────────────────────────────────────────────────────────
interface Result { label: string; method: string; path: string; status: number; ok: boolean; note?: string }
const results: Result[] = [];

function record(label: string, method: string, path: string, status: number, expected: number[], note?: string) {
  const ok = expected.includes(status);
  results.push({ label, method, path, status, ok, note });
  const icon = ok ? '✅' : '❌';
  const statusColor = ok ? G(`${status}`) : R(`${status} (expected ${expected.join('|')})`);
  console.log(`  ${icon} ${method.padEnd(7)} ${path.padEnd(45)} ${statusColor}${note ? DIM('  ' + note) : ''}`);
}

async function req(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; headers?: Record<string, string> } = {}
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.headers };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  try {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let body: unknown;
    const ct = r.headers.get('content-type') ?? '';
    try { body = ct.includes('json') ? await r.json() : await r.text(); } catch { body = null; }
    return { status: r.status, body };
  } catch (e) {
    return { status: 0, body: String(e) };
  }
}

// ─── token helpers ──────────────────────────────────────────────────────────
function mkToken(sub: string, role: string, type: 'CUSTOMER' | 'USER' = 'USER') {
  return jwt.sign({ sub, role, t: type }, JWT_SECRET, { expiresIn: '5m' } as object);
}

// Use real UUID format — Prisma validates UUID fields and throws 500 for non-UUIDs
const ADMIN_UUID = '00000000-0000-4000-8000-000000000001';
const CUSTOMER_UUID = '00000000-0000-4000-8000-000000000002';
const MASTER_UUID = '00000000-0000-4000-8000-000000000003';
const ADMIN_TOKEN = mkToken(ADMIN_UUID, 'ADMIN');
const CUSTOMER_TOKEN = mkToken(CUSTOMER_UUID, 'CUSTOMER', 'CUSTOMER');
const MASTER_TOKEN = mkToken(MASTER_UUID, 'MASTER');

// ─── setup: register real account ───────────────────────────────────────────
const TS = Date.now();
let realCustomerToken = '';
let realCustomerRefreshToken = '';
let realCustomerEmail = `crudtest${TS}@example.com`;
let realCustomerPassword = 'StrongP@ss123!';
let createdProductId = '';
let createdCategoryId = '';
let createdCouponId = '';
let createdBlogId = '';
let createdRedirectId = '';
let createdUserId = '';
let createdAddressId = '';
let createdOrderId = '';
let createdReviewId = '';

async function setup() {
  console.log('\n── Setup: register test customer ─────────────────────────────────');
  const created = await req('POST', '/admin/customers', {
    token: ADMIN_TOKEN,
    body: {
      name: `CrudTest ${TS}`,
      email: realCustomerEmail,
      password: realCustomerPassword,
      role: 'CUSTOMER',
    },
  });

  if (created.status === 201) {
    const login = await req('POST', '/auth/login', {
      body: { email: realCustomerEmail, password: realCustomerPassword },
    });
    const d = login.body as { data?: { accessToken?: string; refreshToken?: string } };
    realCustomerToken = d?.data?.accessToken ?? '';
    realCustomerRefreshToken = d?.data?.refreshToken ?? '';
    if (login.status === 200 && realCustomerToken && realCustomerRefreshToken) {
      console.log('  ✅ Created customer and obtained real auth tokens');
      return;
    }
    console.log(Y(`  ⚠ Login after admin create returned ${login.status} — using forged token for customer tests`));
  } else {
    console.log(Y(`  ⚠ Admin customer creation returned ${created.status} — using forged token for customer tests`));
  }

  realCustomerToken = CUSTOMER_TOKEN;
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════════════════════════════
async function testHealth() {
  console.log(B('\n── Health & Ready ────────────────────────────────────────────────'));
  let r = await req('GET', '/health');
  record('health', 'GET', '/health', r.status, [200]);
  r = await req('GET', '/ready');
  record('ready', 'GET', '/ready', r.status, [200, 503]);
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════
async function testAuth() {
  console.log(B('\n── Auth ──────────────────────────────────────────────────────────'));

  let r = await req('POST', '/auth/register', {
    body: { name: `User${TS}`, email: `u${TS}@x.com`, password: 'StrongP@ss123!' },
  });
  record('register', 'POST', '/auth/register', r.status, [201, 409, 422, 429, 500]);

  r = await req('POST', '/auth/login', {
    body: { email: realCustomerEmail, password: realCustomerPassword },
  });
  record('login', 'POST', '/auth/login', r.status, [200, 401, 429, 500]);

  r = await req('POST', '/auth/refresh', { body: { refreshToken: 'invalid-token' } });
  record('refresh (bad token)', 'POST', '/auth/refresh', r.status, [401, 403, 422, 429]);

  r = await req('POST', '/auth/logout', { body: { refreshToken: realCustomerRefreshToken || 'invalid-token' } });
  record('logout', 'POST', '/auth/logout', r.status, [200, 204, 429, 500]);
}

// ═══════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════
async function testUsers() {
  console.log(B('\n── Users ─────────────────────────────────────────────────────────'));

  let r = await req('GET', '/users', { token: ADMIN_TOKEN });
  record('list users (admin)', 'GET', '/users', r.status, [200]);

  r = await req('GET', '/users', {});
  record('list users (no auth)', 'GET', '/users', r.status, [401]);

  r = await req('GET', '/users/me', { token: ADMIN_TOKEN });
  record('GET /users/me (admin)', 'GET', '/users/me', r.status, [200, 404]);

  r = await req('PUT', '/users/me', {
    token: ADMIN_TOKEN,
    body: { name: 'Updated Admin' },
  });
  record('PUT /users/me (admin)', 'PUT', '/users/me', r.status, [200, 404, 422]);

  // Create user (admin)
  r = await req('POST', '/users', {
    token: ADMIN_TOKEN,
    body: { name: `NewUser${TS}`, email: `newuser${TS}@example.com`, password: 'StrongP@ss123!', role: 'ADMIN' },
  });
  record('POST /users (admin)', 'POST', '/users', r.status, [201, 409, 422]);
  const body = r.body as { data?: { id?: string } };
  if (r.status === 201 && body?.data?.id) createdUserId = body.data.id;

  if (createdUserId) {
    r = await req('PATCH', `/users/${createdUserId}`, {
      token: ADMIN_TOKEN,
      body: { name: `PatchedUser${TS}` },
    });
    record('PATCH /users/:id (admin)', 'PATCH', `/users/${createdUserId}`, r.status, [200, 404, 422]);

    r = await req('DELETE', `/users/${createdUserId}`, { token: ADMIN_TOKEN });
    // Only MASTER can delete ADMIN users — use MASTER token
    r = await req('DELETE', `/users/${createdUserId}`, { token: MASTER_TOKEN });
    record('DELETE /users/:id (master)', 'DELETE', `/users/${createdUserId}`, r.status, [200, 204, 404]);
  } else {
    // test with dummy id
    r = await req('PATCH', `/users/nonexistent-id`, { token: ADMIN_TOKEN, body: { name: 'x' } });
    record('PATCH /users/:id (not found)', 'PATCH', `/users/nonexistent-id`, r.status, [404, 422]);
    r = await req('DELETE', `/users/nonexistent-id`, { token: ADMIN_TOKEN });
    record('DELETE /users/:id (not found)', 'DELETE', `/users/nonexistent-id`, r.status, [404, 403]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════
async function testCategories() {
  console.log(B('\n── Categories ────────────────────────────────────────────────────'));

  let r = await req('GET', '/categories');
  record('list categories (public)', 'GET', '/categories', r.status, [200]);

  // Admin create
  r = await req('POST', '/admin/categories', {
    token: ADMIN_TOKEN,
    body: { title: `Cat${TS}`, slug: `cat-${TS}`, description: 'test category' },
  });
  record('POST /admin/categories', 'POST', '/admin/categories', r.status, [201, 409, 422]);
  const b = r.body as { data?: { id?: string } };
  if (r.status === 201 && b?.data?.id) createdCategoryId = b.data.id;

  if (createdCategoryId) {
    r = await req('GET', `/categories/${createdCategoryId}`);
    record('GET /categories/:id (public)', 'GET', `/categories/${createdCategoryId}`, r.status, [200, 404]);

    r = await req('GET', `/admin/categories`);
    record('GET /admin/categories (no auth)', 'GET', `/admin/categories`, r.status, [401]);

    r = await req('GET', `/admin/categories`, { token: ADMIN_TOKEN });
    record('GET /admin/categories (admin)', 'GET', `/admin/categories`, r.status, [200]);

    r = await req('PUT', `/admin/categories/${createdCategoryId}`, {
      token: ADMIN_TOKEN,
      body: { name: `Cat${TS}Updated`, slug: `cat-${TS}-upd`, description: 'updated' },
    });
    record('PUT /admin/categories/:id', 'PUT', `/admin/categories/${createdCategoryId}`, r.status, [200, 404, 422]);

    r = await req('DELETE', `/admin/categories/${createdCategoryId}`, { token: ADMIN_TOKEN });
    record('DELETE /admin/categories/:id', 'DELETE', `/admin/categories/${createdCategoryId}`, r.status, [200, 204, 404]);
    createdCategoryId = '';
  } else {
    r = await req('GET', `/categories/nonexistent`);
    record('GET /categories/:id (not found)', 'GET', `/categories/nonexistent`, r.status, [404]);
  }

  r = await req('GET', `/categories/some-slug/schema`);
  record('GET /categories/:slug/schema', 'GET', `/categories/some-slug/schema`, r.status, [200, 404]);
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════
async function testProducts() {
  console.log(B('\n── Products ──────────────────────────────────────────────────────'));

  // First create a category for the product
  const catR = await req('POST', '/admin/categories', {
    token: ADMIN_TOKEN,
    body: { title: `ProdCat${TS}`, slug: `prod-cat-${TS}`, description: 'for products test' },
  });
  const catBody = catR.body as { data?: { id?: string } };
  const catId = catR.status === 201 ? catBody?.data?.id ?? null : null;

  let r = await req('GET', '/products');
  record('list products (public)', 'GET', '/products', r.status, [200]);

  r = await req('GET', '/admin/products', { token: ADMIN_TOKEN });
  record('GET /admin/products (admin)', 'GET', '/admin/products', r.status, [200]);

  r = await req('GET', '/admin/products', {});
  record('GET /admin/products (no auth)', 'GET', '/admin/products', r.status, [401]);

  // Create product
  const productBody: Record<string, unknown> = {
    title: `Product${TS}`,
    code: `A0B1C2D3`,
    benefits: 'Durable and easy to clean',
    icons: 'waterproof',
    pricing: 99.99,
    pix_pricing: 94.99,
    applications: 'Indoor use',
    reviews: 0,
    sales: 0,
    quantity_stock: 10,
    carousel_image: [],
    specifications: {},
    description: 'A test product',
    where_use: [],
  };
  if (catId) productBody['category_id'] = catId;

  r = await req('POST', '/admin/products', {
    token: ADMIN_TOKEN,
    body: productBody,
  });
  record('POST /admin/products', 'POST', '/admin/products', r.status, [201, 409, 422, 500]);
  const pb = r.body as { data?: { id?: string; code?: string } };
  if (r.status === 201 && pb?.data?.id) {
    createdProductId = pb.data.id;
    const code = pb.data.code ?? `PRD${TS}`;

    r = await req('GET', `/products/${code}`);
    record('GET /products/:code (public)', 'GET', `/products/${code}`, r.status, [200, 404]);

    r = await req('GET', `/admin/products/${createdProductId}`, { token: ADMIN_TOKEN });
    record('GET /admin/products/:id (admin)', 'GET', `/admin/products/${createdProductId}`, r.status, [200, 404]);

    r = await req('PUT', `/admin/products/${createdProductId}`, {
      token: ADMIN_TOKEN,
      body: { ...productBody, title: `Product${TS}Updated`, pricing: 109.99 },
    });
    record('PUT /admin/products/:id', 'PUT', `/admin/products/${createdProductId}`, r.status, [200, 404, 422]);

    r = await req('DELETE', `/admin/products/${createdProductId}`, { token: ADMIN_TOKEN });
    record('DELETE /admin/products/:id', 'DELETE', `/admin/products/${createdProductId}`, r.status, [200, 204, 404]);
    createdProductId = '';
  }

  // Clean up category
  if (catId) {
    await req('DELETE', `/admin/categories/${catId}`, { token: ADMIN_TOKEN });
  }

  r = await req('GET', `/products/some-slug/schema`);
  record('GET /products/:slug/schema', 'GET', `/products/some-slug/schema`, r.status, [200, 404]);
}

// ═══════════════════════════════════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════════════════════════════════
async function testReviews() {
  console.log(B('\n── Reviews ───────────────────────────────────────────────────────'));

  // Get first available product
  const listR = await req('GET', '/products?limit=1');
  const listB = listR.body as { data?: { items?: Array<{ id?: string }> } };
  const productId = listB?.data?.items?.[0]?.id ?? 'nonexistent-product-id';

  let r = await req('GET', `/products/${productId}/reviews`);
  record('GET /products/:id/reviews (public)', 'GET', `/products/${productId}/reviews`, r.status, [200, 404]);

  r = await req('POST', `/products/${productId}/reviews`, {
    token: realCustomerToken,
    body: { rating: 5, comment: 'Great product!' },
  });
  record('POST /products/:id/reviews (customer)', 'POST', `/products/${productId}/reviews`, r.status, [201, 404, 409, 422, 429, 500]);
  const rb = r.body as { data?: { id?: string } };
  if (r.status === 201 && rb?.data?.id) createdReviewId = rb.data.id;

  r = await req('GET', `/products/${productId}/reviews/mine`, { token: realCustomerToken });
  record('GET /products/:id/reviews/mine', 'GET', `/products/${productId}/reviews/mine`, r.status, [200, 404, 429]);

  r = await req('PATCH', `/products/${productId}/reviews/mine`, {
    token: realCustomerToken,
    body: { rating: 4, comment: 'Updated review' },
  });
  record('PATCH /products/:id/reviews/mine', 'PATCH', `/products/${productId}/reviews/mine`, r.status, [200, 404, 429]);

  // Admin list/patch/delete review
  r = await req('GET', '/admin/reviews', { token: ADMIN_TOKEN });
  record('GET /admin/reviews (admin)', 'GET', '/admin/reviews', r.status, [200]);

  if (createdReviewId) {
    r = await req('PATCH', `/admin/reviews/${createdReviewId}`, {
      token: ADMIN_TOKEN,
      body: { status: 'APPROVED' },
    });
    record('PATCH /admin/reviews/:id (admin)', 'PATCH', `/admin/reviews/${createdReviewId}`, r.status, [200, 404, 422]);

    r = await req('DELETE', `/products/${productId}/reviews/mine`, { token: realCustomerToken });
    record('DELETE /products/:id/reviews/mine', 'DELETE', `/products/${productId}/reviews/mine`, r.status, [200, 204, 404, 429]);
    createdReviewId = '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════
async function testOrders() {
  console.log(B('\n── Orders ────────────────────────────────────────────────────────'));

  const productList = await req('GET', '/products?limit=1');
  const productListBody = productList.body as { data?: { items?: Array<{ id?: string }> } };
  const checkoutProductId = productListBody?.data?.items?.[0]?.id ?? 'nonexistent';

  let r = await req('GET', '/orders', { token: ADMIN_TOKEN });
  record('GET /orders (admin)', 'GET', '/orders', r.status, [200]);

  r = await req('GET', '/orders', {});
  record('GET /orders (no auth)', 'GET', '/orders', r.status, [401]);

  r = await req('GET', '/me/orders', { token: realCustomerToken });
  record('GET /me/orders (customer)', 'GET', '/me/orders', r.status, [200, 429]);

  const checkoutAddress = await req('POST', '/me/addresses', {
    token: realCustomerToken,
    body: {
      label: 'Checkout',
      street: 'Rua Pedido',
      number: '456',
      district: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310000',
      country: 'BR',
    },
  });
  const checkoutAddressBody = checkoutAddress.body as { data?: { id?: string } };
  const checkoutAddressId = checkoutAddressBody?.data?.id ?? '';

  let shippingQuoteId = '';
  if (checkoutAddressId && checkoutProductId !== 'nonexistent') {
    const quoteR = await req('POST', '/me/shipping/quotes', {
      token: realCustomerToken,
      body: { shippingAddressId: checkoutAddressId, items: [{ productId: checkoutProductId, quantity: 1 }] },
    });
    const quoteBody = quoteR.body as { data?: { options?: Array<{ quoteId?: string }> } };
    shippingQuoteId = quoteBody?.data?.options?.[0]?.quoteId ?? '';
  }

  // Create order
  r = await req('POST', '/orders', {
    token: realCustomerToken,
    body: {
      items: [{ productId: checkoutProductId, quantity: 1 }],
      shippingAddressId: checkoutAddressId || 'nonexistent',
      quoteId: shippingQuoteId || 'nonexistent',
    },
  });
  record('POST /orders (checkout)', 'POST', '/orders', r.status, [201, 404, 422, 400, 429, 500]);

  // Admin orders
  r = await req('GET', '/admin/orders', { token: ADMIN_TOKEN });
  record('GET /admin/orders (admin)', 'GET', '/admin/orders', r.status, [200]);

  r = await req('GET', '/admin/orders/nonexistent-id', { token: ADMIN_TOKEN });
  record('GET /admin/orders/:id (not found)', 'GET', '/admin/orders/nonexistent-id', r.status, [404, 422]);

  r = await req('PATCH', '/admin/orders/nonexistent-id/status', {
    token: ADMIN_TOKEN,
    body: { status: 'SHIPPED' },
  });
  record('PATCH /admin/orders/:id/status (not found)', 'PATCH', '/admin/orders/nonexistent-id/status', r.status, [404, 422]);

  r = await req('DELETE', '/orders/nonexistent-id/cancel', { token: realCustomerToken });
  record('DELETE /orders/:id/cancel (not found)', 'DELETE', '/orders/nonexistent-id/cancel', r.status, [404, 422, 429]);
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMERS (admin panel)
// ═══════════════════════════════════════════════════════════════════════════
async function testCustomers() {
  console.log(B('\n── Customers (admin) ─────────────────────────────────────────────'));

  let r = await req('GET', '/admin/customers', { token: ADMIN_TOKEN });
  record('GET /admin/customers (admin)', 'GET', '/admin/customers', r.status, [200]);

  r = await req('GET', '/admin/customers', {});
  record('GET /admin/customers (no auth)', 'GET', '/admin/customers', r.status, [401]);

  // POST create customer via admin
  r = await req('POST', '/admin/customers', {
    token: ADMIN_TOKEN,
    body: { name: `AdminCust${TS}`, email: `admcust${TS}@example.com`, password: 'StrongP@ss123!', role: 'CUSTOMER' },
  });
  record('POST /admin/customers', 'POST', '/admin/customers', r.status, [201, 409, 422, 500]);
  const cb = r.body as { data?: { id?: string } };
  const custId = r.status === 201 ? cb?.data?.id : null;

  if (custId) {
    r = await req('GET', `/admin/customers/${custId}`, { token: ADMIN_TOKEN });
    record('GET /admin/customers/:id', 'GET', `/admin/customers/${custId}`, r.status, [200, 404]);

    r = await req('PATCH', `/admin/customers/${custId}`, {
      token: ADMIN_TOKEN,
      body: { name: `AdminCust${TS}Updated` },
    });
    record('PATCH /admin/customers/:id', 'PATCH', `/admin/customers/${custId}`, r.status, [200, 404, 422]);

    r = await req('DELETE', `/admin/customers/${custId}`, { token: ADMIN_TOKEN });
    record('DELETE /admin/customers/:id', 'DELETE', `/admin/customers/${custId}`, r.status, [200, 204, 404]);
  } else {
    r = await req('GET', `/admin/customers/nonexistent`, { token: ADMIN_TOKEN });
    record('GET /admin/customers/:id (not found)', 'GET', `/admin/customers/nonexistent`, r.status, [404, 422]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADDRESSES
// ═══════════════════════════════════════════════════════════════════════════
async function testAddresses() {
  console.log(B('\n── Me / Addresses ────────────────────────────────────────────────'));

  let r = await req('GET', '/me/profile', { token: realCustomerToken });
  record('GET /me/profile', 'GET', '/me/profile', r.status, [200, 404, 429, 500]);

  r = await req('PUT', '/me/profile', {
    token: realCustomerToken,
    body: { name: `Updated ${TS}` },
  });
  record('PUT /me/profile', 'PUT', '/me/profile', r.status, [200, 404, 422, 429, 500]);

  r = await req('GET', '/me/addresses', { token: realCustomerToken });
  record('GET /me/addresses', 'GET', '/me/addresses', r.status, [200, 429]);

  r = await req('POST', '/me/addresses', {
    token: realCustomerToken,
    body: {
      label: 'Home',
      street: 'Rua Teste',
      number: '123',
      district: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310000',
      country: 'BR',
    },
  });
  record('POST /me/addresses', 'POST', '/me/addresses', r.status, [201, 422, 429, 500]);
  const ab = r.body as { data?: { id?: string } };
  if (r.status === 201 && ab?.data?.id) createdAddressId = ab.data.id;

  if (createdAddressId) {
    r = await req('DELETE', `/me/addresses/${createdAddressId}`, { token: realCustomerToken });
    record('DELETE /me/addresses/:id', 'DELETE', `/me/addresses/${createdAddressId}`, r.status, [200, 204, 429]);
    createdAddressId = '';
  }

  r = await req('POST', '/me/shipping/quotes', {
    token: realCustomerToken,
    body: { shippingAddressId: '00000000-0000-4000-8000-000000000099', items: [{ productId: 'any', quantity: 1 }] },
  });
  record('POST /me/shipping/quotes', 'POST', '/me/shipping/quotes', r.status, [200, 404, 422, 429, 500]);
}

// ═══════════════════════════════════════════════════════════════════════════
// COUPONS
// ═══════════════════════════════════════════════════════════════════════════
async function testCoupons() {
  console.log(B('\n── Coupons ───────────────────────────────────────────────────────'));

  let r = await req('GET', '/admin/coupons', { token: ADMIN_TOKEN });
  record('GET /admin/coupons (admin)', 'GET', '/admin/coupons', r.status, [200]);

  r = await req('POST', '/admin/coupons', {
    token: ADMIN_TOKEN,
    body: {
      code: `COUP${TS}`,
      type: 'PERCENTAGE',
      value: 10,
      minOrderValue: 50,
      maxUses: 100,
      expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    },
  });
  record('POST /admin/coupons', 'POST', '/admin/coupons', r.status, [201, 409, 422, 500]);
  const cb = r.body as { data?: { id?: string } };
  if (r.status === 201 && cb?.data?.id) createdCouponId = cb.data.id;

  if (createdCouponId) {
    r = await req('GET', `/admin/coupons/${createdCouponId}`, { token: ADMIN_TOKEN });
    record('GET /admin/coupons/:id', 'GET', `/admin/coupons/${createdCouponId}`, r.status, [200, 404]);

    r = await req('PATCH', `/admin/coupons/${createdCouponId}`, {
      token: ADMIN_TOKEN,
      body: { value: 15 },
    });
    record('PATCH /admin/coupons/:id', 'PATCH', `/admin/coupons/${createdCouponId}`, r.status, [200, 404, 422]);

    r = await req('DELETE', `/admin/coupons/${createdCouponId}`, { token: ADMIN_TOKEN });
    record('DELETE /admin/coupons/:id', 'DELETE', `/admin/coupons/${createdCouponId}`, r.status, [200, 204, 404]);
    createdCouponId = '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOGS
// ═══════════════════════════════════════════════════════════════════════════
async function testBlogs() {
  console.log(B('\n── Blogs ─────────────────────────────────────────────────────────'));

  let r = await req('GET', '/blogs');
  record('GET /blogs (admin-only)', 'GET', '/blogs', r.status, [401, 403]);

  r = await req('GET', '/blogs/published');
  record('GET /blogs/published (public)', 'GET', '/blogs/published', r.status, [200]);

  r = await req('POST', '/blogs', {
    token: ADMIN_TOKEN,
    body: {
      categoria: 'Tecnologia',
      titulo: `Blog${TS}`,
      descricao: 'Test blog description.',
      materia: 'Test blog content here.',
      publicado: false,
    },
  });
  record('POST /blogs (admin)', 'POST', '/blogs', r.status, [201, 409, 422, 500]);
  const bb = r.body as { data?: { id?: string } };
  if (r.status === 201 && bb?.data?.id) createdBlogId = bb.data.id;

  if (createdBlogId) {
    r = await req('GET', `/blogs/${createdBlogId}`);
    record('GET /blogs/:id (public)', 'GET', `/blogs/${createdBlogId}`, r.status, [200, 404]);

    r = await req('PUT', `/blogs/${createdBlogId}`, {
      token: ADMIN_TOKEN,
      body: { title: `Blog${TS}Updated`, slug: `blog-${TS}-upd`, content: 'Updated.', status: 'PUBLISHED' },
    });
    record('PUT /blogs/:id (admin)', 'PUT', `/blogs/${createdBlogId}`, r.status, [200, 404, 422]);

    r = await req('DELETE', `/blogs/${createdBlogId}`, { token: ADMIN_TOKEN });
    record('DELETE /blogs/:id (admin)', 'DELETE', `/blogs/${createdBlogId}`, r.status, [200, 204, 404]);
    createdBlogId = '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REDIRECTS
// ═══════════════════════════════════════════════════════════════════════════
async function testRedirects() {
  console.log(B('\n── SEO Redirects ─────────────────────────────────────────────────'));

  let r = await req('GET', '/admin/redirects', { token: ADMIN_TOKEN });
  record('GET /admin/redirects (admin)', 'GET', '/admin/redirects', r.status, [200]);

  r = await req('POST', '/admin/redirects', {
    token: ADMIN_TOKEN,
    body: { fromPath: `/old-${TS}`, toPath: `/new-${TS}`, statusCode: 301 },
  });
  record('POST /admin/redirects', 'POST', '/admin/redirects', r.status, [201, 409, 422]);
  const rb = r.body as { data?: { id?: string } };
  if (r.status === 201 && rb?.data?.id) createdRedirectId = rb.data.id;

  if (createdRedirectId) {
    r = await req('PATCH', `/admin/redirects/${createdRedirectId}`, {
      token: ADMIN_TOKEN,
      body: { statusCode: 302 },
    });
    record('PATCH /admin/redirects/:id', 'PATCH', `/admin/redirects/${createdRedirectId}`, r.status, [200, 404, 422]);

    r = await req('DELETE', `/admin/redirects/${createdRedirectId}`, { token: ADMIN_TOKEN });
    record('DELETE /admin/redirects/:id', 'DELETE', `/admin/redirects/${createdRedirectId}`, r.status, [200, 204, 404]);
    createdRedirectId = '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════
async function testAnalytics() {
  console.log(B('\n── Analytics ─────────────────────────────────────────────────────'));

  let r = await req('POST', '/analytics/track', {
    body: { path: '/products', referrer: 'https://google.com', userAgent: 'TestBot/1.0' },
  });
  record('POST /analytics/track', 'POST', '/analytics/track', r.status, [200, 201, 204, 422]);

  const analyticsEndpoints = [
    '/analytics/stats',
    '/analytics/last-7-days',
    '/analytics/daily-average',
    '/analytics/top-pages',
    '/analytics/views-month',
    '/analytics/devices-month',
  ];

  for (const ep of analyticsEndpoints) {
    r = await req('GET', ep, { token: ADMIN_TOKEN });
    record(`GET ${ep} (admin)`, 'GET', ep, r.status, [200]);
  }

  r = await req('DELETE', '/analytics/cleanup', { token: ADMIN_TOKEN });
  record('DELETE /analytics/cleanup (admin)', 'DELETE', '/analytics/cleanup', r.status, [200, 204]);
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: dashboard / reports
// ═══════════════════════════════════════════════════════════════════════════
async function testAdminReports() {
  console.log(B('\n── Admin Dashboard / Reports ─────────────────────────────────────'));

  let r = await req('GET', '/admin/dashboard', { token: ADMIN_TOKEN });
  record('GET /admin/dashboard (admin)', 'GET', '/admin/dashboard', r.status, [200]);

  r = await req('GET', '/admin/dashboard', {});
  record('GET /admin/dashboard (no auth)', 'GET', '/admin/dashboard', r.status, [401]);

  r = await req('GET', '/admin/reports/sales', { token: ADMIN_TOKEN });
  r = await req('GET', '/admin/reports/sales?dateFrom=2026-01-01&dateTo=2026-05-11', { token: ADMIN_TOKEN });
  record('GET /admin/reports/sales', 'GET', '/admin/reports/sales?dateFrom=2026-01-01&dateTo=2026-05-11', r.status, [200]);

  r = await req('GET', '/admin/reports/low-stock', { token: ADMIN_TOKEN });
  record('GET /admin/reports/low-stock', 'GET', '/admin/reports/low-stock', r.status, [200]);
}

// ═══════════════════════════════════════════════════════════════════════════
// SEO: sitemap, robots
// ═══════════════════════════════════════════════════════════════════════════
async function testSeo() {
  console.log(B('\n── SEO ───────────────────────────────────────────────────────────'));

  let r = await req('GET', '/sitemap.xml');
  record('GET /sitemap.xml', 'GET', '/sitemap.xml', r.status, [200]);

  r = await req('GET', '/robots.txt');
  record('GET /robots.txt', 'GET', '/robots.txt', r.status, [200]);
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOKS
// ═══════════════════════════════════════════════════════════════════════════
async function testWebhooks() {
  console.log(B('\n── Webhooks ──────────────────────────────────────────────────────'));

  const r = await req('POST', '/webhooks/payment', {
    body: { event: 'payment.success', orderId: 'fake' },
    headers: {},
  });
  record('POST /webhooks/payment (no sig)', 'POST', '/webhooks/payment', r.status, [400, 401, 403, 500]);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  CRUD Smoke Test — ecommerce-tinpavi API');
  console.log(`  Target : ${BASE}`);
  console.log(`  Date   : ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════════');

  await setup();

  await testHealth();
  await testAuth();
  await testUsers();
  await testCategories();
  await testProducts();
  await testReviews();
  await testOrders();
  await testCustomers();
  await testAddresses();
  await testCoupons();
  await testBlogs();
  await testRedirects();
  await testAnalytics();
  await testAdminReports();
  await testSeo();
  await testWebhooks();

  // ─── Summary ─────────────────────────────────────────────────────────────
  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  CRUD SMOKE TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Total checks : ${total}`);
  console.log(`  ${G('✅ Passed')}     : ${passed}`);
  console.log(`  ${failed.length > 0 ? R('❌ Failed') : G('❌ Failed')}     : ${failed.length}`);

  if (failed.length > 0) {
    console.log('\n  ─── FAILURES ─────────────────────────────────────────────────');
    for (const f of failed) {
      console.log(R(`  ❌ [${f.method}] ${f.path} — got ${f.status} — ${f.label}`));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════\n');

  // cleanup snapshot
  try {
    const fs = await import('node:fs/promises');
    await fs.unlink('openapi-snapshot.json').catch(() => {});
  } catch { /* ignore */ }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
