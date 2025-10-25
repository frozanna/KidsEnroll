// REST API Endpoint: Create Enrollment (POST /api/enrollments)
// Implements the flow defined in /.ai/enrollment-implementation-plan.md
// Responsibilities here (transport layer):
//  - Extract & validate request body (Zod schema)
//  - Authenticate & authorize (must be logged in & role parent)
//  - Delegate business logic to service (createEnrollment)
//  - Map ApiError -> ErrorResponseDTO
//  - Structured logging for audit trail

import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../db/supabase.client";
import { validateCreateEnrollmentBody } from "../../lib/validation/enrollments.schema";
import { createEnrollment } from "../../lib/services/enrollments.service";
import { fromZodError, normalizeUnknownError, ApiError, createError } from "../../lib/services/errors";
import type { ErrorResponseDTO, CreateEnrollmentResponseDTO } from "../../types";

export const prerender = false; // API route - no prerendering

// Utility: unified JSON response helper.
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Map ApiError to transport ErrorResponseDTO
function errorToDto(err: ApiError): ErrorResponseDTO {
  const base = {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  } satisfies ErrorResponseDTO;
  return base;
}

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // -- Auth & role check --
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    const err = createError("AUTH_UNAUTHORIZED", "Unauthorized", { status: 401 });
    return jsonResponse(errorToDto(err), err.status);
  }

  // Fetch profile to confirm role parent
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) {
    const err = createError("INTERNAL_ERROR", profileError.message);
    return jsonResponse(errorToDto(err), err.status);
  }
  if (!profile) {
    const err = createError("AUTH_UNAUTHORIZED", "Profile not found", { status: 401 });
    return jsonResponse(errorToDto(err), err.status);
  }
  if (profile.role !== "parent") {
    // Per plan: role mismatch -> 403
    const err = createError("AUTH_UNAUTHORIZED", "Forbidden: parent role required", { status: 403 });
    return jsonResponse(errorToDto(err), err.status);
  }

  // -- Parse & validate body --
  let bodyRaw: unknown;
  try {
    bodyRaw = await context.request.json();
  } catch {
    const err = createError("VALIDATION_ERROR", "Invalid or missing JSON body");
    return jsonResponse(errorToDto(err), err.status);
  }

  let body: { child_id: number; activity_id: number };
  try {
    body = validateCreateEnrollmentBody(bodyRaw);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "issues" in err) {
      // Narrow ZodError without using any
      const apiErr = fromZodError(err as unknown as import("zod").ZodError);
      return jsonResponse(errorToDto(apiErr), apiErr.status);
    }
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // Log start attempt
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      action: "ENROLL_CHILD",
      phase: "start",
      parent_id: profile.id,
      child_id: body.child_id,
      activity_id: body.activity_id,
      timestamp: new Date().toISOString(),
    })
  );

  // -- Business logic delegation --
  try {
    const result: CreateEnrollmentResponseDTO = await createEnrollment(supabase, profile.id, body);

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "ENROLL_CHILD",
        phase: "success",
        parent_id: profile.id,
        child_id: body.child_id,
        activity_id: body.activity_id,
        enrolled_at: result.enrolled_at,
        timestamp: new Date().toISOString(),
      })
    );

    return jsonResponse(result, 201);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "ENROLL_CHILD",
        phase: "error",
        parent_id: profile.id,
        child_id: body.child_id,
        activity_id: body.activity_id,
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
