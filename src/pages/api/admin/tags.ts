// REST API Endpoint: List Activity Tags (GET /api/admin/tags)
// Responsibilities:
//  - Authenticate admin user (JWT via Supabase)
//  - Provide static closed list of activity tags via service layer
//  - Structured logging (start/auth_ok/success/error) without sensitive data
//  - Consistent error mapping using shared helpers
//  - Return 200 OK with TagsListResponseDTO shape
//
// Edge Cases:
//  - Missing/invalid token -> 401 AUTH_UNAUTHORIZED
//  - Profile not found -> 401 AUTH_UNAUTHORIZED
//  - Role != admin -> 403 AUTH_UNAUTHORIZED (forbidden variant)
//  - Unexpected Supabase error during auth -> 500 INTERNAL_ERROR
//
// Validation: No query/body parameters (simple GET) -> no zod schema required.

import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client";
import { authenticateAdmin, jsonResponse, errorToDto } from "../../../lib/api/helper";
import { normalizeUnknownError } from "../../../lib/services/errors";
import { listActivityTags } from "../../../lib/services/admin.tags.service";

export const prerender = false;

// GET /api/admin/tags
export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // ---- Auth ----
  let adminProfile: { id: string; role: string };
  try {
    adminProfile = await authenticateAdmin(supabase);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "LIST_TAGS",
        phase: "auth_ok",
        admin_id: adminProfile.id,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Logging: start ----
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      action: "LIST_TAGS",
      phase: "start",
      admin_id: adminProfile.id,
      timestamp: new Date().toISOString(),
    })
  );

  // ---- Service Call ----
  try {
    const dto = listActivityTags();

    // ---- Logging: success ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "LIST_TAGS",
        phase: "success",
        admin_id: adminProfile.id,
        tags_count: dto.tags.length,
        timestamp: new Date().toISOString(),
      })
    );

    return jsonResponse(dto, 200);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // ---- Logging: error ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "LIST_TAGS",
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
