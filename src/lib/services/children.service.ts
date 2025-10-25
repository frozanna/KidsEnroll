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
import type { CreateChildCommand, CreateChildResponseDTO, ChildDTO } from "../../types";
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
