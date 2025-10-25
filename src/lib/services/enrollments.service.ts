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
import type { CreateEnrollmentCommand, CreateEnrollmentResponseDTO } from "../../types";
import { createError } from "./errors";

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
