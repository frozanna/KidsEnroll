// Zod schema for Create Enrollment endpoint input validation.
// Responsible only for structural validation (types & basic constraints).
// Business rules (ownership, capacity, duplicate etc.) live in the service layer.

import { z } from "zod";

export const createEnrollmentSchema = z.object({
  child_id: z.number().int().positive(),
  activity_id: z.number().int().positive(),
});

export type CreateEnrollmentSchemaInput = z.infer<typeof createEnrollmentSchema>;

/**
 * Parses and validates raw request body for create enrollment.
 * Throws a ZodError if validation fails (caught & transformed higher up).
 */
export function validateCreateEnrollmentBody(body: unknown): CreateEnrollmentSchemaInput {
  return createEnrollmentSchema.parse(body);
}
