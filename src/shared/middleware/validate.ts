import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { fail } from '@/shared/http/response-envelope';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json(fail('VALIDATION_ERROR', 'Invalid input', result.error.flatten()));
      return;
    }
    req.body = result.data as typeof req.body;
    next();
  };
}
