// Service layer for admin Workers endpoints
// Responsibilities:
//  - Fetch paginated workers list with total count
//  - Fetch single worker by id
//  - Map Supabase errors to ApiError(INTERNAL_ERROR)
//  - Map missing worker to ApiError(WORKER_NOT_FOUND)
//  - Avoid over-fetching (range & count exact)
//
// Edge Cases:
//  - Empty table -> empty list with total=0
//  - Nonexistent id -> WORKER_NOT_FOUND
//  - Supabase query error -> INTERNAL_ERROR
//  - Pagination beyond end -> empty workers array, total reflects full size
//

import type { SupabaseClient } from "../../db/supabase.client";
import type { WorkerDTO, WorkersListResponseDTO } from "../../types";
import type { WorkerDeleteResponseDTO } from "../../types";
import { createError } from "./errors";
import { PG_UNIQUE_VIOLATION } from "../postgres";
import type { PostgrestErrorLike } from "../postgres";

export interface ListWorkersInput {
  page: number;
  limit: number;
}

/**
 * List workers with pagination using Supabase range and exact count.
 */
export async function listWorkers(
  supabase: SupabaseClient,
  { page, limit }: ListWorkersInput
): Promise<WorkersListResponseDTO> {
  const offset = (page - 1) * limit;
  const rangeEnd = offset + limit - 1;

  const { data, error, count } = await supabase
    .from("workers")
    .select("id, first_name, last_name, email, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, rangeEnd);

  if (error) {
    throw createError("INTERNAL_ERROR", error.message);
  }

  return {
    workers: (data as WorkerDTO[]) ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
    },
  } satisfies WorkersListResponseDTO;
}

/**
 * Fetch a single worker by id.
 */
export async function getWorkerById(supabase: SupabaseClient, id: number): Promise<WorkerDTO> {
  const { data, error } = await supabase
    .from("workers")
    .select("id, first_name, last_name, email, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw createError("INTERNAL_ERROR", error.message);
  }
  if (!data) {
    throw createError("WORKER_NOT_FOUND", "Worker not found");
  }
  return data as WorkerDTO;
}

// ---- Create / Update ----
export async function createWorker(
  supabase: SupabaseClient,
  input: { first_name: string; last_name: string; email: string }
): Promise<WorkerDTO> {
  const { data, error } = await supabase
    .from("workers")
    .insert({ first_name: input.first_name, last_name: input.last_name, email: input.email })
    .select("id, first_name, last_name, email, created_at")
    .single();

  if (error) {
    const pgErr = error as PostgrestErrorLike;
    if (pgErr.code === PG_UNIQUE_VIOLATION) {
      throw createError("WORKER_EMAIL_CONFLICT", "Worker email already exists");
    }
    throw createError("INTERNAL_ERROR", error.message);
  }
  return data as WorkerDTO;
}

export async function updateWorker(
  supabase: SupabaseClient,
  id: number,
  input: { first_name: string; last_name: string; email: string }
): Promise<WorkerDTO> {
  const { data, error } = await supabase
    .from("workers")
    .update({ first_name: input.first_name, last_name: input.last_name, email: input.email })
    .eq("id", id)
    .select("id, first_name, last_name, email, created_at")
    .maybeSingle();

  if (error) {
    const pgErr = error as PostgrestErrorLike;
    if (pgErr.code === PG_UNIQUE_VIOLATION) {
      throw createError("WORKER_EMAIL_CONFLICT", "Worker email already exists");
    }
    throw createError("INTERNAL_ERROR", error.message);
  }
  if (!data) {
    throw createError("WORKER_NOT_FOUND", "Worker not found");
  }
  return data as WorkerDTO;
}

// ---- Delete ----
/**
 * Delete a worker by id ensuring no activities are associated.
 * Flow:
 *  1. Verify worker exists (maybeSingle select id)
 *  2. Check for at least one associated activity (select id limit 1)
 *  3. Perform delete, mapping unexpected errors to INTERNAL_ERROR
 *  4. Return confirmation message
 *
 * Concurrency note: A race creating an activity after the precondition check but before delete
 * might still result in cascading delete if FK has ON DELETE CASCADE. MVP accepts this risk.
 */
export async function deleteWorker(supabase: SupabaseClient, id: number): Promise<WorkerDeleteResponseDTO> {
  // 1. Existence check
  const { data: existing, error: existError } = await supabase.from("workers").select("id").eq("id", id).maybeSingle();
  if (existError) {
    throw createError("INTERNAL_ERROR", existError.message);
  }
  if (!existing) {
    throw createError("WORKER_NOT_FOUND", "Worker not found");
  }

  // 2. Association check (limit 1 for efficiency)
  const { data: activityRef, error: actError } = await supabase
    .from("activities")
    .select("id")
    .eq("worker_id", id)
    .limit(1)
    .maybeSingle();
  // PGRST116 = No rows found for maybeSingle (acceptable)
  if (actError && actError.code !== "PGRST116") {
    throw createError("INTERNAL_ERROR", actError.message);
  }
  if (activityRef) {
    throw createError("WORKER_HAS_ACTIVITIES", "Worker has assigned activities and cannot be deleted");
  }

  // 3. Delete
  const { error: delError } = await supabase.from("workers").delete().eq("id", id);
  if (delError) {
    throw createError("INTERNAL_ERROR", delError.message);
  }

  // 4. Response
  return { message: "Worker deleted successfully" };
}
