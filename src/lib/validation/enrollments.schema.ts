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

// --- Withdraw Enrollment Path Params Schema ---
// Validates dynamic route params for DELETE /api/enrollments/:childId/:activityId
// Performs string to number coercion with regex safeguard before numeric checks.
export const withdrawParamsSchema = z.object({
  childId: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()),
  activityId: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()),
});

export type WithdrawParamsSchemaInput = z.infer<typeof withdrawParamsSchema>;

export function validateWithdrawParams(params: Record<string, string | undefined>): WithdrawParamsSchemaInput {
  return withdrawParamsSchema.parse(params);
}
