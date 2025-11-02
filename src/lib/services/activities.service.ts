// Service layer for listing Activities (GET /api/activities)
// Implements step 2 of the plan in /.ai/endpoints/acivities-implementation-plan.md
// Responsibilities:
//  - Fetch activities filtered by date range
//  - Aggregate worker subset, tags, and enrollment counts
//  - Compute available_spots per activity
//  - Apply tag intersection & hasAvailableSpots filter (MVP: in-memory)
//  - Paginate result after derived filters for accurate total count semantics
//  - Map Supabase errors to ApiError(INTERNAL_ERROR)
//
// Performance Considerations (MVP):
//  - Single bulk query for activities (date filters only)
//  - Separate IN queries for tags and enrollments
//  - In-memory filtering for intersection & available spots -> potential future optimization (server-side views / RPC)
//
// Edge Cases handled:
//  - Empty results (returns empty list with total=0)
//  - Activities without tags (tags: [])
//  - Activities with zero participant_limit (available_spots may be 0)
//  - Invalid start_datetime format -> INTERNAL_ERROR

import type { SupabaseClient } from "../../db/supabase.client";
import type { ActivitiesListResponseDTO, ActivityListItemDTO, ActivityWorkerDTO, ActivityDTO } from "../../types";
import { buildPagination } from "../pagination.utils";
import { createError } from "./errors";
import type { ActivitiesQueryFilters } from "../validation/activities.schema";

interface RawActivityRow {
  id: number;
  name: string;
  description: string | null;
  cost: number;
  participant_limit: number;
  start_datetime: string;
  created_at: string;
  worker_id: number;
  workers?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

/**
 * Lists activities with derived fields & pagination.
 * @param supabase - Supabase client bound to request context
 * @param filters - Validated query filters
 */
export async function listActivities(
  supabase: SupabaseClient,
  filters: ActivitiesQueryFilters
): Promise<ActivitiesListResponseDTO> {
  const { startDate, endDate } = filters;

  // ---- Build base query (date filters only) ----
  let query = supabase
    .from("activities")
    .select(
      "id, name, description, cost, participant_limit, start_datetime, created_at, worker_id, workers(id, first_name, last_name, email)"
    )
    .order("start_datetime", { ascending: true });

  // Apply date lower bound (inclusive)
  if (startDate) {
    // startDate at midnight UTC inclusive
    const startIso = startDate + "T00:00:00Z";
    query = query.gte("start_datetime", startIso);
  }
  // Apply date upper bound (inclusive end-of-day) -> approach: <= endDate + 23:59:59Z
  if (endDate) {
    const endMidnight = new Date(endDate + "T00:00:00Z");
    if (Number.isNaN(endMidnight.getTime())) {
      throw createError("INTERNAL_ERROR", "Invalid endDate composition");
    }
    // Add one day then subtract 1 second for inclusive range OR simpler: < next day midnight
    const nextDay = new Date(endMidnight.getTime() + 24 * 60 * 60 * 1000);
    query = query.lt("start_datetime", nextDay.toISOString());
  }

  const { data: activityRows, error: activitiesError } = await query;
  if (activitiesError) throw createError("INTERNAL_ERROR", activitiesError.message);
  const activities: RawActivityRow[] = (activityRows as RawActivityRow[]) ?? [];

  if (activities.length === 0) {
    return emptyResponse(filters.page, filters.limit);
  }

  // ---- Collect activity IDs ----
  const activityIds = activities.map((a) => a.id);

  // ---- Tags aggregation ----
  const { data: tagRows, error: tagsError } = await supabase
    .from("activity_tags")
    .select("activity_id, tag")
    .in("activity_id", activityIds);
  if (tagsError) throw createError("INTERNAL_ERROR", tagsError.message);
  const tagsMap = new Map<number, string[]>();
  for (const row of tagRows ?? []) {
    const arr = tagsMap.get(row.activity_id) || [];
    arr.push(row.tag);
    tagsMap.set(row.activity_id, arr);
  }
  // Ensure all activities have an entry
  for (const id of activityIds) if (!tagsMap.has(id)) tagsMap.set(id, []);

  // ---- Enrollment counts ----
  const { data: enrollmentRows, error: enrollError } = await supabase
    .from("enrollments")
    .select("activity_id")
    .in("activity_id", activityIds);
  if (enrollError) throw createError("INTERNAL_ERROR", enrollError.message);
  const enrollmentCountMap = new Map<number, number>();
  for (const r of enrollmentRows ?? []) {
    enrollmentCountMap.set(r.activity_id, (enrollmentCountMap.get(r.activity_id) || 0) + 1);
  }
  for (const id of activityIds) if (!enrollmentCountMap.has(id)) enrollmentCountMap.set(id, 0);

  // ---- Transform to DTO ----
  const list: ActivityListItemDTO[] = activities.map((row) => {
    const worker: ActivityWorkerDTO = {
      id: row.workers?.id ?? row.worker_id, // fallback safety
      first_name: row.workers?.first_name ?? "",
      last_name: row.workers?.last_name ?? "",
      email: row.workers?.email ?? "",
    };
    const currentEnrollments = enrollmentCountMap.get(row.id) ?? 0;
    const available_spots = Math.max(0, row.participant_limit - currentEnrollments);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      cost: row.cost,
      participant_limit: row.participant_limit,
      available_spots,
      start_datetime: row.start_datetime,
      created_at: row.created_at,
      worker,
      tags: tagsMap.get(row.id) ?? [],
    } satisfies ActivityListItemDTO;
  });

  // ---- In-memory filters (tags intersection & availability) ----
  let filtered = list;

  if (filters.tags && filters.tags.length > 0) {
    const requiredTags = filters.tags; // local alias avoids non-null assertion
    filtered = filtered.filter((act) => requiredTags.every((t) => act.tags.includes(t)));
  }
  if (filters.hasAvailableSpots === true) {
    filtered = filtered.filter((act) => act.available_spots > 0);
  }
  // hasAvailableSpots === false => ignore (acts like undefined per plan)

  // ---- Pagination (after filters for accurate total) ----
  const total = filtered.length;
  const startIndex = (filters.page - 1) * filters.limit;
  const endIndex = startIndex + filters.limit;
  const pageSlice = startIndex < total ? filtered.slice(startIndex, endIndex) : [];

  return {
    activities: pageSlice,
    pagination: buildPagination(filters.page, filters.limit, total),
  } satisfies ActivitiesListResponseDTO;
}

/**
 * Fetch a single activity by id with derived fields (available_spots, worker subset, tags).
 * Implements step 2 of the single-activity plan in /.ai/endpoints/activity-implementation-plan.md
 * @param supabase - Supabase client bound to request context
 * @param id - positive integer activity id
 * @throws ApiError (ACTIVITY_NOT_FOUND, INTERNAL_ERROR)
 */
export async function getActivityById(supabase: SupabaseClient, id: number): Promise<ActivityDTO> {
  // ---- Base activity + worker ----
  const { data: row, error: actError } = await supabase
    .from("activities")
    .select(
      "id, name, description, cost, participant_limit, start_datetime, created_at, worker_id, workers(id, first_name, last_name, email)"
    )
    .eq("id", id)
    .maybeSingle();
  if (actError) throw createError("INTERNAL_ERROR", actError.message);
  if (!row) throw createError("ACTIVITY_NOT_FOUND", "Activity not found");

  // ---- Tags ----
  const { data: tagRows, error: tagsError } = await supabase.from("activity_tags").select("tag").eq("activity_id", id);
  if (tagsError) throw createError("INTERNAL_ERROR", tagsError.message);
  const tags = (tagRows ?? []).map((t) => t.tag);

  // ---- Enrollment count (HEAD count) ----
  const { count: enrollmentCount, error: enrollError } = await supabase
    .from("enrollments")
    .select("child_id", { count: "exact", head: true })
    .eq("activity_id", id);
  if (enrollError) throw createError("INTERNAL_ERROR", enrollError.message);
  const currentEnrollments = enrollmentCount ?? 0;
  const available_spots = Math.max(0, row.participant_limit - currentEnrollments);

  // ---- Worker subset (defense-in-depth fallbacks) ----
  const worker: ActivityWorkerDTO = {
    id: row.workers?.id ?? row.worker_id,
    first_name: row.workers?.first_name ?? "",
    last_name: row.workers?.last_name ?? "",
    email: row.workers?.email ?? "",
  };

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    cost: row.cost,
    participant_limit: row.participant_limit,
    available_spots,
    start_datetime: row.start_datetime,
    created_at: row.created_at,
    worker,
    tags,
  } satisfies ActivityDTO;
}

function emptyResponse(page: number, limit: number): ActivitiesListResponseDTO {
  return {
    activities: [],
    pagination: buildPagination(page, limit, 0),
  };
}
