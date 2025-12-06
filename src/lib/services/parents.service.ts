// Service layer for Admin Parents endpoints
// Functions:
//  - listParents: paginated list with children_count aggregate
//  - getParentById: parent detail with children + enrollments_count per child
//
// Assumptions:
//  - Email not stored in profiles table per current schema. We return empty string as placeholder.
//    Future migration should add email redundancy or RPC to auth.users.
//  - Search applies only to first_name / last_name (case-insensitive ILIKE).
//  - Null first_name/last_name normalized to empty string in DTO per ForceNonNullable contract.
//
// Error scenarios:
//  - Database errors -> INTERNAL_ERROR
//  - Parent not found (detail) -> PARENT_NOT_FOUND
//  - Validation of inputs handled in validation layer; service expects normalized params.
//
import type { SupabaseClient } from "../../db/supabase.client";
import type { ParentListItemDTO, ParentsListResponseDTO, ParentDetailDTO, ParentDetailChildDTO } from "../../types";
import { createError } from "./errors";
import { buildRange, buildPagination } from "../pagination.utils";
import type { ListParentsQuery } from "../validation/admin.parents.schema";

interface RawProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  role: string; // 'parent'
}

interface RawChildRow {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string;
  parent_id: string;
}

// ---- listParents ----
export async function listParents(supabase: SupabaseClient, query: ListParentsQuery): Promise<ParentsListResponseDTO> {
  const { page, limit, search } = query;
  const { offset, end } = buildRange(page, limit);

  // Base query: parents only
  let parentQuery = supabase
    .from("profiles")
    .select("id, first_name, last_name, created_at, role", { count: "exact" })
    .eq("role", "parent")
    .order("created_at", { ascending: false })
    .range(offset, end);

  if (search) {
    // Case-insensitive ILIKE on first_name OR last_name
    const pattern = `%${search}%`;
    parentQuery = parentQuery.or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`);
  }

  const { data: profiles, error: profilesError, count } = await parentQuery;
  if (profilesError) throw createError("INTERNAL_ERROR", profilesError.message);
  const total = count ?? 0;
  const rawProfiles: RawProfileRow[] = (profiles as RawProfileRow[]) ?? [];

  if (rawProfiles.length === 0) {
    return emptyParentsResponse(page, limit, total);
  }

  const parentIds = rawProfiles.map((p) => p.id);

  // Fetch emails from auth.users via secure RPC
  const { data: emailRows, error: emailError } = await supabase.rpc("get_auth_emails", { user_ids: parentIds });
  if (emailError) throw createError("INTERNAL_ERROR", emailError.message);
  const emailMap = new Map<string, string>();
  for (const r of (emailRows as unknown as { user_id: string; email: string | null }[]) ?? []) {
    emailMap.set(r.user_id, r.email ?? "");
  }

  // Children counts (GROUP BY parent_id) for listed parents
  const { data: childRows, error: childrenError } = await supabase
    .from("children")
    .select("parent_id")
    .in("parent_id", parentIds);
  if (childrenError) throw createError("INTERNAL_ERROR", childrenError.message);
  const childrenCountMap = new Map<string, number>();
  for (const row of childRows ?? []) {
    childrenCountMap.set(row.parent_id, (childrenCountMap.get(row.parent_id) || 0) + 1);
  }
  for (const id of parentIds) if (!childrenCountMap.has(id)) childrenCountMap.set(id, 0);

  const parents: ParentListItemDTO[] = rawProfiles.map((p) => ({
    id: p.id,
    first_name: p.first_name ?? "",
    last_name: p.last_name ?? "",
    created_at: p.created_at,
    email: emailMap.get(p.id) ?? "",
    children_count: childrenCountMap.get(p.id) || 0,
  }));

  return { parents, pagination: buildPagination(page, limit, total) } satisfies ParentsListResponseDTO;
}

// ---- getParentById ----
export async function getParentById(supabase: SupabaseClient, parentId: string): Promise<ParentDetailDTO> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, created_at, role")
    .eq("id", parentId)
    .maybeSingle();
  if (profileError) throw createError("INTERNAL_ERROR", profileError.message);
  if (!profile || profile.role !== "parent") {
    throw createError("PARENT_NOT_FOUND", "Parent not found");
  }

  // Fetch email for this parent via secure RPC (auth.users)
  let email = "";
  {
    const { data: emailRows, error: emailError } = await supabase.rpc("get_auth_emails", { user_ids: [parentId] });
    if (emailError) throw createError("INTERNAL_ERROR", emailError.message);
    const row = (emailRows as unknown as { user_id: string; email: string | null }[] | null)?.[0];
    email = row?.email ?? "";
  }

  // Children rows for this parent
  const { data: childRows, error: childrenError } = await supabase
    .from("children")
    .select("id, first_name, last_name, birth_date, parent_id")
    .eq("parent_id", parentId);
  if (childrenError) throw createError("INTERNAL_ERROR", childrenError.message);
  const rawChildren: RawChildRow[] = (childRows as RawChildRow[]) ?? [];

  if (rawChildren.length === 0) {
    return {
      id: profile.id,
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      created_at: profile.created_at,
      email,
      children: [],
    } satisfies ParentDetailDTO;
  }

  const childIds = rawChildren.map((c) => c.id);

  // Enrollment counts per child
  const { data: enrollmentRows, error: enrollError } = await supabase
    .from("enrollments")
    .select("child_id")
    .in("child_id", childIds);
  if (enrollError) throw createError("INTERNAL_ERROR", enrollError.message);
  const enrollCountMap = new Map<number, number>();
  for (const r of enrollmentRows ?? []) {
    enrollCountMap.set(r.child_id, (enrollCountMap.get(r.child_id) || 0) + 1);
  }
  for (const id of childIds) if (!enrollCountMap.has(id)) enrollCountMap.set(id, 0);

  const children: ParentDetailChildDTO[] = rawChildren.map((c) => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    birth_date: c.birth_date,
    enrollments_count: enrollCountMap.get(c.id) || 0,
  }));

  return {
    id: profile.id,
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    created_at: profile.created_at,
    email,
    children,
  } satisfies ParentDetailDTO;
}

function emptyParentsResponse(page: number, limit: number, total: number): ParentsListResponseDTO {
  return { parents: [], pagination: { page, limit, total } };
}
