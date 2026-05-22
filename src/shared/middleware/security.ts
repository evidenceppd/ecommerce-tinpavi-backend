import helmet from 'helmet';
import cors from 'cors';
import type { RequestHandler } from 'express';

export const securityMiddleware: RequestHandler = helmet();

const corsOrigin = process.env['CORS_ORIGIN'];
const isProduction = process.env['NODE_ENV'] === 'production';
const defaultCorsOrigins = ['http://localhost:5173', 'http://192.168.100.39:5173'];

if (isProduction && (!corsOrigin || corsOrigin.trim().length === 0)) {
  throw new Error('Missing required env var: CORS_ORIGIN in production');
}

export const corsMiddleware: RequestHandler = cors({
  origin: corsOrigin && corsOrigin.trim().length > 0
    ? corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean)
    : defaultCorsOrigins,
});

export const httpsRedirectMiddleware: RequestHandler = (req, res, next) => {
  if (process.env['NODE_ENV'] === 'production') {
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (!isSecure) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
  }
  next();
};
