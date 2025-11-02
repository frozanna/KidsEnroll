// REST API Endpoint: Update Activity (PATCH /api/admin/activities/:id)
// Responsibilities:
//  - Authenticate admin
//  - Validate path param id & body (zod) ensuring at least one field
//  - Delegate update to service
//  - Log structured lifecycle events
//  - Map domain and validation errors
//
// Edge Cases:
//  - Activity not found -> 404
//  - Worker not found when changing worker -> 404
//  - start_datetime past -> 400 VALIDATION_ERROR
//  - Updating only tags -> valid
//  - Empty tags array -> clears tags
//
import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../../db/supabase.client";
import { authenticateAdmin, jsonResponse, errorToDto } from "../../../../lib/api/helper";
import { fromZodError, normalizeUnknownError } from "../../../../lib/services/errors";
import {
  validateAdminActivityIdParam,
  validateUpdateAdminActivityBody,
} from "../../../../lib/validation/admin.activities.schema";
import { updateAdminActivity } from "../../../../lib/services/admin.activities.service";
import type { AdminActivityUpdateResponseDTO } from "../../../../types";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // ---- Auth ----
  let adminProfile: { id: string; role: string };
  try {
    adminProfile = await authenticateAdmin(supabase);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Path Param Validation ----
  let id: number;
  try {
    id = validateAdminActivityIdParam(context.params.id ?? "");
  } catch (err: unknown) {
    if (err && typeof err === "object" && "issues" in err) {
      const apiErr = fromZodError(err as import("zod").ZodError);
      return jsonResponse(errorToDto(apiErr), apiErr.status);
    }
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Body Validation ----
  let parsed;
  try {
    const raw = await context.request.json();
    parsed = validateUpdateAdminActivityBody(raw);
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
      action: "UPDATE_ACTIVITY",
      phase: "start",
      admin_id: adminProfile.id,
      activity_id: id,
      fields: Object.keys(parsed),
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const updated: AdminActivityUpdateResponseDTO = await updateAdminActivity(supabase, id, parsed);

    // ---- Logging: success ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "UPDATE_ACTIVITY",
        phase: "success",
        admin_id: adminProfile.id,
        activity_id: id,
        notifications_sent: updated.notifications_sent,
        timestamp: new Date().toISOString(),
      })
    );

    return jsonResponse(updated, 200);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // ---- Logging: error ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "UPDATE_ACTIVITY",
        phase: "error",
        admin_id: adminProfile.id,
        activity_id: id,
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
