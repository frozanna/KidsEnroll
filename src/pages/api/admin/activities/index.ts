import type { APIRoute } from "astro";
import type { SupabaseClient } from "@/db/supabase.client";
import { authenticateAdmin, jsonResponse, errorToDto } from "@/lib/api/helper";
import { normalizeUnknownError } from "@/lib/services/errors";
import { listAllActivities } from "@/lib/services/admin.activities.service";
import type { AdminActivityDTO, ActivitiesListResponseDTO, ActivityDTO, PaginationDTO } from "@/types";

// Admin activities listing with pagination & search.
// Returns shape compatible with parent ActivitiesListResponseDTO for reuse of mapping utilities.
// GET /api/admin/activities?page={page}&limit={limit}&search={search}
export const prerender = false;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function sanitizePage(raw: string | null): number {
  const n = Number(raw ?? "1");
  if (!Number.isInteger(n) || n < 1) return 1;
  return n;
}

function sanitizeLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function sanitizeSearch(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.length > 100 ? trimmed.slice(0, 100) : trimmed;
}

// Build ActivityDTO-like structure (admin view reuses parent shape for consistency)
async function enrichActivity(supabase: SupabaseClient, row: AdminActivityDTO): Promise<ActivityDTO> {
  const { data: tagRows } = await supabase.from("activity_tags").select("tag").eq("activity_id", row.id);
  const tags = (tagRows ?? []).map((t) => t.tag as string);
  const { data: worker } = await supabase
    .from("workers")
    .select("first_name, last_name, email")
    .eq("id", row.worker_id)
    .maybeSingle();
  const workerDto = {
    id: row.worker_id,
    first_name: worker?.first_name ?? "",
    last_name: worker?.last_name ?? "",
    email: worker?.email ?? "",
  };
  const { count } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("activity_id", row.id);
  const available_spots = typeof count === "number" ? Math.max(row.participant_limit - count, 0) : 0;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    cost: row.cost,
    participant_limit: row.participant_limit,
    start_datetime: row.start_datetime,
    created_at: row.created_at,
    worker: workerDto,
    tags,
    available_spots,
  } as ActivityDTO;
}

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // ---- Auth ----
  try {
    await authenticateAdmin(supabase);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  const url = context.url;
  const page = sanitizePage(url.searchParams.get("page"));
  const limit = sanitizeLimit(url.searchParams.get("limit"));
  const search = sanitizeSearch(url.searchParams.get("search"));

  try {
    const all = await listAllActivities(supabase);
    const filtered = search ? all.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())) : all;
    const total = filtered.length;
    const start = (page - 1) * limit;
    const slice = filtered.slice(start, start + limit);
    const activities: ActivityDTO[] = await Promise.all(slice.map((r) => enrichActivity(supabase, r)));

    const pagination: PaginationDTO = { page, limit, total };
    const body: ActivitiesListResponseDTO = { activities, pagination };
    return jsonResponse(body, 200);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
