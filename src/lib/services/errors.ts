// Centralized API error handling utilities for service & endpoint layers.
// Provides a typed error class (ApiError) and factory helpers for consistent responses.

import type { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "CHILD_NOT_FOUND"
  | "ACTIVITY_NOT_FOUND"
  | "WORKER_NOT_FOUND"
  | "WORKER_EMAIL_CONFLICT"
  | "WORKER_HAS_ACTIVITIES"
  | "CHILD_NOT_OWNED"
  | "ACTIVITY_STARTED"
  | "ACTIVITY_FULL"
  | "ENROLLMENT_DUPLICATE"
  | "ENROLLMENT_NOT_FOUND"
  | "WITHDRAWAL_TOO_LATE"
  | "AUTH_UNAUTHORIZED"
  | "INTERNAL_ERROR";

// Mapping of error codes to default HTTP status values.
const STATUS_MAP: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  CHILD_NOT_FOUND: 404,
  ACTIVITY_NOT_FOUND: 404,
  WORKER_NOT_FOUND: 404,
  WORKER_EMAIL_CONFLICT: 409,
  WORKER_HAS_ACTIVITIES: 400,
  CHILD_NOT_OWNED: 403,
  ACTIVITY_STARTED: 400,
  ACTIVITY_FULL: 400,
  ENROLLMENT_DUPLICATE: 400,
  ENROLLMENT_NOT_FOUND: 404,
  WITHDRAWAL_TOO_LATE: 400,
  AUTH_UNAUTHORIZED: 401,
  INTERNAL_ERROR: 500,
};

export interface ApiErrorOptions {
  details?: Record<string, unknown>;
  status?: number; // Optional override
}

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, status?: number, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status ?? STATUS_MAP[code];
    this.details = details;
  }
}

/** Factory creating an ApiError with optional status override. */
export function createError(code: ErrorCode, message: string, opts: ApiErrorOptions = {}): ApiError {
  return new ApiError(code, message, opts.status, opts.details);
}

/** Convert ZodError into uniform VALIDATION_ERROR ApiError */
export function fromZodError(err: ZodError): ApiError {
  return createError("VALIDATION_ERROR", "Invalid request body", {
    details: { issues: err.issues },
  });
}

/** Safely wrap unknown errors; preserve ApiError or convert. */
export function normalizeUnknownError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) return createError("INTERNAL_ERROR", err.message);
  return createError("INTERNAL_ERROR", "Unknown error");
}
