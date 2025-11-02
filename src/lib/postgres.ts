// Shared Postgres / Supabase related constants and lightweight helpers
// Centralizes common Postgres error codes to avoid duplication.
// Extend this file cautiously; keep it minimal and focused on cross-service reuse.

// Postgres error code constants (https://www.postgresql.org/docs/current/errcodes-appendix.html)
export const PG_UNIQUE_VIOLATION = "23505"; // unique_violation
export const PG_FOREIGN_KEY_VIOLATION = "23503"; // foreign_key_violation (reserved for future use)

// Narrow shape for Supabase Postgrest error objects we care about when mapping codes.
export interface PostgrestErrorLike {
  message: string;
  code?: string; // Postgres error code (e.g., 23505)
}

/** Convenience predicate for matching a Postgrest error by code */
export function isPostgresErrorCode(error: unknown, code: string): boolean {
  return !!error && typeof error === "object" && (error as PostgrestErrorLike).code === code;
}
