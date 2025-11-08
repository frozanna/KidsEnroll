// REST API Endpoint: Profile (GET/PATCH /api/profile)
// Exposes authenticated parent profile and allows updating first & last name.
// Implements plan in `.ai/endpoints/profile-implementation-plan.md`.
// Transport responsibilities:
//  - Authenticate & authorize via Supabase (must be logged in & role parent)
//  - Delegate business logic to service layer (getCurrentProfile, updateCurrentProfile)
//  - Parse/validate PATCH body with Zod
//  - Map ApiError -> ErrorResponseDTO consistently
//  - Structured JSON logging for start/success/error phases
//  - Use 200 for successful GET & PATCH

import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../db/supabase.client";
import { jsonResponse, errorToDto } from "../../lib/api/helper";
import { normalizeUnknownError } from "../../lib/services/errors";
import { validateUpdateProfileBody, invalidJsonBodyError } from "../../lib/validation/profile.schema";
import { getCurrentProfile, updateCurrentProfile } from "../../lib/services/profile.service";
import type { ProfileDTO, UpdateProfileCommand } from "../../types";

export const prerender = false; // API route

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // Logging start
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ action: "GET_PROFILE", phase: "start", timestamp: new Date().toISOString() }));

  try {
    const profile: ProfileDTO = await getCurrentProfile(supabase);
    // Logging success
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "GET_PROFILE",
        phase: "success",
        profile_id: profile.id,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(profile, 200);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // Logging error
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "GET_PROFILE",
        phase: "error",
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};

export const PATCH: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;

  // Parse JSON body
  let raw: unknown;
  try {
    raw = await context.request.json();
  } catch {
    const apiErr = invalidJsonBodyError();
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // Validate
  let body: UpdateProfileCommand;
  try {
    body = validateUpdateProfileBody(raw);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err); // fromZodError already wrapped by validate helper
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }

  // Logging start
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      action: "UPDATE_PROFILE",
      phase: "start",
      first_name: body.first_name,
      last_name: body.last_name,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const updated: ProfileDTO = await updateCurrentProfile(supabase, body);
    // Logging success
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "UPDATE_PROFILE",
        phase: "success",
        profile_id: updated.id,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(updated, 200);
  } catch (err: unknown) {
    const apiErr = normalizeUnknownError(err);
    // Logging error
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: "UPDATE_PROFILE",
        phase: "error",
        error_code: apiErr.code,
        status: apiErr.status,
        timestamp: new Date().toISOString(),
      })
    );
    return jsonResponse(errorToDto(apiErr), apiErr.status);
  }
};
