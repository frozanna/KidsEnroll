// Service layer for Admin Tags (static dictionary for MVP)
// Provides closed list of available activity tags for admin UI forms & filtering.
// Future evolution: migrate to DB table or configuration content collection.
// Keeping as isolated service for single responsibility & testability.

import type { TagsListResponseDTO } from "../../types";

// Closed list of tags (Polish labels per specification). Ensure uniqueness.
// NOTE: If editing, keep array of primitive strings only; ordering is preserved in response.
export const ADMIN_ACTIVITY_TAGS: readonly string[] = [
  "zajęcia kreatywne",
  "sport",
  "muzyka",
  "taniec",
  "nauka",
  "język obcy",
  "na świeżym powietrzu",
  "w pomieszczeniu",
  "indywidualne",
];

/**
 * Return list of available tags for admin activity management.
 * Static O(1) operation; no Supabase interaction required in MVP.
 */
export function listAdminActivityTags(): TagsListResponseDTO {
  // Defensive copy (immutability) although primitive strings; facilitates future extension.
  return { tags: [...ADMIN_ACTIVITY_TAGS] };
}
