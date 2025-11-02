// Zod schema & helpers for Admin Parents endpoints (list & detail)
// Responsibilities:
//  - Validate & normalize pagination and optional search query for GET /api/admin/parents
//  - Enforce bounds: page>=1, limit 1..100
//  - Optional search trimmed; ignore if empty after trim
//  - Validate parent id path param as UUID for GET /api/admin/parents/:id
//  - Produce typed objects consumed by service layer
//
// Edge Cases:
//  - page or limit non-integer -> validation error
//  - limit > 100 -> validation error
//  - search empty or whitespace-only -> treated as undefined (no filter)
//  - invalid UUID path param -> validation error
//
// Notes:
//  - Email search omitted (schema still accepts search but service applies only to first_name/last_name per implementation plan assumption)
//  - Future extension: enhance search to multi-field or advanced filtering

import { z } from "zod";

export interface ListParentsQuery {
  page: number;
  limit: number;
  search?: string; // normalized trimmed non-empty string
}

// Raw query schema capturing string inputs
const rawListQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

/**
 * Validate URLSearchParams for /api/admin/parents listing.
 * Throws ZodError on failure.
 */
export function validateListParentsQuery(params: URLSearchParams): ListParentsQuery {
  const rawObj: Record<string, string> = {};
  for (const [k, v] of params.entries()) rawObj[k] = v;
  const raw = rawListQuerySchema.parse(rawObj);

  const page = raw.page ? Number(raw.page) : 1;
  const limit = raw.limit ? Number(raw.limit) : 20;

  const issues: z.ZodIssue[] = [];
  if (!Number.isInteger(page) || page < 1) {
    issues.push({ code: z.ZodIssueCode.custom, path: ["page"], message: "page must be an integer >= 1" });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    issues.push({
      code: z.ZodIssueCode.custom,
      path: ["limit"],
      message: "limit must be an integer between 1 and 100",
    });
  }
  let search: string | undefined;
  if (raw.search !== undefined) {
    const trimmed = raw.search.trim();
    if (trimmed.length > 0) {
      if (trimmed.length > 100) {
        issues.push({ code: z.ZodIssueCode.custom, path: ["search"], message: "search max length is 100" });
      } else {
        search = trimmed;
      }
    }
  }

  if (issues.length > 0) throw new z.ZodError(issues);

  return { page, limit, ...(search ? { search } : {}) } satisfies ListParentsQuery;
}

// UUID validation (v4/v1 etc generic) using built-in zod uuid
export function validateParentIdParam(idRaw: string): string {
  return z.string().uuid().parse(idRaw);
}
