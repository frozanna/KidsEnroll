// Service layer for admin Workers endpoints
// Implements listWorkers and getWorkerById according to plan in .ai/endpoints/workers-implementation-plan.md
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
// Performance Considerations:
//  - Single query with count for list (uses select with count: 'exact' and range)
//  - Ordered by created_at descending for determinism

import type { SupabaseClient } from "../../db/supabase.client";
import type { WorkerDTO, WorkersListResponseDTO } from "../../types";
import { createError } from "./errors";

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
// Unique violation Postgres error code constant (defensive; Supabase surfaces code 23505 for duplicate key)
const UNIQUE_VIOLATION_CODE = "23505";

interface PostgrestErrorLike {
  message: string;
  code?: string;
}

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
    if (pgErr.code === UNIQUE_VIOLATION_CODE) {
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
    if (pgErr.code === UNIQUE_VIOLATION_CODE) {
      throw createError("WORKER_EMAIL_CONFLICT", "Worker email already exists");
    }
    throw createError("INTERNAL_ERROR", error.message);
  }
  if (!data) {
    throw createError("WORKER_NOT_FOUND", "Worker not found");
  }
  return data as WorkerDTO;
}
