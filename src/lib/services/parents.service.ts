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
import type {
  ParentListItemDTO,
  ParentsListResponseDTO,
  ParentDetailDTO,
  ParentDetailChildDTO,
  ParentDeleteResponseDTO,
} from "../../types";
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
    email: "", // placeholder per assumption
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
      email: "", // placeholder
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
    email: "", // placeholder
    children,
  } satisfies ParentDetailDTO;
}

function emptyParentsResponse(page: number, limit: number, total: number): ParentsListResponseDTO {
  return { parents: [], pagination: { page, limit, total } };
}

// ---- deleteParent ----
// Deletes a parent profile and cascades related children & enrollments via DB foreign key ON DELETE CASCADE.
// Returns counts of children and enrollments that were associated prior to deletion.
// Error scenarios:
//  - Parent not found or role != 'parent' -> PARENT_NOT_FOUND
//  - Attempt to delete admin -> VALIDATION_ERROR
//  - Database errors -> INTERNAL_ERROR
export async function deleteParent(supabase: SupabaseClient, parentId: string): Promise<ParentDeleteResponseDTO> {
  // Fetch profile first to validate role & existence.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", parentId)
    .maybeSingle();
  if (profileError) throw createError("INTERNAL_ERROR", profileError.message);
  if (!profile) throw createError("PARENT_NOT_FOUND", "Parent not found");
  if (profile.role === "admin") {
    // Business rule: cannot delete admin accounts.
    throw createError("VALIDATION_ERROR", "Cannot delete admin account");
  }
  if (profile.role !== "parent") {
    // Only parents are deletable in this endpoint scope.
    throw createError("PARENT_NOT_FOUND", "Parent not found");
  }

  // Count children belonging to this parent.
  const { data: childRows, error: childrenError } = await supabase
    .from("children")
    .select("id")
    .eq("parent_id", parentId);
  if (childrenError) throw createError("INTERNAL_ERROR", childrenError.message);
  const childIds: number[] = (childRows ?? []).map((c) => c.id);
  const deleted_children = childIds.length;

  // Count enrollments for those children (will cascade when children deleted via profile deletion).
  let deleted_enrollments = 0;
  if (childIds.length > 0) {
    const { data: enrollmentRows, error: enrollError } = await supabase
      .from("enrollments")
      .select("child_id")
      .in("child_id", childIds);
    if (enrollError) throw createError("INTERNAL_ERROR", enrollError.message);
    deleted_enrollments = (enrollmentRows ?? []).length;
  }

  // Perform deletion of profile (children & enrollments cascade).
  // Use .select() to ensure we affected a row (Supabase returns deleted rows when select specified).
  const { data: deletedProfileRows, error: deleteError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", parentId)
    .select("id");
  if (deleteError) throw createError("INTERNAL_ERROR", deleteError.message);
  if (!deletedProfileRows || deletedProfileRows.length === 0) {
    // Unexpected: row disappeared between validation & delete (race condition) -> treat as not found.
    throw createError("PARENT_NOT_FOUND", "Parent not found");
  }

  return {
    message: "Parent account and all associated data deleted successfully",
    deleted_children,
    deleted_enrollments,
  } satisfies ParentDeleteResponseDTO;
}
