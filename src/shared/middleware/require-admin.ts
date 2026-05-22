import type { NextFunction, Request, Response } from 'express';
import { fail } from '@/shared/http/response-envelope';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MASTER' && req.user?.role !== 'EDITOR') {
    res.status(403).json(fail('FORBIDDEN', 'Admin access required'));
    return;
  }
  next();
}
