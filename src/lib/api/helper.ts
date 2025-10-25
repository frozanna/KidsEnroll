// Shared transport-layer helpers for API routes
// Centralizes JSON response formatting and ApiError -> ErrorResponseDTO mapping.
// Usage: import { jsonResponse, errorToDto } from "../../lib/api/response" (from /pages/api/*)

import type { ApiError } from "../services/errors";
import { createError } from "../services/errors";
import type { ErrorResponseDTO } from "../../types";
import type { SupabaseClient } from "../../db/supabase.client";

/**
 * Creates a JSON Response with provided data and status.
 * Ensures consistent content-type header.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Maps an ApiError into the transport ErrorResponseDTO shape.
 */
export function errorToDto(err: ApiError): ErrorResponseDTO {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  } satisfies ErrorResponseDTO;
}

/**
 * Authenticate the current user and ensure they have the parent role.
 * Returns the profile (id, role) when successful; throws ApiError on failure.
 * Centralizes repeated logic used across multiple API route handlers.
 */
export async function authenticateParent(supabase: SupabaseClient): Promise<{ id: string; role: string }> {
  // Authenticated user check
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw createError("AUTH_UNAUTHORIZED", "Unauthorized", { status: 401 });
  }

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) {
    throw createError("INTERNAL_ERROR", profileError.message);
  }
  if (!profile) {
    throw createError("AUTH_UNAUTHORIZED", "Profile not found", { status: 401 });
  }
  if (profile.role !== "parent") {
    throw createError("AUTH_UNAUTHORIZED", "Forbidden: parent role required", { status: 403 });
  }

  return profile;
}
