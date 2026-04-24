export interface HttpErrorOptions {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(options: HttpErrorOptions) {
    super(options.message);
    this.name = "HttpError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;

    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}
