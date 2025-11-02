// Service layer for Admin Activities (create & update)
// Implements business rules per implementation plan.
// Responsibilities:
//  - Validate foreign key references (worker existence)
//  - Enforce future start_datetime (defensive duplicate check in addition to zod)
//  - Insert / update activities rows (facility_id hard-coded = 1 for MVP)
//  - Manage tags (insert on create; full replace on update when provided)
//  - Compute notifications_sent on update (# of enrollments for the activity)
//  - Map Supabase errors to ApiError(INTERNAL_ERROR) and domain errors to specific codes
//
// Edge Cases:
//  - Worker not found -> WORKER_NOT_FOUND
//  - Activity not found on update -> ACTIVITY_NOT_FOUND
//  - start_datetime in past -> VALIDATION_ERROR
//  - Empty tags array on update -> existing tags removed, none inserted
//  - Duplicate tags -> removed in validation layer
//  - Race conditions (e.g. worker deleted between check & insert) -> INTERNAL_ERROR (FK violation)
//
import type { SupabaseClient } from "../../db/supabase.client";
import type {
  AdminActivityCreateCommand,
  AdminActivityDTO,
  AdminActivityUpdateCommand,
  AdminActivityUpdateResponseDTO,
} from "../../types";
import { createError } from "./errors";
import type { PostgrestErrorLike } from "../postgres";

// Helper: fetch worker existence (id only) returning boolean.
async function workerExists(supabase: SupabaseClient, id: number): Promise<boolean> {
  const { data, error } = await supabase.from("workers").select("id").eq("id", id).maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw createError("INTERNAL_ERROR", error.message);
  }
  return !!data;
}

// Helper: fetch activity existence and optionally return full row.
async function fetchActivityRow(supabase: SupabaseClient, id: number) {
  const { data, error } = await supabase
    .from("activities")
    .select("id, name, description, cost, participant_limit, start_datetime, worker_id, facility_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw createError("INTERNAL_ERROR", error.message);
  }
  return data as AdminActivityDTO | null;
}

// Defensive future datetime validation beyond zod.
function assertFutureDate(iso: string) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw createError("VALIDATION_ERROR", "start_datetime must be valid ISO datetime", {
      details: { start_datetime: iso },
    });
  }
  if (ms <= Date.now()) {
    throw createError("VALIDATION_ERROR", "start_datetime must be in the future", {
      details: { start_datetime: iso },
    });
  }
}

// Insert tags helper (id & tag only needed for retrieval layer; store raw tags).
async function insertTags(supabase: SupabaseClient, activityId: number, tags: string[]): Promise<void> {
  if (!tags.length) return; // nothing to insert
  const rows = tags.map((t) => ({ activity_id: activityId, tag: t }));
  const { error } = await supabase.from("activity_tags").insert(rows);
  if (error) {
    throw createError("INTERNAL_ERROR", error.message);
  }
}

// Replace tags on update (delete then bulk insert if any)
async function replaceTags(supabase: SupabaseClient, activityId: number, tags: string[]): Promise<void> {
  // Delete existing
  const { error: delError } = await supabase.from("activity_tags").delete().eq("activity_id", activityId);
  if (delError) {
    throw createError("INTERNAL_ERROR", delError.message);
  }
  if (tags.length) {
    await insertTags(supabase, activityId, tags);
  }
}

// Fetch final DTO for an activity
async function selectActivityDto(supabase: SupabaseClient, id: number): Promise<AdminActivityDTO> {
  const row = await fetchActivityRow(supabase, id);
  if (!row) {
    throw createError("ACTIVITY_NOT_FOUND", "Activity not found");
  }
  return row;
}

export async function createAdminActivity(
  supabase: SupabaseClient,
  command: AdminActivityCreateCommand
): Promise<AdminActivityDTO> {
  // 1. Worker existence
  const exists = await workerExists(supabase, command.worker_id);
  if (!exists) {
    throw createError("WORKER_NOT_FOUND", "Worker not found");
  }

  // 2. Future datetime (defensive)
  assertFutureDate(command.start_datetime);

  // 3. Insert activity (facility_id = 1)
  const insertPayload = {
    name: command.name,
    description: command.description ?? null,
    cost: command.cost,
    participant_limit: command.participant_limit,
    start_datetime: command.start_datetime,
    worker_id: command.worker_id,
    facility_id: 1, // MVP fixed facility
  };

  const { data, error } = await supabase.from("activities").insert(insertPayload).select("id").single();
  if (error) {
    const pgErr = error as PostgrestErrorLike;
    // Domain-specific mapping could be added here if needed
    throw createError("INTERNAL_ERROR", pgErr.message);
  }
  const activityId = (data as { id: number }).id;

  // 4. Tags (optional)
  if (command.tags && command.tags.length) {
    await insertTags(supabase, activityId, command.tags);
  }

  // 5. Select final DTO
  return await selectActivityDto(supabase, activityId);
}

export async function updateAdminActivity(
  supabase: SupabaseClient,
  id: number,
  command: AdminActivityUpdateCommand
): Promise<AdminActivityUpdateResponseDTO> {
  // 1. Existing activity check
  const existing = await fetchActivityRow(supabase, id);
  if (!existing) {
    throw createError("ACTIVITY_NOT_FOUND", "Activity not found");
  }

  // 2. Worker existence if provided
  if (command.worker_id !== undefined) {
    const wExists = await workerExists(supabase, command.worker_id);
    if (!wExists) {
      throw createError("WORKER_NOT_FOUND", "Worker not found");
    }
  }

  // 3. Future datetime if provided
  if (command.start_datetime !== undefined) {
    assertFutureDate(command.start_datetime);
  }

  // 4. Build update payload (only provided keys)
  const updatePayload: Record<string, unknown> = {};
  if (command.name !== undefined) updatePayload.name = command.name;
  if (command.description !== undefined) updatePayload.description = command.description ?? null;
  if (command.cost !== undefined) updatePayload.cost = command.cost;
  if (command.participant_limit !== undefined) updatePayload.participant_limit = command.participant_limit;
  if (command.start_datetime !== undefined) updatePayload.start_datetime = command.start_datetime;
  if (command.worker_id !== undefined) updatePayload.worker_id = command.worker_id;

  // 5. Perform update if there is at least one field
  if (Object.keys(updatePayload).length) {
    const { error: updError } = await supabase.from("activities").update(updatePayload).eq("id", id);
    if (updError) {
      throw createError("INTERNAL_ERROR", updError.message);
    }
  }

  // 6. Tag replacement if provided (empty array means clear)
  if (command.tags !== undefined) {
    await replaceTags(supabase, id, command.tags);
  }

  // 7. notifications_sent = number of enrollments currently referencing this activity
  const { count: enrollCount, error: countError } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("activity_id", id);
  if (countError) {
    throw createError("INTERNAL_ERROR", countError.message);
  }
  const notifications_sent = enrollCount ?? 0;

  // 8. Final select & assemble response
  const finalDto = await selectActivityDto(supabase, id);
  return { ...finalDto, notifications_sent } satisfies AdminActivityUpdateResponseDTO;
}
