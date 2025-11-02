// REST API Endpoint: List Workers (GET /api/admin/workers)
// Responsibilities:
//  - Authenticate (admin role)
//  - Validate pagination query params
//  - Delegate to service listWorkers
//  - Log structured events (start/success/error)
//  - Map errors to JSON using shared helpers
//  - Return 200 OK with possibly empty list

import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client";
import { authenticateAdmin, jsonResponse, errorToDto } from "../../../lib/api/helper";
import { fromZodError, normalizeUnknownError } from "../../../lib/services/errors";
import { validateWorkersListQuery } from "../../../lib/validation/workers.schema";
import { listWorkers, createWorker } from "../../../lib/services/workers.service";
import { validateWorkerCreateBody } from "../../../lib/validation/workers.schema";
import type { WorkerDTO } from "../../../types";
import type { WorkersListResponseDTO } from "../../../types";

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

  // ---- Query Validation ----
  const url = new URL(context.request.url);
  let parsedQuery;
  try {
    parsedQuery = validateWorkersListQuery(url.searchParams);
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
      action: "LIST_WORKERS",
      phase: "start",
      admin_id: adminProfile.id,
      page: parsedQuery.page,
      limit: parsedQuery.limit,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const result: WorkersListResponseDTO = await listWorkers(supabase, parsedQuery);

    // ---- Logging: success ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "LIST_WORKERS",
        phase: "success",
        admin_id: adminProfile.id,
        page: result.pagination.page,
        limit: result.pagination.limit,
        returned_count: result.workers.length,
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
        action: "LIST_WORKERS",
        phase: "error",
        admin_id: adminProfile.id,
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

  // ---- Auth ----
  let adminProfile: { id: string; role: string };
  try {
    adminProfile = await authenticateAdmin(supabase);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // ---- Body Validation ----
  let body: WorkerDTO | undefined;
  let parsed;
  try {
    const raw = await context.request.json();
    parsed = validateWorkerCreateBody(raw);
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
      action: "CREATE_WORKER",
      phase: "start",
      admin_id: adminProfile.id,
      email: parsed.email,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    body = await createWorker(supabase, parsed);
    // ---- Logging: success ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "CREATE_WORKER",
        phase: "success",
        admin_id: adminProfile.id,
        worker_id: body.id,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(body, 201);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // ---- Logging: error ----
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "CREATE_WORKER",
        phase: "error",
        admin_id: adminProfile.id,
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
