import { resolveSwaggerUiAssetsPath } from './swagger-ui-assets';

type OpenApiDocument = {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: string; description: string }>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
  paths: Record<string, unknown>;
};

const port = process.env['PORT'] ?? '3000';
const appBaseUrl = process.env['APP_BASE_URL']?.trim();
const serverUrl = appBaseUrl && appBaseUrl.length > 0 ? appBaseUrl : `http://localhost:${port}`;

export const swaggerUiAssetsPath = resolveSwaggerUiAssetsPath();

export const swaggerInitScript = `window.ui = SwaggerUIBundle({
  url: '/docs/openapi.json',
  dom_id: '#swagger-ui',
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
  layout: 'StandaloneLayout'
});`;

export const openApiDocument: OpenApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Ecommerce TINPAVI API',
    version: '1.0.0',
    description: 'Official API documentation for backend endpoints.',
  },
  servers: [
    {
      url: serverUrl,
      description: process.env['NODE_ENV'] === 'production' ? 'Production' : 'Local',
    },
  ],
  tags: [
    { name: 'Health', description: 'Service availability and readiness.' },
    { name: 'Auth', description: 'Authentication and token lifecycle.' },
    { name: 'Users', description: 'Administrative user management.' },
    { name: 'Customers', description: 'Customer profile and admin customer operations.' },
    { name: 'Catalog', description: 'Products and categories.' },
    { name: 'Orders', description: 'Orders and coupon administration.' },
    { name: 'Reviews', description: 'Product reviews.' },
    { name: 'SEO', description: 'SEO and redirects endpoints.' },
    { name: 'Payments', description: 'Payment init and webhook processing.' },
    { name: 'Shipping', description: 'Shipping quote operations.' },
    { name: 'Admin', description: 'Administrative operations.' },
    { name: 'Analytics', description: 'Analytics endpoints.' },
    { name: 'Blogs', description: 'Blog endpoints.' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          data: { nullable: true, example: null },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid input' },
            },
          },
        },
      },
      OkEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object', additionalProperties: true },
          error: { nullable: true, example: null },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          '200': { description: 'Service is healthy' },
        },
      },
    },
    '/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness check',
        responses: {
          '200': { description: 'Dependencies are ready' },
          '503': { description: 'Dependencies are unavailable' },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register customer account',
        responses: { '201': { description: 'Customer created' }, '400': { description: 'Validation error' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate and receive tokens',
        responses: { '200': { description: 'Authenticated' }, '401': { description: 'Invalid credentials' } },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        responses: { '200': { description: 'New access token' }, '401': { description: 'Invalid refresh token' } },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Invalidate refresh token',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Logged out' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get authenticated admin user profile',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'User profile' }, '401': { description: 'Unauthorized' } },
      },
      put: {
        tags: ['Users'],
        summary: 'Update authenticated admin user profile',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'User updated' }, '400': { description: 'Validation error' } },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List users',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Users list' }, '401': { description: 'Unauthorized' } },
      },
      post: {
        tags: ['Users'],
        summary: 'Create user',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'User created' }, '400': { description: 'Validation error' } },
      },
    },
    '/users/{id}': {
      patch: {
        tags: ['Users'],
        summary: 'Update user',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'User updated' }, '400': { description: 'Validation error' } },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete user',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': { description: 'User deleted' }, '403': { description: 'Forbidden' } },
      },
    },
    '/me/profile': {
      get: {
        tags: ['Customers'],
        summary: 'Get current customer profile',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Customer profile' }, '401': { description: 'Unauthorized' } },
      },
      put: {
        tags: ['Customers'],
        summary: 'Update current customer profile',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Profile updated' }, '400': { description: 'Validation error' } },
      },
    },
    '/me/addresses': {
      get: {
        tags: ['Customers'],
        summary: 'List current customer addresses',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Addresses list' }, '401': { description: 'Unauthorized' } },
      },
      post: {
        tags: ['Customers'],
        summary: 'Create customer address',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Address created' }, '400': { description: 'Validation error' } },
      },
    },
    '/me/addresses/{addressId}': {
      delete: {
        tags: ['Customers'],
        summary: 'Delete customer address',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'addressId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': { description: 'Address deleted' }, '404': { description: 'Address not found' } },
      },
    },
    '/me/orders': {
      get: {
        tags: ['Customers'],
        summary: 'List order history for current customer',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Order history' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/me/cart': {
      get: {
        tags: ['Orders'],
        summary: 'Get current customer cart',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Cart details' }, '401': { description: 'Unauthorized' } },
      },
      delete: {
        tags: ['Orders'],
        summary: 'Clear current customer cart',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Cart cleared' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/me/cart/items': {
      post: {
        tags: ['Orders'],
        summary: 'Add item to current customer cart',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Item added to cart' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/me/cart/items/{productId}': {
      patch: {
        tags: ['Orders'],
        summary: 'Update cart item quantity',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Cart item updated' }, '401': { description: 'Unauthorized' } },
      },
      delete: {
        tags: ['Orders'],
        summary: 'Remove item from cart',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': { description: 'Cart item removed' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/admin/customers': {
      get: {
        tags: ['Customers'],
        summary: 'Admin list customers',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Customers list' }, '401': { description: 'Unauthorized' } },
      },
      post: {
        tags: ['Customers'],
        summary: 'Admin create customer',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Customer created' }, '409': { description: 'Email conflict' } },
      },
    },
    '/admin/customers/{id}': {
      get: {
        tags: ['Customers'],
        summary: 'Admin get customer details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Customer details' }, '404': { description: 'Customer not found' } },
      },
      patch: {
        tags: ['Customers'],
        summary: 'Admin update customer',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Customer updated' }, '400': { description: 'Validation error' } },
      },
      delete: {
        tags: ['Customers'],
        summary: 'Admin delete customer',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': { description: 'Customer deleted' }, '404': { description: 'Customer not found' } },
      },
    },
    '/products': {
      get: {
        tags: ['Catalog'],
        summary: 'List products',
        responses: { '200': { description: 'Products list' } },
      },
    },
    '/products/{code}': {
      get: {
        tags: ['Catalog'],
        summary: 'Get public product by code',
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Product details' }, '404': { description: 'Product not found' } },
      },
    },
    '/admin/products': {
      get: {
        tags: ['Catalog'],
        summary: 'Admin list products',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Products list' }, '401': { description: 'Unauthorized' } },
      },
      post: {
        tags: ['Catalog'],
        summary: 'Admin create product',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Product created' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/admin/products/{id}': {
      get: {
        tags: ['Catalog'],
        summary: 'Admin get product by id',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Product details' }, '404': { description: 'Product not found' } },
      },
      put: {
        tags: ['Catalog'],
        summary: 'Admin update product',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Product updated' }, '400': { description: 'Validation error' } },
      },
      delete: {
        tags: ['Catalog'],
        summary: 'Admin delete product',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': { description: 'Product deleted' } },
      },
    },
    '/admin/products/{id}/variants': {
      get: {
        tags: ['Catalog'],
        summary: 'Admin list product variants',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Product variants list' }, '404': { description: 'Product not found' } },
      },
      post: {
        tags: ['Catalog'],
        summary: 'Admin create product variant',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '201': { description: 'Variant created' },
          '404': { description: 'Product not found' },
          '409': { description: 'Variant SKU conflict' },
          '422': { description: 'Validation error' },
        },
      },
    },
    '/admin/products/{id}/variants/{variantId}': {
      put: {
        tags: ['Catalog'],
        summary: 'Admin update product variant',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'variantId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Variant updated' },
          '404': { description: 'Variant not found' },
          '409': { description: 'Variant SKU conflict' },
          '422': { description: 'Validation error' },
        },
      },
      delete: {
        tags: ['Catalog'],
        summary: 'Admin delete product variant',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'variantId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '204': { description: 'Variant deleted' }, '404': { description: 'Variant not found' } },
      },
    },
    '/categories': {
      get: {
        tags: ['Catalog'],
        summary: 'List categories',
        responses: { '200': { description: 'Categories list' } },
      },
    },
    '/categories/{id}': {
      get: {
        tags: ['Catalog'],
        summary: 'Get category by id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Category details' }, '404': { description: 'Category not found' } },
      },
    },
    '/admin/categories': {
      get: {
        tags: ['Catalog'],
        summary: 'Admin list categories',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Categories list' }, '401': { description: 'Unauthorized' } },
      },
      post: {
        tags: ['Catalog'],
        summary: 'Admin create category',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Category created' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/admin/categories/{id}': {
      put: {
        tags: ['Catalog'],
        summary: 'Admin update category',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Category updated' }, '400': { description: 'Validation error' } },
      },
      delete: {
        tags: ['Catalog'],
        summary: 'Admin delete category',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': { description: 'Category deleted' } },
      },
    },
    '/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Checkout and create order',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Order created' }, '422': { description: 'Business validation error' } },
      },
      get: {
        tags: ['Orders'],
        summary: 'List customer orders',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Orders list' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get customer order by id',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Order details' }, '404': { description: 'Order not found' } },
      },
    },
    '/orders/{id}/cancel': {
      delete: {
        tags: ['Orders'],
        summary: 'Cancel customer order',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Order cancelled' }, '422': { description: 'Cancellation not allowed' } },
      },
    },
    '/admin/orders': {
      get: {
        tags: ['Orders'],
        summary: 'Admin list all orders',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Orders list' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/admin/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Admin get order by id',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Order details' }, '404': { description: 'Order not found' } },
      },
    },
    '/admin/orders/{id}/status': {
      patch: {
        tags: ['Orders'],
        summary: 'Admin update order status',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Order updated' }, '400': { description: 'Validation error' } },
      },
    },
    '/admin/coupons': {
      post: {
        tags: ['Orders'],
        summary: 'Admin create coupon',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Coupon created' }, '409': { description: 'Code conflict' } },
      },
      get: {
        tags: ['Orders'],
        summary: 'Admin list coupons',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Coupons list' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/admin/coupons/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Admin get coupon by id',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Coupon details' }, '404': { description: 'Coupon not found' } },
      },
      patch: {
        tags: ['Orders'],
        summary: 'Admin update coupon',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Coupon updated' }, '400': { description: 'Validation error' } },
      },
      delete: {
        tags: ['Orders'],
        summary: 'Admin delete coupon',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': { description: 'Coupon deleted' } },
      },
    },
    '/products/{productId}/reviews': {
      post: {
        tags: ['Reviews'],
        summary: 'Create product review',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '201': { description: 'Review created' }, '409': { description: 'Review already exists' } },
      },
    },
    '/products/{productId}/reviews/mine': {
      patch: {
        tags: ['Reviews'],
        summary: 'Update current customer review for product',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Review updated' }, '404': { description: 'Review not found' } },
      },
      delete: {
        tags: ['Reviews'],
        summary: 'Delete current customer review for product',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '204': { description: 'Review deleted' }, '404': { description: 'Review not found' } },
      },
    },
    '/products/{productId}/reviews/eligibility': {
      get: {
        tags: ['Reviews'],
        summary: 'Check current customer review eligibility for product',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Eligibility status' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/admin/reviews': {
      get: {
        tags: ['Reviews'],
        summary: 'Admin list reviews',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Reviews list' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/admin/reviews/{id}': {
      patch: {
        tags: ['Reviews'],
        summary: 'Admin moderate review',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Review moderated' }, '404': { description: 'Review not found' } },
      },
    },
    '/admin/dashboard': {
      get: {
        tags: ['Admin'],
        summary: 'Get admin dashboard overview',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Dashboard overview' }, '400': { description: 'Invalid query' } },
      },
    },
    '/admin/reports/sales': {
      get: {
        tags: ['Admin'],
        summary: 'Get admin sales report',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Sales report' }, '400': { description: 'Invalid query' } },
      },
    },
    '/admin/reports/low-stock': {
      get: {
        tags: ['Admin'],
        summary: 'Get low stock report',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Low stock report' }, '400': { description: 'Invalid query' } },
      },
    },
    '/admin/redirects': {
      get: {
        tags: ['SEO'],
        summary: 'Admin list redirects',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Redirect list' }, '401': { description: 'Unauthorized' } },
      },
      post: {
        tags: ['SEO'],
        summary: 'Admin create redirect',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Redirect created' }, '400': { description: 'Validation error' } },
      },
    },
    '/admin/redirects/{id}': {
      patch: {
        tags: ['SEO'],
        summary: 'Admin update redirect',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Redirect updated' }, '404': { description: 'Redirect not found' } },
      },
      delete: {
        tags: ['SEO'],
        summary: 'Admin delete redirect',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': { description: 'Redirect deleted' }, '404': { description: 'Redirect not found' } },
      },
    },
    '/me/orders/{id}/pay': {
      post: {
        tags: ['Payments'],
        summary: 'Initiate payment for customer order',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Payment initiated' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/webhooks/payment': {
      post: {
        tags: ['Payments'],
        summary: 'Gateway webhook callback',
        parameters: [
          {
            name: 'x-webhook-signature',
            in: 'header',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Webhook processed' },
          '401': { description: 'Invalid signature' },
        },
      },
    },
    '/me/shipping/quotes': {
      post: {
        tags: ['Shipping'],
        summary: 'Calculate shipping quote',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Shipping quote' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/sitemap.xml': {
      get: {
        tags: ['SEO'],
        summary: 'Get XML sitemap',
        responses: { '200': { description: 'Sitemap XML' } },
      },
    },
    '/robots.txt': {
      get: {
        tags: ['SEO'],
        summary: 'Get robots.txt',
        responses: { '200': { description: 'Robots TXT' } },
      },
    },
    '/products/{slug}/schema': {
      get: {
        tags: ['SEO'],
        summary: 'Get product JSON-LD schema',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Product schema' }, '404': { description: 'Product not found' } },
      },
    },
    '/categories/{slug}/schema': {
      get: {
        tags: ['SEO'],
        summary: 'Get category JSON-LD schema',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Category schema' }, '404': { description: 'Category not found' } },
      },
    },
    '/analytics/track': {
      post: {
        tags: ['Analytics'],
        summary: 'Track page view analytics event',
        responses: { '201': { description: 'Tracked' } },
      },
    },
    '/analytics/stats': {
      get: {
        tags: ['Analytics'],
        summary: 'Get analytics overview',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Analytics stats' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/analytics/views-month': {
      get: {
        tags: ['Analytics'],
        summary: 'Get monthly views timeline',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Monthly views' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/analytics/devices-month': {
      get: {
        tags: ['Analytics'],
        summary: 'Get monthly device distribution',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Devices by month' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/analytics/daily-average': {
      get: {
        tags: ['Analytics'],
        summary: 'Get daily average page views',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Daily average' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/analytics/last-7-days': {
      get: {
        tags: ['Analytics'],
        summary: 'Get last 7 days analytics',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Last 7 days metrics' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/analytics/top-pages': {
      get: {
        tags: ['Analytics'],
        summary: 'Get top pages analytics',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Top pages' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/analytics/cleanup': {
      delete: {
        tags: ['Analytics'],
        summary: 'Cleanup old analytics records',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Cleanup result' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/blogs': {
      get: {
        tags: ['Blogs'],
        summary: 'List blogs (admin)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Blogs list' }, '401': { description: 'Unauthorized' } },
      },
      post: {
        tags: ['Blogs'],
        summary: 'Create blog (admin)',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Blog created' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/blogs/published': {
      get: {
        tags: ['Blogs'],
        summary: 'List published blogs (public)',
        responses: { '200': { description: 'Published blogs' } },
      },
    },
    '/blogs/{id}': {
      get: {
        tags: ['Blogs'],
        summary: 'Get blog by id (public)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Blog details' }, '404': { description: 'Blog not found' } },
      },
      put: {
        tags: ['Blogs'],
        summary: 'Update blog (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Blog updated' }, '401': { description: 'Unauthorized' } },
      },
      delete: {
        tags: ['Blogs'],
        summary: 'Delete blog (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '204': { description: 'Blog deleted' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/contato': {
      get: {
        tags: ['Admin'],
        summary: 'Get public contact settings',
        responses: { '200': { description: 'Contact settings' } },
      },
      put: {
        tags: ['Admin'],
        summary: 'Update contact settings',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Contact settings updated' }, '401': { description: 'Unauthorized' } },
      },
    },
  },
};

export const swaggerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ecommerce TINPAVI API Docs</title>
    <link rel="stylesheet" href="/docs/assets/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/docs/assets/swagger-ui-bundle.js" defer></script>
    <script src="/docs/assets/swagger-ui-standalone-preset.js" defer></script>
    <script src="/docs/swagger-init.js" defer></script>
  </body>
</html>`;
