import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../../db/supabase.client";
import { authenticateAdmin, jsonResponse, errorToDto } from "../../../../lib/api/helper";
import { normalizeUnknownError, fromZodError } from "../../../../lib/services/errors";
import { validateParentIdParam } from "../../../../lib/validation/admin.parents.schema";
import { getParentById } from "../../../../lib/services/parents.service";
import { deleteParent } from "../../../../lib/services/parents.service";

export const prerender = false;

// GET /api/admin/parents/:id
// Path param: id (UUID)
// Response: ParentDetailDTO
export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // ---- Auth ----
  let adminProfile: { id: string; role: string };
  try {
    adminProfile = await authenticateAdmin(supabase);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "GET_PARENT_DETAIL",
        phase: "auth_ok",
        admin_id: adminProfile.id,
        ts: new Date().toISOString(),
      })
    );
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Param Validation ----
  const idRaw = context.params.id;
  let parentId: string;
  try {
    if (!idRaw) throw new Error("Missing id param");
    parentId = validateParentIdParam(idRaw);
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

// DELETE /api/admin/parents/:id
// Path param: id (UUID)
// Response: ParentDeleteResponseDTO
export const DELETE: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // ---- Auth ----
  let adminProfile: { id: string; role: string };
  try {
    adminProfile = await authenticateAdmin(supabase);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "DELETE_PARENT",
        phase: "auth_ok",
        admin_id: adminProfile.id,
        ts: new Date().toISOString(),
      })
    );
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Param Validation ----
  const idRaw = context.params.id;
  let parentId: string;
  try {
    if (!idRaw) throw new Error("Missing id param");
    parentId = validateParentIdParam(idRaw);
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
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "DELETE_PARENT",
        phase: "delete_start",
        target_parent_id: parentId,
        admin_id: adminProfile.id,
        ts: new Date().toISOString(),
      })
    );
    const result = await deleteParent(supabase, parentId);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "DELETE_PARENT",
        phase: "delete_success",
        target_parent_id: parentId,
        admin_id: adminProfile.id,
        deleted_children: result.deleted_children,
        deleted_enrollments: result.deleted_enrollments,
        ts: new Date().toISOString(),
      })
    );
    return jsonResponse(result, 200);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "DELETE_PARENT",
        phase: "delete_error",
        target_parent_id: parentId,
        admin_id: adminProfile.id,
        error_code: apiErr.code,
        error_message: apiErr.message,
        ts: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
