// Zod schema & parsing helper for Create Child endpoint (POST /api/children)
// Mirrors style of enrollments.schema.ts and follows implementation plan in /.ai/cr-child-implementation-plan.md
// Responsibilities (transport-level validation only):
//  - Structural & basic semantic validation of input body
//  - Enforce field length constraints & required fields
//  - Normalize optional description (empty string -> null)
//  - Prevent future birth dates
//  - Provide a single parse helper throwing ZodError (handled upstream)
//
// Notes:
//  - Description max length chosen as 1000 (plan mentions 500 in step list & 1000 in security section; using larger bound per security considerations).
//  - Birth date validated via regex + refine (valid calendar date + not in future).

import { z } from "zod";

// --- Helpers ---
function isValidPastOrTodayDate(isoDate: string): boolean {
  // Basic ISO YYYY-MM-DD pattern already enforced before calling.
  const date = new Date(isoDate + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return false; // Invalid date composition
  const todayUtc = new Date();
  const dateOnly = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const todayOnly = Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate());
  return dateOnly <= todayOnly; // Must not be in the future
}

export const createChildSchema = z.object({
  first_name: z.string().trim().min(1, "first_name required").max(100, "first_name too long"),
  last_name: z.string().trim().min(1, "last_name required").max(100, "last_name too long"),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/g, "birth_date must be YYYY-MM-DD")
    .refine((val) => isValidPastOrTodayDate(val), "birth_date cannot be in the future or invalid"),
  description: z
    .string()
    .trim()
    .max(1000, "description too long")
    .optional()
    .transform((v) => (v === "" ? null : v)),
});

export type CreateChildSchemaInput = z.infer<typeof createChildSchema>;

/**
 * Parses and validates raw request body for Create Child endpoint.
 * Throws ZodError on failure (caught & mapped in endpoint layer).
 */
export function validateCreateChildBody(body: unknown): CreateChildSchemaInput {
  return createChildSchema.parse(body);
}

// --- Update Child (PATCH) ---
// All fields optional; must supply at least one. Mirrors creation constraints.
// birth_date validation reused; description normalization (empty string -> null).
// Refine ensures at least one field present (undefined fields omitted by caller).
export const updateChildSchema = z
  .object({
    first_name: z.string().trim().min(1, "first_name required").max(100, "first_name too long").optional(),
    last_name: z.string().trim().min(1, "last_name required").max(100, "last_name too long").optional(),
    birth_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/g, "birth_date must be YYYY-MM-DD")
      .refine((val) => isValidPastOrTodayDate(val), "birth_date cannot be in the future or invalid")
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, "description too long")
      .optional()
      .transform((v) => (v === "" ? null : v)),
  })
  .refine((obj) => Object.keys(obj).some((k) => (obj as Record<string, unknown>)[k] !== undefined), {
    message: "At least one field must be provided",
  });

export type UpdateChildSchemaInput = z.infer<typeof updateChildSchema>;

export function validateUpdateChildBody(body: unknown): UpdateChildSchemaInput {
  return updateChildSchema.parse(body);
}

export const childIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/g, "id must be a positive integer string")
    .transform((v) => Number(v))
    .refine((n) => Number.isInteger(n) && n > 0, "id must be > 0"),
});

export type ChildIdParamParsed = z.infer<typeof childIdParamSchema>;
