import type { RequestHandler } from 'express';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF mitigation for a stateless JWT Bearer API.
 *
 * Traditional CSRF attacks rely on the browser auto-sending cookies.
 * This API uses Bearer tokens in the Authorization header (not cookies),
 * so it is inherently immune to cookie-hijack CSRF.
 *
 * As a defence-in-depth measure we still validate the Origin / Referer
 * header on every state-changing request in production so that a
 * rogue cross-origin page cannot accidentally submit requests that a
 * misconfigured CORS policy might accept.
 *
 * Exemptions:
 *  - GET / HEAD / OPTIONS — safe methods, never mutate state.
 *  - /webhooks/* — verified by HMAC signature in the controller.
 *  - Requests without an Origin header from trusted server-to-server
 *    clients (non-browser agents don't send Origin).
 */
export const csrfGuard: RequestHandler = (req, res, next) => {
  // Only enforce in production (dev uses localhost origins freely)
  if (process.env['NODE_ENV'] !== 'production') return next();

  if (!STATE_CHANGING_METHODS.has(req.method)) return next();

  // Webhook route has its own HMAC verification — skip
  if (req.path.startsWith('/webhooks/')) return next();

  const origin = req.headers['origin'];
  const referer = req.headers['referer'];

  // Non-browser agents (server-to-server) don't send Origin; allow them through
  if (!origin && !referer) return next();

  const allowedOrigin = (process.env['CORS_ORIGIN'] ?? '').replace(/\/$/, '');

  // Wildcard CORS_ORIGIN means no origin restriction is configured — allow
  if (allowedOrigin === '*' || allowedOrigin === '') return next();

  const source = origin ?? (referer ? new URL(referer).origin : '');

  if (source !== allowedOrigin) {
    res.status(403).json({
      success: false,
      data: null,
      error: { code: 'CSRF_ORIGIN_MISMATCH', message: 'Cross-origin request blocked' },
    });
    return;
  }

  next();
};
