// Zod validation schemas for Admin Activities create & update endpoints.
// Responsibilities:
//  - Enforce input constraints (lengths, numeric bounds, future datetime)
//  - Provide transformation (empty description -> null, tag dedupe)
//  - Provide helper functions for endpoint layer usage (body + param validation)
//  - Ensure update body has at least one modifiable property
//
// Edge Cases Covered:
//  - Empty description string converted to null
//  - Duplicate tags removed, whitespace trimmed
//  - Invalid ISO date or past date rejected
//  - Update with no fields -> validation error
//  - Tags array present but empty -> treated as [] (valid)
//  - Tags with invalid chars rejected (regex)
//
import { z } from "zod";
import type { AdminActivityCreateCommand, AdminActivityUpdateCommand } from "../../types";

// Common tag regex: allow alphanum, dash, underscore, slash.
const TAG_REGEX = /^[A-Za-z0-9\-_/ĄĆĘŁŃÓŚŹŻąćęłńóśźż]{1,50}$/u;

// Datetime must be valid ISO and in the future (> now). We'll parse inside service too, but schema rejects past.
function futureDateRefinement(val: string): boolean {
  const ms = Date.parse(val);
  if (Number.isNaN(ms)) return false;
  return ms > Date.now();
}

const baseCreate = {
  name: z.string().min(1).max(200),
  description: z
    .string()
    .max(2000)
    .transform((v) => (v.trim() === "" ? null : v))
    .optional(),
  cost: z.number().min(0).max(10000),
  participant_limit: z.number().int().min(1).max(1000),
  start_datetime: z.string().refine(futureDateRefinement, "start_datetime must be a valid future ISO datetime"),
  worker_id: z.number().int().min(1),
  tags: z
    .array(z.string().min(1).max(50).regex(TAG_REGEX, "Tag contains invalid characters or length > 50"))
    .transform((arr) => Array.from(new Set(arr.map((t) => t.trim()))))
    .optional(),
};

export const createAdminActivitySchema = z.object(baseCreate);

// Update: all fields optional, require at least one.
export const updateAdminActivitySchema = z
  .object({
    name: baseCreate.name.optional(),
    description: baseCreate.description, // already optional & transformed
    cost: baseCreate.cost.optional(),
    participant_limit: baseCreate.participant_limit.optional(),
    start_datetime: baseCreate.start_datetime.optional(),
    worker_id: baseCreate.worker_id.optional(),
    tags: baseCreate.tags, // optional
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided for update",
    path: [],
  });

// Path param validation
export const adminActivityIdParamSchema = z
  .string()
  .regex(/^[0-9]+$/)
  .transform((v) => Number(v));

// Helper wrappers returning typed command objects.
export function validateCreateAdminActivityBody(raw: unknown): AdminActivityCreateCommand {
  return createAdminActivitySchema.parse(raw) as AdminActivityCreateCommand;
}

export function validateUpdateAdminActivityBody(raw: unknown): AdminActivityUpdateCommand {
  return updateAdminActivitySchema.parse(raw) as AdminActivityUpdateCommand;
}

export function validateAdminActivityIdParam(raw: string): number {
  return adminActivityIdParamSchema.parse(raw);
}
