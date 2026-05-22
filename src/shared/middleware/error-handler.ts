import type { NextFunction, Request, Response } from "express";

import { fail } from "../http/response-envelope";

type HttpError = Error & {
  statusCode?: number;
  code?: string;
  details?: unknown;
};

export function errorHandlerMiddleware(
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? "INTERNAL_ERROR";
  const message = statusCode >= 500 ? "Internal server error" : err.message;
  const requestId = req.requestId ?? null;

  if (statusCode >= 500) {
    console.error('[Error]', {
      requestId,
      code,
      statusCode,
      message: err.message,
    });
  }

  res.status(statusCode).json(fail(code, message, err.details, { requestId }));
}
