import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../../db/supabase.client";
import { authenticateAdmin, jsonResponse, errorToDto } from "../../../../lib/api/helper";
import { normalizeUnknownError, fromZodError } from "../../../../lib/services/errors";
import { validateParentIdParam } from "../../../../lib/validation/admin.parents.schema";
import { getParentById } from "../../../../lib/services/parents.service";

export const prerender = false;

// GET /api/admin/parents/:id
// Response: ParentDetailDTO
export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // ---- Auth ----
  try {
    await authenticateAdmin(supabase);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Param Validation ----
  let parentId: string;
  try {
    parentId = validateParentIdParam(context.params.id || "");
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
    const result = await getParentById(supabase, parentId);
    return jsonResponse(result, 200);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
