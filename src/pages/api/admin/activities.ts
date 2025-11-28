// REST API Endpoint: Create Activity (POST /api/admin/activities)
// Responsibilities:
//  - Authenticate admin
//  - Validate request body via zod
//  - Delegate to service createAdminActivity
//  - Log structured events (start/success/error)
//  - Map service/domain errors to JSON response
//
// Edge Cases handled:
//  - Worker not found -> 404 WORKER_NOT_FOUND
//  - start_datetime past -> 400 VALIDATION_ERROR
//  - Duplicate tags -> deduped in validation
//  - Empty description string -> null
//  - Supabase failures -> 500 INTERNAL_ERROR
//
import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client";
import { authenticateAdmin, jsonResponse, errorToDto } from "../../../lib/api/helper";
import { fromZodError, normalizeUnknownError } from "../../../lib/services/errors";
import { validateCreateAdminActivityBody } from "../../../lib/validation/admin.activities.schema";
import { createActivity, listActivitiesAdminDetailed } from "../../../lib/services/admin.activities.service";
import type { AdminActivityDTO, ActivitiesListResponseDTO } from "../../../types";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // ---- Auth ----
  let adminProfile: { id: string; role: string };
  try {
    adminProfile = await authenticateAdmin(supabase);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Body Validation ----
  let parsed;
  try {
    const raw = await context.request.json();
    parsed = validateCreateAdminActivityBody(raw);
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
      action: "CREATE_ACTIVITY",
      phase: "start",
      admin_id: adminProfile.id,
      worker_id: parsed.worker_id,
      name: parsed.name,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const activity: AdminActivityDTO = await createActivity(supabase, parsed);

    // ---- Logging: success ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "CREATE_ACTIVITY",
        phase: "success",
        admin_id: adminProfile.id,
        activity_id: activity.id,
        timestamp: new Date().toISOString(),
      })
    );

    return jsonResponse(activity, 201);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // ---- Logging: error ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "CREATE_ACTIVITY",
        phase: "error",
        admin_id: adminProfile.id,
        error_code: apiErr.code,
        error_details: apiErr.message,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};

// List activities for admin with pagination & aggregates (GET /api/admin/activities)
export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // ---- Auth ----
  let adminProfile: { id: string; role: string };
  try {
    adminProfile = await authenticateAdmin(supabase);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Query Params ----
  const url = new URL(context.request.url);
  const pageParam = url.searchParams.get("page");
  const limitParam = url.searchParams.get("limit");
  const search = url.searchParams.get("search") || undefined;
  const page = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 10));

  // ---- Logging: start ----
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      action: "LIST_ACTIVITIES_ADMIN",
      phase: "start",
      admin_id: adminProfile.id,
      page,
      limit,
      search: search ?? null,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const result: ActivitiesListResponseDTO = await listActivitiesAdminDetailed(supabase, {
      page,
      limit,
      search,
    });

    // ---- Logging: success ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "LIST_ACTIVITIES_ADMIN",
        phase: "success",
        admin_id: adminProfile.id,
        returned_count: result.activities.length,
        total: result.pagination.total,
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
        action: "LIST_ACTIVITIES_ADMIN",
        phase: "error",
        admin_id: adminProfile.id,
        error_code: apiErr.code,
        error_details: apiErr.message,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
