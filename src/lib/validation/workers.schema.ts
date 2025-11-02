// Zod schema & parsing helpers for Workers admin endpoints (GET /api/admin/workers, GET /api/admin/workers/:id)
// Responsibilities (transport-layer validation only):
//  - Validate pagination query parameters (page, limit) with defaults (1, 20) and limit upper bound (100)
//  - Provide a parse helper returning strongly typed object consumed by service layer
//  - Validate path param id (> 0 positive integer)
//  - Throw ZodError on validation failure (mapped upstream to ApiError VALIDATION_ERROR)
//
// Pattern aligned with existing schemas (activities.schema.ts, children.schema.ts)

import { z } from "zod";

// ---- Types ----
export interface WorkersListQueryParsed {
  page: number; // >=1
  limit: number; // 1..100
}

// ---- Raw query schema (string values) ----
const rawWorkersQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

/**
 * Parses & validates URLSearchParams for /api/admin/workers (list).
 * Applies defaults page=1, limit=20 if absent.
 * Enforces integer bounds and max limit to defend against resource exhaustion.
 */
export function validateWorkersListQuery(params: URLSearchParams): WorkersListQueryParsed {
  const rawObj: Record<string, string> = {};
  for (const [k, v] of params.entries()) rawObj[k] = v;
  const raw = rawWorkersQuerySchema.parse(rawObj);

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
  if (issues.length) throw new z.ZodError(issues);

  return { page, limit } satisfies WorkersListQueryParsed;
}

// ---- Path param schema for /api/admin/workers/:id ----
export const workerIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/g, "id must be a positive integer string")
    .transform((v) => Number(v))
    .refine((n) => Number.isInteger(n) && n > 0, "id must be > 0"),
});

export type WorkerIdParamParsed = z.infer<typeof workerIdParamSchema>;

export function validateWorkerIdParam(rawId: string): number {
  return workerIdParamSchema.parse({ id: rawId }).id;
}

// ---- Body schemas for create & update (identical full replacement semantics) ----
// Name fields trimmed and must be non-empty after trim. Email normalized to lowercase.
const nameSchema = z.string().trim().min(1, "must not be empty").max(100, "must be at most 100 characters");

export const workerBodySchema = z.object({
  first_name: nameSchema,
  last_name: nameSchema,
  email: z
    .string()
    .trim()
    .min(1, "email must not be empty")
    .email("invalid email format")
    .max(255, "email too long")
    .transform((v) => v.toLowerCase()),
});

export type WorkerBodyParsed = z.infer<typeof workerBodySchema>;

export function validateWorkerCreateBody(json: unknown): WorkerBodyParsed {
  return workerBodySchema.parse(json);
}

export function validateWorkerUpdateBody(json: unknown): WorkerBodyParsed {
  return workerBodySchema.parse(json);
}
