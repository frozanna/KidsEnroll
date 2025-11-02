// Shared pagination helpers
// Responsibilities:
//  - Provide consistent calculation of Supabase range indices from page/limit
//  - Provide construction of PaginationDTO objects
//  - Validate inputs early and throw domain-friendly errors
//
// Conventions:
//  - page is 1-based; limit > 0
//  - Negative or zero page/limit triggers VALIDATION_ERROR (service layer may already validate,
//    but helpers defensively re-check to avoid silent misuse.)
//
// Edge Cases:
//  - page less than 1 -> throws
//  - limit less than 1 -> throws
//  - total may be 0
//
// NOTE: Keep helpers small & domain-agnostic.

import type { PaginationDTO } from "../types";
import { createError } from "./services/errors";

export interface RangeIndices {
  offset: number; // start index (inclusive) for Supabase .range()
  end: number; // end index (inclusive) for Supabase .range()
}

/**
 * Compute 0-based offset and inclusive end index for Supabase range() calls.
 * end = offset + limit - 1.
 */
export function buildRange(page: number, limit: number): RangeIndices {
  if (!Number.isFinite(page) || !Number.isFinite(limit)) {
    throw createError("VALIDATION_ERROR", "Invalid pagination parameters (non-finite)");
  }
  if (page < 1) {
    throw createError("VALIDATION_ERROR", "Page must be >= 1");
  }
  if (limit < 1) {
    throw createError("VALIDATION_ERROR", "Limit must be >= 1");
  }
  const offset = (page - 1) * limit;
  const end = offset + limit - 1;
  return { offset, end };
}

/**
 * Build a PaginationDTO object. Assumes total already known (may be 0).
 */
export function buildPagination(page: number, limit: number, total: number): PaginationDTO {
  if (!Number.isFinite(total) || total < 0) {
    throw createError("VALIDATION_ERROR", "Total must be a non-negative finite number");
  }
  // page/limit validation reused from buildRange for consistency
  buildRange(page, limit);
  return { page, limit, total };
}
