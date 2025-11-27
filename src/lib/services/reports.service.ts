// Service: Weekly Cost Report generation
// Implements data retrieval & transformation per plan in `.ai/endpoints/report-implementation-plan.md`
// Responsibilities:
//  - Fetch children for parent (id, names)
//  - Fetch enrollments joined with activities for week range
//  - Map rows to WeeklyCostReportRowDTO (splitting date/time from start_datetime)
//  - Sum cost and sort rows by date+time ascending
//  - Return WeeklyCostReportDTO (transport layer will convert to Excel)
//
// Error Handling:
//  - Supabase errors -> ApiError(INTERNAL_ERROR)
//  - Invalid datetime formats in DB -> ApiError(INTERNAL_ERROR)
//
// Edge Cases:
//  - No children -> empty rows, total=0
//  - Children without enrollments in week -> empty rows, total=0
//  - Activities spanning weekend -> included if within [weekStart, weekEnd]
//
import type { SupabaseClient } from "../../db/supabase.client";
import type { WeeklyCostReportDTO, WeeklyCostReportRowDTO } from "../../types";
import { createError } from "./errors";

/**
 * Generate weekly cost report for parent.
 * @param supabase - contextual Supabase client
 * @param parentId - authenticated parent profile id
 * @param weekStart - Monday YYYY-MM-DD
 * @param weekEnd - Sunday YYYY-MM-DD (same ISO format)
 * @returns WeeklyCostReportDTO
 */
export async function generateWeeklyCostReport(
  supabase: SupabaseClient,
  parentId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyCostReportDTO> {
  // Compute bound datetimes based on provided weekStart/weekEnd
  const startDate = new Date(weekStart + "T00:00:00Z");
  if (Number.isNaN(startDate.getTime())) {
    throw createError("INTERNAL_ERROR", "Invalid weekStart date format");
  }
  const endDate = new Date(weekEnd + "T23:59:59Z");
  if (Number.isNaN(endDate.getTime())) {
    throw createError("INTERNAL_ERROR", "Invalid weekEnd date format");
  }
  const weekStartIso = startDate.toISOString(); // inclusive
  const nextWeekStartIso = new Date(endDate.getTime() + 1000).toISOString(); // exclusive upper bound (end of day weekEnd)

  // ---- Fetch children ----
  const { data: childrenRows, error: childrenError } = await supabase
    .from("children")
    .select("id, first_name, last_name")
    .eq("parent_id", parentId);
  if (childrenError) throw createError("INTERNAL_ERROR", childrenError.message);
  const children = childrenRows ?? [];
  if (children.length === 0) {
    return emptyReport(weekStart, weekEnd);
  }

  const childIds = children.map((c) => c.id);

  // ---- Fetch enrollments + activities in date range ----
  const { data: enrollmentRows, error: enrollError } = await supabase
    .from("enrollments")
    .select("child_id, activity_id, activities(name, cost, start_datetime), children(first_name, last_name)")
    .in("child_id", childIds)
    .gte("activities.start_datetime", weekStartIso)
    .lt("activities.start_datetime", nextWeekStartIso);
  if (enrollError) throw createError("INTERNAL_ERROR", enrollError.message);

  interface RawEnrollmentRow {
    child_id: number;
    activity_id: number;
    activities: { name: string; cost: number; start_datetime: string } | null;
    children: { first_name: string; last_name: string } | null;
  }
  const typed: RawEnrollmentRow[] = (enrollmentRows as RawEnrollmentRow[]) ?? [];

  const rows: WeeklyCostReportRowDTO[] = [];
  for (const r of typed) {
    if (!r.children) {
      throw createError("INTERNAL_ERROR", "Missing nested child data in enrollment row");
    }
    if (!r.activities) {
      continue; // No activity in current week range
    }
    const { start_datetime } = r.activities;
    const ms = new Date(start_datetime).getTime();
    if (Number.isNaN(ms)) {
      throw createError("INTERNAL_ERROR", "Invalid activity start_datetime format");
    }
    // Extract date/time segments from ISO (YYYY-MM-DDTHH:mm:ss.sssZ)
    // Safe slicing relying on ISO shape; fallback construction if unexpected length
    const iso = new Date(ms).toISOString();
    const datePart = iso.substring(0, 10);
    const timePart = iso.substring(11, 16); // HH:mm

    rows.push({
      child_first_name: r.children.first_name,
      child_last_name: r.children.last_name,
      activity_name: r.activities.name,
      activity_date: datePart,
      activity_time: timePart,
      cost: r.activities.cost,
    });
  }

  if (rows.length === 0) {
    return emptyReport(weekStart, weekEnd);
  }

  // ---- Sort rows (date asc, then time asc, then child last name for stability) ----
  rows.sort((a, b) => {
    if (a.activity_date === b.activity_date) {
      if (a.activity_time === b.activity_time) {
        return a.child_last_name.localeCompare(b.child_last_name);
      }
      return a.activity_time.localeCompare(b.activity_time);
    }
    return a.activity_date.localeCompare(b.activity_date);
  });

  const total = rows.reduce((sum, r) => sum + r.cost, 0);

  return {
    rows,
    total,
    week_start: weekStart,
    week_end: weekEnd,
  } satisfies WeeklyCostReportDTO;
}

function emptyReport(weekStart: string, weekEnd: string): WeeklyCostReportDTO {
  return { rows: [], total: 0, week_start: weekStart, week_end: weekEnd };
}
