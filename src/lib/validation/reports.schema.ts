// Zod-based validation for Weekly Cost Report query parameters (GET /api/reports/costs)
// Responsibilities:
//  - Parse optional `week` (YYYY-MM-DD) representing Monday of requested week
//  - Default to current week Monday (UTC) when absent
//  - Validate proper date format & existence (calendar-valid) and Monday weekday (ISO 1)
//  - Produce normalized object { weekStart: string; weekEnd: string } where weekEnd = weekStart + 6 days
//  - Throw ZodError on any validation failure (mapped upstream to ApiError VALIDATION_ERROR)
//
// Edge Cases:
//  - Invalid format (e.g. 2025-13-01) -> error
//  - Non-Monday date supplied -> error (message: "week must be Monday ISO date")
//  - Leap year dates validated via JS Date parsing
//  - Absent param -> compute current Monday in UTC (handles week roll-over)
//
// Notes:
//  - We treat all operations in UTC (MVP). Future enhancement may allow TZ override.
//  - Returned weekStart/weekEnd are YYYY-MM-DD strings (no time component)

import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface WeeklyReportQueryResult {
  weekStart: string; // Monday YYYY-MM-DD
  weekEnd: string; // Sunday YYYY-MM-DD (weekStart + 6d)
}

/** Compute current week Monday (UTC) */
function computeCurrentMondayUtc(): string {
  const now = new Date();
  // Convert to UTC components by constructing date from UTC values
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();
  const todayUtc = new Date(Date.UTC(utcYear, utcMonth, utcDate));
  // ISO weekday: Monday=1 ... Sunday=7
  const isoWeekday = todayUtc.getUTCDay() === 0 ? 7 : todayUtc.getUTCDay();
  const diffToMonday = isoWeekday - 1; // days since Monday
  const mondayMs = todayUtc.getTime() - diffToMonday * 24 * 60 * 60 * 1000;
  const monday = new Date(mondayMs);
  return formatDateUtc(monday);
}

function formatDateUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Validate input week string (must be Monday) */
function validateMonday(dateStr: string): void {
  if (!DATE_REGEX.test(dateStr)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["week"],
        message: "week must match YYYY-MM-DD",
      },
    ]);
  }
  const parsed = new Date(dateStr + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime())) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["week"],
        message: "week must be a valid calendar date",
      },
    ]);
  }
  const weekday = parsed.getUTCDay() === 0 ? 7 : parsed.getUTCDay();
  if (weekday !== 1) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["week"],
        message: "week must be Monday ISO date",
      },
    ]);
  }
}

/** Main validation/normalization entrypoint */
export function validateWeeklyReportQuery(params: URLSearchParams): WeeklyReportQueryResult {
  const rawWeek = params.get("week")?.trim();
  let monday: string;
  if (!rawWeek || rawWeek.length === 0) {
    monday = computeCurrentMondayUtc();
  } else {
    validateMonday(rawWeek);
    monday = rawWeek;
  }
  // Compute Sunday (monday + 6 days)
  const mondayDate = new Date(monday + "T00:00:00Z");
  const sundayDate = new Date(mondayDate.getTime() + 6 * 24 * 60 * 60 * 1000);
  const sunday = formatDateUtc(sundayDate);
  return { weekStart: monday, weekEnd: sunday };
}

export type { WeeklyReportQueryResult };
