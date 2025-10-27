// REST API Endpoint: Get Single Activity (GET /api/activities/:id)
// Implements transport layer per /.ai/endpoints/activity-implementation-plan.md
// Responsibilities:
//  - Authenticate & authorize parent role
//  - Validate path param id (positive integer) via Zod
//  - Delegate to service getActivityById
//  - Map ApiError to ErrorResponseDTO
//  - Structured JSON logging (start/success/error)
//  - Return 404 when activity not found
//  - Defensive handling of unexpected errors (500)

import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client";
import { authenticateParent, jsonResponse, errorToDto } from "../../../lib/api/helper";
import { fromZodError, normalizeUnknownError, createError } from "../../../lib/services/errors";
import { getActivityById } from "../../../lib/services/activities.service";
import type { ActivityDTO } from "../../../types";
import { z } from "zod";

export const prerender = false; // API route - SSR only

// Path param schema (coerce numeric string -> number, enforce int + positive)
const paramSchema = z.object({ id: z.coerce.number().int().positive() });

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

  // ---- Param Validation ----
  let activityId: number;
  try {
    const parsed = paramSchema.parse({ id: context.params.id });
    activityId = parsed.id;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "issues" in err) {
      const apiErr = fromZodError(err as import("zod").ZodError);
      // Override generic message for clarity in path param context.
      apiErr.message = "Invalid path parameter: id";
      return jsonResponse(errorToDto(apiErr), apiErr.status);
    }
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Logging: start ----
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      action: "GET_ACTIVITY",
      phase: "start",
      parent_id: profile.id,
      activity_id: activityId,
      timestamp: new Date().toISOString(),
    })
  );

  // ---- Business Logic ----
  try {
    const activity: ActivityDTO = await getActivityById(supabase, activityId);

    // ---- Logging: success ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "GET_ACTIVITY",
        phase: "success",
        parent_id: profile.id,
        activity_id: activity.id,
        available_spots: activity.available_spots,
        tags_count: activity.tags.length,
        timestamp: new Date().toISOString(),
      })
    );

    return jsonResponse(activity, 200);
  } catch (err: unknown) {
    let apiErr = normalizeUnknownError(err);
    // Special case: not found -> ensure 404 (defensive normalization)
    if (apiErr.code === "ACTIVITY_NOT_FOUND" && apiErr.status !== 404) {
      apiErr = createError("ACTIVITY_NOT_FOUND", apiErr.message, { status: 404 });
    }
    const finalErr = apiErr;

    // ---- Logging: error ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "GET_ACTIVITY",
        phase: "error",
        parent_id: profile.id,
        activity_id: activityId,
        error_code: finalErr.code,
        status: finalErr.status,
        timestamp: new Date().toISOString(),
      })
    );

    return jsonResponse(errorToDto(finalErr), finalErr.status);
  }
};
