// Service layer for profile retrieval & update operations.
// Implements business logic described in `.ai/endpoints/profile-implementation-plan.md`.
// Responsibilities:
//  - Fetch authenticated user's profile row & merge with auth email
//  - Enforce role parent for exposed operations
//  - Update first_name + last_name with atomic UPDATE ... RETURNING
//  - Translate Supabase errors into ApiError with appropriate codes
//  - Distinguish missing profile vs role mismatch

import type { SupabaseClient } from "../../db/supabase.client";
import type { ProfileDTO, UpdateProfileCommand } from "../../types";
import { createError } from "./errors";

interface AuthContext {
  user_id: string;
  email: string;
}

/**
 * Internal helper: fetch authenticated user (id & email) or throw AUTH_UNAUTHORIZED.
 */
async function requireAuth(supabase: SupabaseClient): Promise<AuthContext> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw createError("AUTH_UNAUTHORIZED", "Unauthorized", { status: 401 });
  }
  return { user_id: data.user.id, email: data.user.email ?? "" };
}

/**
 * Internal helper: fetch profile by id (including role & names). Throws PARENT_NOT_FOUND if missing.
 */
async function fetchProfileRow(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw createError("INTERNAL_ERROR", error.message);
  if (!data) throw createError("PARENT_NOT_FOUND", "Profile not found");
  return data;
}

/**
 * Get current authenticated parent profile combined with auth email.
 * @throws ApiError codes: AUTH_UNAUTHORIZED | PARENT_NOT_FOUND | AUTH_UNAUTHORIZED(403) | INTERNAL_ERROR
 */
export async function getCurrentProfile(supabase: SupabaseClient): Promise<ProfileDTO> {
  const auth = await requireAuth(supabase);
  const profile = await fetchProfileRow(supabase, auth.user_id);
  if (profile.role !== "parent") {
    throw createError("AUTH_UNAUTHORIZED", "Forbidden: parent role required", { status: 403 });
  }
  return {
    id: profile.id,
    email: auth.email,
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    role: profile.role,
    created_at: profile.created_at,
  } satisfies ProfileDTO;
}

/**
 * Update current authenticated parent's first & last name.
 * @param supabase - Supabase client (from context.locals)
 * @param command - Validated update command (two required fields)
 * @returns Updated ProfileDTO
 * @throws ApiError codes: AUTH_UNAUTHORIZED | PARENT_NOT_FOUND | AUTH_UNAUTHORIZED(403) | INTERNAL_ERROR
 */
export async function updateCurrentProfile(
  supabase: SupabaseClient,
  command: UpdateProfileCommand
): Promise<ProfileDTO> {
  const auth = await requireAuth(supabase);
  // Ensure profile exists & role parent BEFORE attempting update.
  const existing = await fetchProfileRow(supabase, auth.user_id);
  if (existing.role !== "parent") {
    throw createError("AUTH_UNAUTHORIZED", "Forbidden: parent role required", { status: 403 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ first_name: command.first_name, last_name: command.last_name })
    .eq("id", auth.user_id)
    .select("id, first_name, last_name, role, created_at")
    .maybeSingle();
  if (updateError) throw createError("INTERNAL_ERROR", updateError.message);
  if (!updated) throw createError("PARENT_NOT_FOUND", "Profile not found"); // Defensive fallback

  return {
    id: updated.id,
    email: auth.email,
    first_name: updated.first_name ?? "",
    last_name: updated.last_name ?? "",
    role: updated.role,
    created_at: updated.created_at,
  } satisfies ProfileDTO;
}
