// Zod validation schema for profile update endpoint (/api/profile PATCH)
// Ensures first_name & last_name are provided, trimmed, non-empty, and within length bounds.
// Implementation per plan in `.ai/endpoints/profile-implementation-plan.md`.

import { z } from "zod";
import { fromZodError, createError } from "../services/errors";

// Accept only required fields first_name & last_name; disallow unknown fields.
export const updateProfileSchema = z
  .object({
    first_name: z.string().trim().min(1, "first_name required").max(100, "first_name too long"),
    last_name: z.string().trim().min(1, "last_name required").max(100, "last_name too long"),
  })
  .strict();

export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>;

/**
 * Validate raw JSON body for PATCH /api/profile.
 * Throws ApiError (VALIDATION_ERROR) wrapped from ZodError when invalid.
 */
export function validateUpdateProfileBody(raw: unknown): UpdateProfileSchema {
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    throw fromZodError(parsed.error);
  }
  return parsed.data;
}

/** Defensive helper for when request.json() fails (non-JSON body). */
export function invalidJsonBodyError() {
  return createError("VALIDATION_ERROR", "Invalid or missing JSON body");
}
