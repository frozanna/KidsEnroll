import type { APIRoute } from "astro";
import type { SupabaseClient } from "@/db/supabase.client";
import { createError } from "@/lib/services/errors";
import { listAllActivities } from "@/lib/services/admin.activities.service";
import type { AdminActivityDTO } from "@/types";

export const prerender = false;

const PAGE_SIZE = 10;

function sanitizePage(value: string | null): number {
  const num = Number(value ?? "1");
  if (!Number.isInteger(num) || num < 1) return 1;
  return num;
}

function sanitizeSearch(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 100) return trimmed.slice(0, 100);
  return trimmed;
}

function formatRow(row: AdminActivityDTO, tags: string[], workerName: string, freeSlots: number | null) {
  const d = new Date(row.start_datetime);
  const startDate = d.toLocaleDateString();
  const startTime = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return {
    id: row.id,
    name: row.name,
    tags,
    workerName,
    startDate,
    startTime,
    participant_limit: row.participant_limit,
    freeSlots,
    cost: row.cost,
  };
}

export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const supabase = locals.supabase as SupabaseClient;
    const page = sanitizePage(url.searchParams.get("page"));
    const search = sanitizeSearch(url.searchParams.get("search"));

    const all = await listAllActivities(supabase);

    const filtered = search ? all.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())) : all;

    const start = (page - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    const enriched = await Promise.all(
      pageRows.map(async (row) => {
        const { data: tagRows } = await supabase.from("activity_tags").select("tag").eq("activity_id", row.id);
        const tags = (tagRows ?? []).map((t) => t.tag as string);
        const { data: worker } = await supabase
          .from("workers")
          .select("first_name, last_name")
          .eq("id", row.worker_id)
          .maybeSingle();
        const workerName = worker ? `${worker.first_name} ${worker.last_name}` : "—";
        const { count } = await supabase
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .eq("activity_id", row.id);
        const freeSlots = typeof count === "number" ? Math.max(row.participant_limit - count, 0) : null;
        return formatRow(row, tags, workerName, freeSlots);
      })
    );

    const body = {
      items: enriched,
      page,
      pageSize: PAGE_SIZE,
      total: filtered.length,
    };
    return new Response(JSON.stringify(body), { status: 200 });
  } catch (e) {
    const err = createError("INTERNAL_ERROR", e instanceof Error ? e.message : "Unknown error");
    return new Response(JSON.stringify({ error: err }), { status: 500 });
  }
};
