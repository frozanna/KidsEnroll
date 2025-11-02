// REST API Endpoint: Withdraw Enrollment (DELETE /api/enrollments/:childId/:activityId)
// Implements flow per /.ai/endpoints/dl-enrollment-implementation-plan.md
// Transport responsibilities:
//  - Authenticate parent user
//  - Validate path params via Zod (withdrawParamsSchema)
//  - Delegate business logic to withdrawEnrollment service
//  - Map ApiError to consistent ErrorResponseDTO
//  - Structured JSON logging for audit trail

import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../../db/supabase.client";
import { authenticateParent, jsonResponse, errorToDto } from "../../../../lib/api/helper";
import { normalizeUnknownError } from "../../../../lib/services/errors";
import { withdrawEnrollment } from "../../../../lib/services/enrollments.service";
import { validateWithdrawParams } from "../../../../lib/validation/enrollments.schema";
import type { DeleteEnrollmentResponseDTO } from "../../../../types";

export const prerender = false; // API route

export const DELETE: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // Authenticate parent
  let profile: { id: string; role: string };
  try {
    profile = await authenticateParent(supabase);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // Validate path params
  const paramsRaw = {
    childId: context.params.childId,
    activityId: context.params.activityId,
  } as Record<string, string | undefined>;

  let params: { childId: number; activityId: number };
  try {
    params = validateWithdrawParams(paramsRaw);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err); // fromZodError will be inside normalize if ApiError already
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // Logging: start
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      action: "WITHDRAW_ENROLLMENT",
      phase: "start",
      parent_id: profile.id,
      child_id: params.childId,
      activity_id: params.activityId,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const result: DeleteEnrollmentResponseDTO = await withdrawEnrollment(
      supabase,
      profile.id,
      params.childId,
      params.activityId
    );

    // Logging: success
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "WITHDRAW_ENROLLMENT",
        phase: "success",
        parent_id: profile.id,
        child_id: params.childId,
        activity_id: params.activityId,
        timestamp: new Date().toISOString(),
      })
    );

    return jsonResponse(result, 200);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // Logging: error
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "WITHDRAW_ENROLLMENT",
        phase: "error",
        parent_id: profile.id,
        child_id: params.childId,
        activity_id: params.activityId,
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
