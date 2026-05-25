import helmet from 'helmet';
import type { RequestHandler } from 'express';

export const securityMiddleware: RequestHandler = helmet();

export const httpsRedirectMiddleware: RequestHandler = (req, res, next) => {
  if (process.env['NODE_ENV'] === 'production') {
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (!isSecure) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
  }
  next();
};
