// REST API Endpoint: Get Child Details (GET /api/children/:id)
// Implements plan in `.ai/endpoints/child-implementation-plan.md`.
// Responsibilities:
//  - Validate path param id (positive integer)
//  - Authenticate & ensure parent role (reuse authenticateParent helper)
//  - Delegate ownership & retrieval logic to service (getChildById)
//  - Distinguish 404 vs 403 via service error throwing
//  - Uniform error mapping & JSON response formatting
//  - Structured logging for audit trail (start/success/error)
//  - Avoid exposing parent_id in response (use ChildDTO shape)
//
// Edge cases covered:
//  - Non-numeric id -> VALIDATION_ERROR (400)
//  - id <= 0 -> VALIDATION_ERROR (400)
//  - Unauthorized / missing session -> AUTH_UNAUTHORIZED (401)
//  - Authenticated non-parent role -> AUTH_UNAUTHORIZED (403 override inside authenticateParent)
//  - Child not found -> CHILD_NOT_FOUND (404)
//  - Child owned by different parent -> CHILD_NOT_OWNED (403)
//  - Unexpected DB error -> INTERNAL_ERROR (500)
//
// Notes:
//  - Uses two-query pattern in service for ownership distinction per spec.
//  - Logs are JSON.stringify for ingestion simplicity.
//  - All errors funneled through errorToDto for consistent transport layer shape.

import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client";
import { childIdParamSchema } from "../../../lib/validation/children.schema";
import { getChildById } from "../../../lib/services/children.service";
import { fromZodError, normalizeUnknownError } from "../../../lib/services/errors";
import { jsonResponse, errorToDto, authenticateParent } from "../../../lib/api/helper";

export const prerender = false; // API route - no static generation

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // --- Validate path param ---
  let childId: number;
  try {
    const parsed = childIdParamSchema.parse(context.params);
    childId = parsed.id;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "issues" in err) {
      const apiErr = fromZodError(err as import("zod").ZodError);
      return jsonResponse(errorToDto(apiErr), apiErr.status);
    }
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // --- Authenticate & role check ---
  let profile: { id: string; role: string };
  try {
    profile = await authenticateParent(supabase);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // --- Logging: start ---
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      action: "GET_CHILD",
      phase: "start",
      parent_id: profile.id,
      child_id: childId,
      timestamp: new Date().toISOString(),
    })
  );

  // --- Business logic delegation ---
  try {
    const child = await getChildById(supabase, profile.id, childId);

    // --- Logging: success ---
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "GET_CHILD",
        phase: "success",
        parent_id: profile.id,
        child_id: child.id,
        timestamp: new Date().toISOString(),
      })
    );

    return jsonResponse(child, 200);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // --- Logging: error ---
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "GET_CHILD",
        phase: "error",
        parent_id: profile.id,
        child_id: childId,
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
