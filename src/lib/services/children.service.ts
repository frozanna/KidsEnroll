// Service layer for Create Child operation.
// Encapsulates DB interaction & business rules (beyond schema validation) for POST /api/children.
// Follows implementation plan in /.ai/cr-child-implementation-plan.md (section 5, step 3 service responsibilities).
//
// Responsibilities:
//  - Insert child row with enforced parent ownership (parent_id sourced from auth profile)
//  - Return fully shaped record (CreateChildResponseDTO)
//  - Translate Supabase failures into typed ApiError instances
//  - Guarantee parent_id is not influenced by client-provided data
//
// Assumptions:
//  - birth_date future validation handled in Zod schema (additional server-side guard optional)
//  - RLS policies exist to ensure parent cannot query others' children (defense-in-depth with parent_id injection)

import type { SupabaseClient } from "../../db/supabase.client";
import type { CreateChildCommand, CreateChildResponseDTO, ChildDTO, UpdateChildCommand } from "../../types";
import { createError } from "./errors";

/**
 * Creates a child record owned by the authenticated parent.
 * @param supabase - Supabase client from context.locals
 * @param parentId - profiles.id of authenticated parent
 * @param command - validated payload (first_name, last_name, birth_date, description?)
 * @throws ApiError on DB insert/select errors
 */
export async function createChild(
  supabase: SupabaseClient,
  parentId: string,
  command: CreateChildCommand
): Promise<CreateChildResponseDTO> {
  // Perform single round-trip insert + select
  const { data: inserted, error: insertError } = await supabase
    .from("children")
    .insert({
      parent_id: parentId,
      first_name: command.first_name,
      last_name: command.last_name,
      birth_date: command.birth_date,
      description: command.description ?? null,
    })
    .select("id, first_name, last_name, birth_date, description, parent_id, created_at")
    .maybeSingle();

  if (insertError) throw createError("INTERNAL_ERROR", insertError.message);
  if (!inserted) throw createError("INTERNAL_ERROR", "Failed to insert child record");

  return inserted; // Shape matches CreateChildResponseDTO alias of ChildEntity
}

/**
 * Retrieves a single child owned by the authenticated parent.
 * Implements ownership distinction (404 vs 403) per implementation plan.
 * @param supabase - Supabase client from context.locals
 * @param parentId - profiles.id of authenticated parent
 * @param childId - numeric child id (>0) validated upstream
 * @returns ChildDTO (without parent_id)
 * @throws ApiError with codes: CHILD_NOT_FOUND | CHILD_NOT_OWNED | INTERNAL_ERROR
 */
export async function getChildById(supabase: SupabaseClient, parentId: string, childId: number): Promise<ChildDTO> {
  // First attempt: fetch owned record (select only exposed columns)
  const { data: owned, error: ownedError } = await supabase
    .from("children")
    .select("id, first_name, last_name, birth_date, description, created_at")
    .eq("id", childId)
    .eq("parent_id", parentId)
    .maybeSingle();

  if (ownedError) throw createError("INTERNAL_ERROR", ownedError.message);
  if (owned) return owned; // Shape matches ChildDTO (parent_id omitted)

  // Distinguish not found vs owned by someone else (second lightweight query)
  const { data: anyChild, error: anyError } = await supabase
    .from("children")
    .select("id, parent_id")
    .eq("id", childId)
    .maybeSingle();

  if (anyError) throw createError("INTERNAL_ERROR", anyError.message);
  if (!anyChild) throw createError("CHILD_NOT_FOUND", "Child not found");
  // Record exists but parent mismatch -> ownership violation
  throw createError("CHILD_NOT_OWNED", "Child does not belong to current parent");
}

/**
 * Lists all children owned by the authenticated parent.
 * Extracted from transport layer (GET /api/children) for consistency & reuse.
 * @param supabase - Supabase client from context.locals
 * @param parentId - profiles.id of authenticated parent
 * @returns Array of ChildDTO (may be empty)
 * @throws ApiError with code INTERNAL_ERROR when underlying query fails
 */
export async function listChildren(supabase: SupabaseClient, parentId: string): Promise<ChildDTO[]> {
  const { data: rows, error } = await supabase
    .from("children")
    .select("id, first_name, last_name, birth_date, description, created_at")
    .eq("parent_id", parentId);

  if (error) throw createError("INTERNAL_ERROR", error.message);
  return rows ?? [];
}

/**
 * Updates a child record owned by the authenticated parent.
 * Implementation per /.ai/endpoints/up-child-implementation-plan.md (section 9 step 3 & section 10 contract).
 * Performs single UPDATE ... RETURNING round-trip; falls back to ownership distinction query when no row updated.
 * @param supabase - Supabase client
 * @param parentId - profiles.id of authenticated parent
 * @param childId - numeric child id (>0) validated upstream
 * @param command - partial update fields (already Zod-validated; at least one present)
 * @returns Full child record (CreateChildResponseDTO shape includes parent_id)
 * @throws ApiError codes: CHILD_NOT_FOUND | CHILD_NOT_OWNED | VALIDATION_ERROR | INTERNAL_ERROR
 */
export async function updateChild(
  supabase: SupabaseClient,
  parentId: string,
  childId: number,
  command: UpdateChildCommand
): Promise<CreateChildResponseDTO> {
  // Build update object (whitelist fields). Skip undefined to avoid overwriting.
  const updateFields: Record<string, unknown> = {};
  if (command.first_name !== undefined) updateFields.first_name = command.first_name;
  if (command.last_name !== undefined) updateFields.last_name = command.last_name;
  if (command.birth_date !== undefined) updateFields.birth_date = command.birth_date;
  if (command.description !== undefined) updateFields.description = command.description ?? null;

  if (Object.keys(updateFields).length === 0) {
    // Defensive guard (schema should already prevent this scenario)
    throw createError("VALIDATION_ERROR", "No fields to update");
  }

  const { data: updated, error: updateError } = await supabase
    .from("children")
    .update(updateFields)
    .eq("id", childId)
    .eq("parent_id", parentId)
    .select("id, first_name, last_name, birth_date, description, parent_id, created_at")
    .maybeSingle();

  if (updateError) throw createError("INTERNAL_ERROR", updateError.message);
  if (updated) return updated;

  // Distinguish: not found vs not owned (lightweight query)
  const { data: anyChild, error: anyError } = await supabase
    .from("children")
    .select("id, parent_id")
    .eq("id", childId)
    .maybeSingle();

  if (anyError) throw createError("INTERNAL_ERROR", anyError.message);
  if (!anyChild) throw createError("CHILD_NOT_FOUND", "Child not found");
  if (anyChild.parent_id !== parentId) throw createError("CHILD_NOT_OWNED", "Child does not belong to current parent");

  // Fallback unexpected state (row exists & owned but update returned no data)
  throw createError("INTERNAL_ERROR", "Failed to update child record");
}
