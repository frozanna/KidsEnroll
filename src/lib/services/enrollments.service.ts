// Enrollment service - encapsulates business logic for creating an enrollment.
// Follows the implementation plan in /.ai/enrollment-implementation-plan.md (steps 2-5 for service layer logic).
// Responsibilities:
//  - Ownership validation of child against parentId
//  - Activity existence & temporal validity (not started)
//  - Capacity check (participant_limit vs current count)
//  - Duplicate enrollment prevention
//  - Insert enrollment & shape response (CreateEnrollmentResponseDTO)
//  - Throw typed ApiError codes for each failure case

import type { SupabaseClient } from "../../db/supabase.client";
import type {
  CreateEnrollmentCommand,
  CreateEnrollmentResponseDTO,
  ChildEnrollmentsListResponseDTO,
  EnrollmentListItemDTO,
  DeleteEnrollmentResponseDTO,
} from "../../types";
import { createError } from "./errors";
import { getChildById } from "./children.service";

/**
 * Main create enrollment flow.
 * @param supabase - authenticated Supabase client from context.locals
 * @param parentId - id of the authenticated parent profile (profiles.id)
 * @param command - validated body (child_id, activity_id)
 * @throws ApiError on any business rule violation
 */
export async function createEnrollment(
  supabase: SupabaseClient,
  parentId: string,
  command: CreateEnrollmentCommand
): Promise<CreateEnrollmentResponseDTO> {
  // 1. Validate child ownership (two-step to distinguish 404 vs 403).
  const { data: ownedChild, error: ownedChildError } = await supabase
    .from("children")
    .select("id, first_name, last_name, parent_id")
    .eq("id", command.child_id)
    .eq("parent_id", parentId)
    .maybeSingle();
  if (ownedChildError) throw createError("INTERNAL_ERROR", ownedChildError.message);

  let child = ownedChild;

  if (!child) {
    const { data: anyChild, error: anyChildError } = await supabase
      .from("children")
      .select("id, first_name, last_name, parent_id")
      .eq("id", command.child_id)
      .maybeSingle();
    if (anyChildError) throw createError("INTERNAL_ERROR", anyChildError.message);
    if (!anyChild) throw createError("CHILD_NOT_FOUND", "Child not found");
    if (anyChild.parent_id !== parentId)
      throw createError("CHILD_NOT_OWNED", "Child does not belong to authenticated parent");
    child = anyChild;
  }

  // 2. Fetch activity.
  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select("id, name, cost, participant_limit, start_datetime")
    .eq("id", command.activity_id)
    .maybeSingle();
  if (activityError) throw createError("INTERNAL_ERROR", activityError.message);
  if (!activity) throw createError("ACTIVITY_NOT_FOUND", "Activity not found");

  // 3. Temporal check.
  const startsAt = new Date(activity.start_datetime).getTime();
  if (Number.isNaN(startsAt)) throw createError("INTERNAL_ERROR", "Invalid activity start datetime format");
  if (startsAt <= Date.now()) throw createError("ACTIVITY_STARTED", "Activity already started or past");

  // 4. Capacity check.
  const { count: enrollmentCount, error: countError } = await supabase
    .from("enrollments")
    .select("child_id", { count: "exact", head: true })
    .eq("activity_id", activity.id);
  if (countError) throw createError("INTERNAL_ERROR", countError.message);
  if (enrollmentCount != null && enrollmentCount >= activity.participant_limit)
    throw createError("ACTIVITY_FULL", "Activity has no available spots");

  // 5. Duplicate enrollment check.
  const { data: duplicate, error: dupError } = await supabase
    .from("enrollments")
    .select("child_id")
    .eq("child_id", command.child_id)
    .eq("activity_id", command.activity_id)
    .maybeSingle();
  if (dupError) throw createError("INTERNAL_ERROR", dupError.message);
  if (duplicate) throw createError("ENROLLMENT_DUPLICATE", "Child already enrolled in this activity");

  // 6. Insert enrollment.
  const { data: inserted, error: insertError } = await supabase
    .from("enrollments")
    .insert({ child_id: command.child_id, activity_id: command.activity_id })
    .select("child_id, activity_id, enrolled_at")
    .maybeSingle();
  if (insertError) throw createError("INTERNAL_ERROR", insertError.message);
  if (!inserted) throw createError("INTERNAL_ERROR", "Failed to insert enrollment");

  // 7. Shape response.
  return {
    child_id: inserted.child_id,
    activity_id: inserted.activity_id,
    enrolled_at: inserted.enrolled_at,
    activity: {
      name: activity.name,
      start_datetime: activity.start_datetime,
      cost: activity.cost,
    },
    child: {
      first_name: child.first_name,
      last_name: child.last_name,
    },
  };
}

// --- Listing Child Enrollments ---
// Implements the flow defined in /.ai/endpoints/child-enrollment-implementation-plan.md
// Responsibilities:
//  - Ownership validation via getChildById (distinguishes 404 vs 403)
//  - Single nested query to fetch enrollments and associated activity + worker names
//  - Compute can_withdraw based on 24h deadline prior to activity start
//  - Shape data strictly to EnrollmentListItemDTO eliminating extraneous nested fields
//  - Defensive checks for data integrity; throw INTERNAL_ERROR when unexpected nulls encountered
//  - Return ChildEnrollmentsListResponseDTO with possibly empty array

const WITHDRAW_DEADLINE_MS = 24 * 60 * 60 * 1000; // 24h window prior to start

/**
 * Lists all enrollments for a child owned by the authenticated parent.
 * @param supabase - Supabase client from context.locals
 * @param parentId - profiles.id of authenticated parent
 * @param childId - numeric child id (>0) validated upstream
 * @returns ChildEnrollmentsListResponseDTO (may contain empty enrollments array)
 * @throws ApiError codes: CHILD_NOT_FOUND | CHILD_NOT_OWNED | INTERNAL_ERROR
 */
export async function listChildEnrollments(
  supabase: SupabaseClient,
  parentId: string,
  childId: number
): Promise<ChildEnrollmentsListResponseDTO> {
  // Reuse existing ownership validation logic (throws typed ApiError on failure)
  await getChildById(supabase, parentId, childId);

  // Perform a single nested select to avoid N+1 queries.
  const { data: rows, error } = await supabase
    .from("enrollments")
    .select(
      "child_id, activity_id, enrolled_at, activities(id, name, description, cost, start_datetime, workers(first_name, last_name))"
    )
    .eq("child_id", childId);

  if (error) throw createError("INTERNAL_ERROR", error.message);

  interface RawEnrollmentRow {
    child_id: number;
    activity_id: number;
    enrolled_at: string;
    activities: {
      id: number;
      name: string;
      description: string | null;
      cost: number;
      start_datetime: string;
      workers: { first_name: string; last_name: string } | null;
    } | null;
  }

  const typedRows: RawEnrollmentRow[] = (rows as unknown as RawEnrollmentRow[]) ?? [];
  const enrollments: EnrollmentListItemDTO[] = typedRows.map((row) => {
    // Narrowing: row.activities should exist given referential integrity.
    const act = row.activities;
    if (!act || !act.workers)
      throw createError("INTERNAL_ERROR", "Missing nested activity or worker data for enrollment row");

    const startsAtMs = new Date(act.start_datetime).getTime();
    if (Number.isNaN(startsAtMs))
      throw createError("INTERNAL_ERROR", "Invalid activity start datetime format for enrollment row");
    const can_withdraw = startsAtMs - Date.now() >= WITHDRAW_DEADLINE_MS;

    const shaped: EnrollmentListItemDTO = {
      child_id: row.child_id,
      activity_id: row.activity_id,
      enrolled_at: row.enrolled_at,
      can_withdraw,
      activity: {
        id: act.id,
        name: act.name,
        description: act.description,
        cost: act.cost,
        start_datetime: act.start_datetime,
        worker: {
          first_name: act.workers.first_name,
          last_name: act.workers.last_name,
        },
      },
    };
    return shaped;
  });

  return { enrollments };
}

/**
 * Withdraw (delete) an enrollment for a child owned by the authenticated parent.
 * Implements logic per /.ai/endpoints/dl-enrollment-implementation-plan.md
 * Flow:
 *  1. Ownership validation (throws CHILD_NOT_FOUND | CHILD_NOT_OWNED)
 *  2. Fetch enrollment with nested activity start_datetime
 *  3. If missing -> ENROLLMENT_NOT_FOUND
 *  4. Validate 24h withdrawal window (>= 24h before start) else WITHDRAWAL_TOO_LATE
 *  5. Perform deletion; ensure exactly 1 row affected
 *  6. Return DeleteEnrollmentResponseDTO
 *
 * Edge cases handled:
 *  - Invalid datetime format -> INTERNAL_ERROR
 *  - Missing nested activity (data integrity) -> INTERNAL_ERROR
 */
export async function withdrawEnrollment(
  supabase: SupabaseClient,
  parentId: string,
  childId: number,
  activityId: number
): Promise<DeleteEnrollmentResponseDTO> {
  // Step 1: Ownership validation (reuses existing logic which throws typed errors)
  await getChildById(supabase, parentId, childId);

  // Step 2: Fetch enrollment + nested activity start time
  const { data: row, error: selectError } = await supabase
    .from("enrollments")
    .select("child_id, activity_id, activities(start_datetime)")
    .eq("child_id", childId)
    .eq("activity_id", activityId)
    .maybeSingle();

  if (selectError) throw createError("INTERNAL_ERROR", selectError.message);
  if (!row) throw createError("ENROLLMENT_NOT_FOUND", "Enrollment not found for child & activity pair");

  // Narrow raw structure
  interface RawEnrollmentWithActivity {
    child_id: number;
    activity_id: number;
    activities: { start_datetime: string } | null;
  }
  const enrollment = row as unknown as RawEnrollmentWithActivity;
  if (!enrollment.activities) throw createError("INTERNAL_ERROR", "Missing nested activity data for enrollment");

  const startsAtMs = new Date(enrollment.activities.start_datetime).getTime();
  if (Number.isNaN(startsAtMs)) throw createError("INTERNAL_ERROR", "Invalid activity start datetime format");

  const remainingMs = startsAtMs - Date.now();
  if (remainingMs < WITHDRAW_DEADLINE_MS)
    throw createError("WITHDRAWAL_TOO_LATE", "Cannot withdraw enrollment less than 24h before activity start", {
      details: { remainingMs },
    });

  // Step 5: Delete enrollment
  const { data: deletedRows, error: deleteError } = await supabase
    .from("enrollments")
    .delete()
    .eq("child_id", childId)
    .eq("activity_id", activityId)
    .select("child_id")
    .maybeSingle();

  if (deleteError) throw createError("INTERNAL_ERROR", deleteError.message);
  if (!deletedRows) throw createError("INTERNAL_ERROR", "Enrollment deletion failed despite prior existence check");

  // Step 6: Response
  return { message: "Child successfully withdrawn from activity" };
}
