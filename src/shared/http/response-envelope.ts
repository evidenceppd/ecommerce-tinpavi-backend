export type ApiMeta = Record<string, unknown>;

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: ApiMeta;
  error: null;
};

export type ApiFailure = {
  success: false;
  data: null;
  meta?: ApiMeta;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function ok<T>(data: T, meta?: ApiMeta): ApiSuccess<T> {
  return {
    success: true,
    data,
    meta,
    error: null,
  };
}

export function fail(
  code: string,
  message: string,
  details?: unknown,
  meta?: ApiMeta,
): ApiFailure {
  return {
    success: false,
    data: null,
    meta,
    error: {
      code,
      message,
      details,
    },
  };
}
