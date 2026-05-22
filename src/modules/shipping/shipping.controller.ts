import type { Request, Response } from 'express';

import { fail, ok } from '@/shared/http/response-envelope';

import { ShippingService } from './shipping.service';
import { shippingQuoteSchema } from './shipping.schemas';

const service = new ShippingService();

function mapError(error: unknown): { statusCode: number; code: string; message: string } {
  const statusCode = (error as { statusCode?: number }).statusCode;
  const code = (error as { code?: string }).code;

  if (statusCode && code) {
    return {
      statusCode,
      code,
      message: (error as Error).message,
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  };
}

export async function quoteShippingController(req: Request, res: Response): Promise<void> {
  const parsed = shippingQuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(fail('VALIDATION_ERROR', 'Invalid input', parsed.error.flatten()));
    return;
  }

  try {
    const customerId = req.user!.id;
    const result = await service.quoteForCustomer(parsed.data, customerId);
    res.status(200).json(ok(result));
  } catch (error) {
    const mapped = mapError(error);
    res.status(mapped.statusCode).json(fail(mapped.code, mapped.message));
  }
}
