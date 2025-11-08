// REST API Endpoint: Weekly Activity Cost Report (GET /api/reports/costs)
// Implements the plan in `.ai/endpoints/report-implementation-plan.md`.
// Transport-layer responsibilities:
//  - Authenticate parent (role check)
//  - Validate & normalize query (week Monday or default)
//  - Delegate data generation to service (generateWeeklyCostReport)
//  - Produce Excel workbook (single sheet WeeklyCosts) streamed as binary response
//  - Structured logging (start/success/error) JSON lines
//  - Consistent error mapping (ApiError -> ErrorResponseDTO) with proper status codes
//
// Response (200): Excel file with headers & Total row; Empty dataset => still file with Total=0
// Errors: JSON application/json per ErrorResponseDTO
//
// Security: Only parent role; data limited to own children.

import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client";
import { authenticateParent, jsonResponse, errorToDto } from "../../../lib/api/helper";
import { normalizeUnknownError, fromZodError } from "../../../lib/services/errors";
import { validateWeeklyReportQuery } from "../../../lib/validation/reports.schema";
import { generateWeeklyCostReport } from "../../../lib/services/reports.service";
import type { WeeklyCostReportDTO } from "../../../types";
import { Workbook } from "exceljs";

export const prerender = false; // API route

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // --- Authenticate parent ---
  let profile: { id: string; role: string };
  try {
    profile = await authenticateParent(supabase);
  } catch (err) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // --- Validate query params ---
  let week: { weekStart: string; weekEnd: string };
  try {
    week = validateWeeklyReportQuery(new URL(context.request.url).searchParams);
  } catch (err) {
    // Narrow potential ZodError
    if (err && typeof err === "object" && "issues" in err) {
      const apiErr = fromZodError(err as unknown as import("zod").ZodError);
      // Logging: error
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          action: "REPORT_WEEKLY_COSTS",
          phase: "error",
          parent_id: profile.id,
          error_code: apiErr.code,
          status: apiErr.status,
          timestamp: new Date().toISOString(),
        })
      );
      return jsonResponse(errorToDto(apiErr), apiErr.status);
    }
    const apiErr = normalizeUnknownError(err);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "REPORT_WEEKLY_COSTS",
        phase: "error",
        parent_id: profile.id,
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // Log start
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      action: "REPORT_WEEKLY_COSTS",
      phase: "start",
      parent_id: profile.id,
      week_start: week.weekStart,
      week_end: week.weekEnd,
      timestamp: new Date().toISOString(),
    })
  );

  // --- Generate DTO ---
  let dto: WeeklyCostReportDTO;
  try {
    dto = await generateWeeklyCostReport(supabase, profile.id, week.weekStart);
  } catch (err) {
    const apiErr = normalizeUnknownError(err);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "REPORT_WEEKLY_COSTS",
        phase: "error",
        parent_id: profile.id,
        week_start: week.weekStart,
        week_end: week.weekEnd,
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // --- Build Excel workbook ---
  try {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet("WeeklyCosts");
    sheet.columns = [
      { header: "Imię dziecka", key: "child_first_name" },
      { header: "Nazwisko dziecka", key: "child_last_name" },
      { header: "Nazwa aktywności", key: "activity_name" },
      { header: "Data aktywności", key: "activity_date" },
      { header: "Czas aktywności", key: "activity_time" },
      { header: "Koszt", key: "cost" },
    ];
    for (const row of dto.rows) {
      sheet.addRow(row);
    }
    // Total row: first cell 'Total', cost sum in Cost column
    const totalRow = sheet.addRow({ child_first_name: "Total", cost: dto.total });
    // Style (minimal): bold Total label
    totalRow.getCell(1).font = { bold: true };

    // Buffer serialization
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `activity-costs-week-${dto.week_start}.xlsx`;

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "REPORT_WEEKLY_COSTS",
        phase: "success",
        parent_id: profile.id,
        week_start: dto.week_start,
        week_end: dto.week_end,
        row_count: dto.rows.length,
        total: dto.total,
        filename,
        timestamp: new Date().toISOString(),
      })
    );

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const apiErr = normalizeUnknownError(err);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "REPORT_WEEKLY_COSTS",
        phase: "error",
        parent_id: profile.id,
        week_start: week.weekStart,
        week_end: week.weekEnd,
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
