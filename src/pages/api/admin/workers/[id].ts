// REST API Endpoint: Get Worker Detail (GET /api/admin/workers/:id)
// Responsibilities:
//  - Authenticate (admin role)
//  - Validate path param id
//  - Delegate to service getWorkerById
//  - Log structured events (start/success/error)
//  - Map errors to JSON using shared helpers
//  - Return 200 OK with worker or 404 WORKER_NOT_FOUND

import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../../db/supabase.client";
import { authenticateAdmin, jsonResponse, errorToDto } from "../../../../lib/api/helper";
import { fromZodError, normalizeUnknownError } from "../../../../lib/services/errors";
import { validateWorkerIdParam } from "../../../../lib/validation/workers.schema";
import { getWorkerById, updateWorker, deleteWorker } from "../../../../lib/services/workers.service";
import { validateWorkerUpdateBody } from "../../../../lib/validation/workers.schema";
import type { WorkerDTO } from "../../../../types";

export const prerender = false;

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

  // ---- Param Validation ----
  const rawId = context.params.id;
  if (!rawId) {
    // This should not occur given route definition, but defensive check.
    const apiErr = normalizeUnknownError(new Error("Missing id param"));
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  let id: number;
  try {
    id = validateWorkerIdParam(rawId);
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
      action: "GET_WORKER",
      phase: "start",
      admin_id: adminProfile.id,
      worker_id: id,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const worker: WorkerDTO = await getWorkerById(supabase, id);

    // ---- Logging: success ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "GET_WORKER",
        phase: "success",
        admin_id: adminProfile.id,
        worker_id: id,
        timestamp: new Date().toISOString(),
      })
    );

    return jsonResponse(worker, 200);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // ---- Logging: error ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "GET_WORKER",
        phase: "error",
        admin_id: adminProfile.id,
        worker_id: id,
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};

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

  // ---- Param Validation ----
  const rawId = context.params.id;
  if (!rawId) {
    const apiErr = normalizeUnknownError(new Error("Missing id param"));
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
  let id: number;
  try {
    id = validateWorkerIdParam(rawId);
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
    parsed = validateWorkerUpdateBody(raw);
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
      action: "UPDATE_WORKER",
      phase: "start",
      admin_id: adminProfile.id,
      worker_id: id,
      email: parsed.email,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const updated = await updateWorker(supabase, id, parsed);
    // ---- Logging: success ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "UPDATE_WORKER",
        phase: "success",
        admin_id: adminProfile.id,
        worker_id: updated.id,
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
        action: "UPDATE_WORKER",
        phase: "error",
        admin_id: adminProfile.id,
        worker_id: id,
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};

export const DELETE: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // ---- Auth ----
  let adminProfile: { id: string; role: string };
  try {
    adminProfile = await authenticateAdmin(supabase);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Param Validation ----
  const rawId = context.params.id;
  if (!rawId) {
    const apiErr = normalizeUnknownError(new Error("Missing id param"));
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
  let id: number;
  try {
    id = validateWorkerIdParam(rawId);
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
      action: "DELETE_WORKER",
      phase: "start",
      admin_id: adminProfile.id,
      worker_id: id,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const result = await deleteWorker(supabase, id);
    // ---- Logging: success ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "DELETE_WORKER",
        phase: "success",
        admin_id: adminProfile.id,
        worker_id: id,
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
        action: "DELETE_WORKER",
        phase: "error",
        admin_id: adminProfile.id,
        worker_id: id,
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
