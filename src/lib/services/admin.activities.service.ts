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
  AdminActivityDeleteResponseDTO,
  ActivityDTO,
  ActivitiesListResponseDTO,
} from "../../types";
import { createError } from "./errors";
import { PGRST_ROW_NOT_FOUND } from "../postgres.utils";
import type { PostgrestErrorLike } from "../postgres.utils";

// Helper: fetch worker existence (id only) returning boolean.
async function workerExists(supabase: SupabaseClient, id: number): Promise<boolean> {
  const { data, error } = await supabase.from("workers").select("id").eq("id", id).maybeSingle();
  if (error && error.code !== PGRST_ROW_NOT_FOUND) {
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
  if (error && error.code !== PGRST_ROW_NOT_FOUND) {
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

// List all activities for admin (no pagination, MVP scope)
export async function listAllActivities(supabase: SupabaseClient): Promise<AdminActivityDTO[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("id, name, description, cost, participant_limit, start_datetime, worker_id, facility_id, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    throw createError("INTERNAL_ERROR", error.message);
  }
  return (data ?? []) as AdminActivityDTO[];
}

// Detailed admin listing with pagination & aggregates matching ActivityListItemDTO shape used on frontend.
// Includes nested worker, tags, enrollment-derived available_spots and total count.
export async function listActivitiesAdminDetailed(
  supabase: SupabaseClient,
  opts: { page: number; limit: number; search?: string }
): Promise<ActivitiesListResponseDTO> {
  const { page, limit, search } = opts;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("activities")
    .select(
      "id, name, description, cost, participant_limit, start_datetime, created_at, worker:workers(id, first_name, last_name, email), activity_tags(tag), enrollments(child_id)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    // Search by name or description (case-insensitive)
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    throw createError("INTERNAL_ERROR", error.message);
  }

  const activities: ActivityDTO[] = (data ?? []).map(
    (row: {
      id: number;
      name: string;
      description: string | null;
      cost: number;
      participant_limit: number;
      start_datetime: string;
      created_at: string;
      worker: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
      } | null;
      activity_tags: { tag: string }[];
      enrollments: { child_id: number }[];
    }) => {
      const enrollCount = Array.isArray(row.enrollments) ? row.enrollments.length : 0;
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        cost: row.cost,
        participant_limit: row.participant_limit,
        start_datetime: row.start_datetime,
        created_at: row.created_at,
        available_spots: Math.max(0, row.participant_limit - enrollCount),
        worker: {
          id: row.worker?.id ?? 0,
          first_name: row.worker?.first_name ?? "",
          last_name: row.worker?.last_name ?? "",
          email: row.worker?.email ?? "",
        },
        tags: (row.activity_tags ?? []).map((t: { tag: string }) => t.tag),
      } satisfies ActivityDTO;
    }
  );

  return {
    activities,
    pagination: { page, limit, total: count ?? activities.length },
  } satisfies ActivitiesListResponseDTO;
}

export async function createActivity(
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

export async function updateActivity(
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

// Delete an activity and return notifications_sent (# of enrollments referencing it before removal)
// Steps:
// 1. Ensure activity exists (ACTIVITY_NOT_FOUND if not)
// 2. Count enrollments (exact, head) for notifications_sent
// 3. Delete activity row (CASCADE removes enrollments + tags)
// 4. Return AdminActivityDeleteResponseDTO
export async function deleteActivity(supabase: SupabaseClient, id: number): Promise<AdminActivityDeleteResponseDTO> {
  // 1. Existence check
  const existing = await fetchActivityRow(supabase, id);
  if (!existing) {
    throw createError("ACTIVITY_NOT_FOUND", "Activity not found");
  }

  // 2. Count enrollments referencing this activity
  const { count: enrollCount, error: countError } = await supabase
    .from("enrollments")
    .select("child_id", { count: "exact" })
    .eq("activity_id", id);
  if (countError && (countError.message || countError.code)) {
    throw createError("INTERNAL_ERROR", countError.message);
  }

  const notifications_sent = enrollCount ?? 0;

  // 3. Delete activity (cascade will remove dependents)
  const { error: delError } = await supabase.from("activities").delete().eq("id", id);
  if (delError) {
    throw createError("INTERNAL_ERROR", delError.message);
  }

  // 4. Return DTO
  return {
    message: "Activity deleted successfully",
    notifications_sent,
  } satisfies AdminActivityDeleteResponseDTO;
}
