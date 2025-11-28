// REST API Endpoint: List Activities (GET /api/activities)
// Implements step 3 of the plan in /.ai/endpoints/acivities-implementation-plan.md
// Transport Responsibilities:
//  - Authenticate & authorize (parent role) via helper
//  - Parse & validate query params (Zod schema -> filters object)
//  - Delegate to service (listActivities)
//  - Map ApiError -> ErrorResponseDTO
//  - Structured JSON logging (start/success/error)
//  - Always return 200 with possibly empty list (no 404 for empty set)

import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../db/supabase.client";
import { authenticateParent, jsonResponse, errorToDto } from "../../lib/api/helper";
import { fromZodError, normalizeUnknownError } from "../../lib/services/errors";
import { validateActivitiesQuery } from "../../lib/validation/activities.schema";
import { listActivities } from "../../lib/services/activities.service";
import type { ActivitiesListResponseDTO } from "../../types";

export const prerender = false; // API route - disable prerendering

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // ---- Auth ----
  let profile: { id: string; role: string };
  try {
    profile = await authenticateParent(supabase);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Query Validation ----
  const url = new URL(context.request.url);
  let filters: ReturnType<typeof validateActivitiesQuery>;
  try {
    filters = validateActivitiesQuery(url.searchParams);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "issues" in err) {
      const apiErr = fromZodError(err as import("zod").ZodError);
      return jsonResponse(errorToDto(apiErr), apiErr.status);
    }
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Logging: start ----
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      action: "LIST_ACTIVITIES",
      phase: "start",
      parent_id: profile.id,
      filters,
      timestamp: new Date().toISOString(),
    })
  );

  // ---- Business logic ----
  try {
    const result: ActivitiesListResponseDTO = await listActivities(supabase, filters);

    // ---- Logging: success ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "LIST_ACTIVITIES",
        phase: "success",
        parent_id: profile.id,
        returned_count: result.activities.length,
        total: result.pagination.total,
        page: result.pagination.page,
        limit: result.pagination.limit,
        timestamp: new Date().toISOString(),
      })
    );

    return jsonResponse(result, 200);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // ---- Logging: error ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "LIST_ACTIVITIES",
        phase: "error",
        parent_id: profile.id,
        error_code: apiErr.code,
        error_details: apiErr.message,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
