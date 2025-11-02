import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client";
import { authenticateAdmin, jsonResponse, errorToDto } from "../../../lib/api/helper";
import { normalizeUnknownError, fromZodError } from "../../../lib/services/errors";
import { validateListParentsQuery } from "../../../lib/validation/admin.parents.schema";
import { listParents } from "../../../lib/services/parents.service";

export const prerender = false;

// GET /api/admin/parents
// Query params: page, limit, search (optional)
// Response: ParentsListResponseDTO
export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // ---- Auth ----
  let adminProfile: { id: string; role: string };
  try {
    adminProfile = await authenticateAdmin(supabase);
    // Optional simple log (non-sensitive) to justify variable usage
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "LIST_PARENTS",
        phase: "auth_ok",
        admin_id: adminProfile.id,
        ts: new Date().toISOString(),
      })
    );
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Query Validation ----
  let query;
  try {
    query = validateListParentsQuery(new URL(context.request.url).searchParams);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "issues" in err) {
      const apiErr = fromZodError(err as import("zod").ZodError);
      return jsonResponse(errorToDto(apiErr), apiErr.status);
    }
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Service Call ----
  try {
    const result = await listParents(supabase, query);
    return jsonResponse(result, 200);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
