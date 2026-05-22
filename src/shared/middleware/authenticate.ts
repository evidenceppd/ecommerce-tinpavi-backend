import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { fail } from '@/shared/http/response-envelope';

interface JwtAccessPayload {
  sub: string;
  role: string;
  t?: 'CUSTOMER' | 'USER';
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.id) {
    next();
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json(fail('UNAUTHORIZED', 'Missing or invalid Authorization header'));
    return;
  }
  const token = authHeader.slice(7);
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    res.status(500).json(fail('SERVER_ERROR', 'JWT secret not configured'));
    return;
  }
  try {
    const payload = jwt.verify(token, secret) as JwtAccessPayload;
    // Reject tokens that are structurally valid but missing required identity claims
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.trim() === '') {
      res.status(401).json(fail('UNAUTHORIZED', 'Invalid or expired token'));
      return;
    }
    if (!payload.role || typeof payload.role !== 'string') {
      res.status(401).json(fail('UNAUTHORIZED', 'Invalid or expired token'));
      return;
    }
    req.user = { id: payload.sub, role: payload.role, subjectType: payload.t ?? 'CUSTOMER' };
    next();
  } catch {
    res.status(401).json(fail('UNAUTHORIZED', 'Invalid or expired token'));
  }
}
