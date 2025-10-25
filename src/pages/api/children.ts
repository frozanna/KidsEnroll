// REST API Endpoints: Children
//  - GET /api/children : List children owned by authenticated parent
//  - POST /api/children : Create a child record for authenticated parent
// Implements flows defined in /.ai/cr-child-implementation-plan.md (POST) & listing plan (GET)
// Transport responsibilities:
//  - Authenticate & authorize (must be logged in & role parent)
//  - Query children owned by authenticated parent (GET)
//  - Parse & validate body via Zod (POST)
//  - Delegate creation logic to service layer (POST)
//  - Map ApiError -> ErrorResponseDTO
//  - Structured JSON logging (start/success/error)
//  - No pagination in MVP for GET

import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../db/supabase.client";
import { createError, normalizeUnknownError, fromZodError } from "../../lib/services/errors";
import type { ChildrenListResponseDTO, ChildDTO, CreateChildResponseDTO } from "../../types";
import { jsonResponse, errorToDto, authenticateParent } from "../../lib/api/helper";
import { validateCreateChildBody } from "../../lib/validation/children.schema";
import { createChild, listChildren } from "../../lib/services/children.service";

export const prerender = false; // API route - avoid prerendering

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // --- Auth & role check (centralized) ---
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
      action: "LIST_CHILDREN",
      phase: "start",
      parent_id: profile.id,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const list: ChildDTO[] = await listChildren(supabase, profile.id);
    const response: ChildrenListResponseDTO = { children: list };

    // --- Logging: success ---
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "LIST_CHILDREN",
        phase: "success",
        parent_id: profile.id,
        count: list.length,
        timestamp: new Date().toISOString(),
      })
    );

    return jsonResponse(response, 200);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "LIST_CHILDREN",
        phase: "error",
        parent_id: profile.id,
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // --- Auth & role check (centralized) ---
  let profile: { id: string; role: string };
  try {
    profile = await authenticateParent(supabase);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // --- Parse raw JSON body ---
  let raw: unknown;
  try {
    raw = await context.request.json();
  } catch {
    const err = createError("VALIDATION_ERROR", "Invalid or missing JSON body");
    return jsonResponse(errorToDto(err), err.status);
  }

  // --- Zod validation ---
  let body: { first_name: string; last_name: string; birth_date: string; description?: string | null };
  try {
    body = validateCreateChildBody(raw);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "issues" in err) {
      const apiErr = fromZodError(err as import("zod").ZodError);
      return jsonResponse(errorToDto(apiErr), apiErr.status);
    }
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // --- Logging: start ---
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      action: "CREATE_CHILD",
      phase: "start",
      parent_id: profile.id,
      first_name: body.first_name,
      last_name: body.last_name,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const result: CreateChildResponseDTO = await createChild(supabase, profile.id, body);

    // --- Logging: success ---
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "CREATE_CHILD",
        phase: "success",
        parent_id: profile.id,
        child_id: result.id,
        timestamp: new Date().toISOString(),
      })
    );

    return jsonResponse(result, 201);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // --- Logging: error ---
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "CREATE_CHILD",
        phase: "error",
        parent_id: profile.id,
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
