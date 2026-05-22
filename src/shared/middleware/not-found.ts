import type { Request, Response, NextFunction } from "express";

import { fail } from "../http/response-envelope";

export function notFoundMiddleware(_req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json(fail("NOT_FOUND", "Route not found"));
}
