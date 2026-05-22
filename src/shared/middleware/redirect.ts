import type { Request, Response, NextFunction } from 'express';
import { RedirectsService } from '@/modules/seo/redirects.service';

const service = new RedirectsService();

export async function redirectMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Only intercept GET requests (D-06: global middleware)
  if (req.method !== 'GET') { next(); return; }

  try {
    const map = await service.getActiveRedirectMap();
    const destination = map.get(req.path);
    if (destination) {
      res.redirect(301, destination);
      return;
    }
  } catch {
    // Best-effort — never block a request on redirect lookup failure
  }

  next();
}
