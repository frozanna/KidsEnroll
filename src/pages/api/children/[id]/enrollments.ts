// REST API Endpoint: List Child Enrollments (GET /api/children/:id/enrollments)
// Implements the flow defined in /.ai/endpoints/child-enrollment-implementation-plan.md
// Transport layer responsibilities:
//  - Validate path param (child id) via Zod schema
//  - Authenticate & ensure parent role
//  - Delegate business logic to service (listChildEnrollments)
//  - Map ApiError -> ErrorResponseDTO consistently
//  - Structured minimal logging for audit/debug

import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../../db/supabase.client";
import { childIdParamSchema } from "../../../../lib/validation/children.schema";
import { listChildEnrollments } from "../../../../lib/services/enrollments.service";
import { fromZodError, normalizeUnknownError } from "../../../../lib/services/errors";
import { jsonResponse, errorToDto, authenticateParent } from "../../../../lib/api/helper";
import type { ChildEnrollmentsListResponseDTO } from "../../../../types";

export const prerender = false; // API route - dynamic SSR

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // -- Auth & role check --
  let profile: { id: string; role: string };
  try {
    profile = await authenticateParent(supabase);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // -- Validate path param --
  let paramsParsed: { id: number };
  try {
    paramsParsed = childIdParamSchema.parse({ id: context.params.id });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "issues" in err) {
      const apiErr = fromZodError(err as import("zod").ZodError);
      return jsonResponse(errorToDto(apiErr), apiErr.status);
    }
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // Log start
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      action: "LIST_CHILD_ENROLLMENTS",
      phase: "start",
      parent_id: profile.id,
      child_id: paramsParsed.id,
      timestamp: new Date().toISOString(),
    })
  );

  // -- Business logic --
  try {
    const result: ChildEnrollmentsListResponseDTO = await listChildEnrollments(supabase, profile.id, paramsParsed.id);

    // Log success
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "LIST_CHILD_ENROLLMENTS",
        phase: "success",
        parent_id: profile.id,
        child_id: paramsParsed.id,
        enrollments_count: result.enrollments.length,
        timestamp: new Date().toISOString(),
      })
    );

    return jsonResponse(result, 200);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // Log error
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "LIST_CHILD_ENROLLMENTS",
        phase: "error",
        parent_id: profile.id,
        child_id: paramsParsed.id,
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
