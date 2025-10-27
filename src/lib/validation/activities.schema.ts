// Zod schema & parsing helper for Activities listing endpoint (GET /api/activities)
// Implements step 1 of the implementation plan in /.ai/endpoints/acivities-implementation-plan.md
// Responsibilities (transport-level validation only):
//  - Parse URLSearchParams into a normalized filter object
//  - Validate numeric pagination (page, limit) with defaults (1, 20) and max limit (100)
//  - Validate optional date range (startDate <= endDate) in YYYY-MM-DD format
//  - Validate boolean flag hasAvailableSpots (accepts true/false case-insensitive)
//  - Normalize and validate tags list (comma-separated; intersection semantics applied downstream)
//  - Produce a strongly typed ActivitiesQueryFilters object consumed by the service layer
//
// Notes:
//  - Tag allowed characters: alphanumeric plus - _ / (defense-in-depth)
//  - Empty tag segments (",,") are ignored
//  - Dates are validated for proper calendar composition using JS Date (UTC midnight normalization)
//  - Date logical validation (start <= end) handled after individual parsing
//  - All validation errors throw ZodError -> mapped to ApiError(VALIDATION_ERROR) upstream

import { z } from "zod";

// ---- Local Types ----
export interface ActivitiesQueryFilters {
  hasAvailableSpots?: boolean;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  tags?: string[]; // normalized (unique, trimmed, non-empty)
  page: number; // >=1
  limit: number; // 1..100
}

// ---- Helpers ----
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TAG_REGEX = /^[A-Za-z0-9\-_/]{1,50}$/; // length check combined

function isValidIsoDateOnly(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime());
}

// Raw query schema (strings); transformation + refinement occurs post-parsing.
const rawQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  hasAvailableSpots: z.string().optional(),
  tags: z.string().optional(), // comma-separated
});

/**
 * Validates and normalizes URLSearchParams for /api/activities.
 * @throws ZodError on validation failure (mapped upstream to VALIDATION_ERROR)
 */
export function validateActivitiesQuery(params: URLSearchParams): ActivitiesQueryFilters {
  // Extract raw key-value strings (stable copy) for schema parsing
  const rawObj: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    rawObj[k] = v;
  }

  const raw = rawQuerySchema.parse(rawObj);

  // ---- Pagination ----
  const page = raw.page ? Number(raw.page) : 1;
  const limit = raw.limit ? Number(raw.limit) : 20;

  if (!Number.isInteger(page) || page < 1) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["page"],
        message: "page must be an integer >= 1",
      },
    ]);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["limit"],
        message: "limit must be an integer between 1 and 100",
      },
    ]);
  }

  // ---- Dates ----
  let startDate: string | undefined;
  let endDate: string | undefined;
  if (raw.startDate) {
    if (!isValidIsoDateOnly(raw.startDate)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["startDate"],
          message: "startDate must be a valid YYYY-MM-DD date",
        },
      ]);
    }
    startDate = raw.startDate;
  }
  if (raw.endDate) {
    if (!isValidIsoDateOnly(raw.endDate)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "endDate must be a valid YYYY-MM-DD date",
        },
      ]);
    }
    endDate = raw.endDate;
  }
  if (startDate && endDate) {
    if (new Date(startDate + "T00:00:00Z").getTime() > new Date(endDate + "T00:00:00Z").getTime()) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["startDate", "endDate"],
          message: "startDate cannot be after endDate",
        },
      ]);
    }
  }

  // ---- Boolean flag ----
  let hasAvailableSpots: boolean | undefined;
  if (raw.hasAvailableSpots !== undefined) {
    const normalized = raw.hasAvailableSpots.toLowerCase();
    if (normalized === "true") hasAvailableSpots = true;
    else if (normalized === "false") hasAvailableSpots = false;
    else {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["hasAvailableSpots"],
          message: "hasAvailableSpots must be true or false",
        },
      ]);
    }
  }

  // ---- Tags ----
  let tags: string[] | undefined;
  if (raw.tags !== undefined) {
    const parts = raw.tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (parts.length > 0) {
      // Validate each tag
      for (const tag of parts) {
        if (!TAG_REGEX.test(tag)) {
          throw new z.ZodError([
            {
              code: z.ZodIssueCode.custom,
              path: ["tags"],
              message: `Invalid tag '${tag}' (allowed: alphanumeric - _ /, max 50 chars)`,
            },
          ]);
        }
      }
      // Deduplicate
      tags = Array.from(new Set(parts));
    }
  }

  return {
    page,
    limit,
    startDate,
    endDate,
    hasAvailableSpots,
    tags,
  } satisfies ActivitiesQueryFilters;
}
