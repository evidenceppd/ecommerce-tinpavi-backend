import 'express';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      endpointTag?: string;
      dbQueryCount?: number;
      abortSignal?: AbortSignal;
      requestTimedOut?: boolean;
      rawBody?: Buffer;
      user?: {
        id: string;
        role: string;
        subjectType?: 'CUSTOMER' | 'USER';
      };
    }
  }
}
