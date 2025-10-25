/**
 * Data Transfer Objects (DTOs) and Command Models for KidsEnroll API
 *
 * This file contains all type definitions for API requests and responses,
 * derived from the database schema types.
 */

import type { Tables, TablesInsert, TablesUpdate, Enums } from "./db/database.types";

// =============================================================================
// Common/Utility Types
// =============================================================================

/**
 * Pagination metadata for list responses
 */
export interface PaginationDTO {
  page: number;
  limit: number;
  total: number;
}

/**
 * Standard error response structure
 */
export interface ErrorResponseDTO {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * User role enum from database
 */
export type UserRole = Enums<"user_role">;

// =============================================================================
// Authentication & Profile Domain
// =============================================================================

/**
 * Command model for user registration
 * POST /api/auth/register
 */
export interface RegisterDTO {
  email: string;
  password: string;
}

/**
 * Command model for user login
 * POST /api/auth/login
 */
export interface LoginDTO {
  email: string;
  password: string;
}

/**
 * User profile response DTO
 * Extends database profile with email from auth.users
 * GET /api/profile
 */
export interface ProfileDTO {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  created_at: string;
}

/**
 * Command model for creating user profile (onboarding)
 * POST /api/profile
 */
export interface CreateProfileDTO {
  first_name: string;
  last_name: string;
}

/**
 * Command model for updating user profile
 * PATCH /api/profile
 */
export type UpdateProfileDTO = Partial<CreateProfileDTO>;

/**
 * Onboarding status response
 * GET /api/auth/onboarding-status
 */
export interface OnboardingStatusDTO {
  needsOnboarding: boolean;
  hasChildren: boolean;
}

// =============================================================================
// Children Domain
// =============================================================================

/**
 * Child profile response DTO
 * Based on children table, omits parent_id for security
 * GET /api/children, GET /api/children/:id
 */
export interface ChildDTO {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string;
  description: string | null;
  created_at: string;
}

/**
 * Command model for creating a child profile
 * POST /api/children
 */
export interface CreateChildDTO {
  first_name: string;
  last_name: string;
  birth_date: string;
  description?: string | null;
}

/**
 * Command model for updating a child profile
 * PATCH /api/children/:id
 */
export type UpdateChildDTO = Partial<CreateChildDTO>;

/**
 * List of children response
 * GET /api/children
 */
export interface ChildrenListDTO {
  children: ChildDTO[];
}

// =============================================================================
// Workers Domain
// =============================================================================

/**
 * Worker (instructor/caregiver) response DTO
 * Based on workers table
 * GET /api/admin/workers, GET /api/admin/workers/:id
 */
export interface WorkerDTO {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
}

/**
 * Command model for creating a worker
 * POST /api/admin/workers
 */
export interface CreateWorkerDTO {
  first_name: string;
  last_name: string;
  email: string;
}

/**
 * Command model for updating a worker
 * PATCH /api/admin/workers/:id
 */
export type UpdateWorkerDTO = Partial<CreateWorkerDTO>;

/**
 * List of workers response with pagination
 * GET /api/admin/workers
 */
export interface WorkersListDTO {
  workers: WorkerDTO[];
  pagination: PaginationDTO;
}

/**
 * Worker deletion response
 * DELETE /api/admin/workers/:id
 */
export interface DeleteWorkerResponseDTO {
  message: string;
}

// =============================================================================
// Activities Domain
// =============================================================================

/**
 * Simplified worker info nested in activity responses
 */
export interface ActivityWorkerDTO {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

/**
 * Activity response DTO with computed fields and relations
 * GET /api/activities, GET /api/activities/:id
 */
export interface ActivityDTO {
  id: number;
  name: string;
  description: string | null;
  cost: number;
  participant_limit: number;
  available_spots: number; // Computed: participant_limit - enrolled_count
  start_datetime: string;
  worker: ActivityWorkerDTO;
  tags: string[];
  created_at: string;
}

/**
 * Command model for creating an activity
 * POST /api/admin/activities
 */
export interface CreateActivityDTO {
  name: string;
  description?: string | null;
  cost: number;
  participant_limit: number;
  start_datetime: string;
  worker_id: number;
  tags?: string[];
}

/**
 * Command model for updating an activity
 * PATCH /api/admin/activities/:id
 */
export type UpdateActivityDTO = Partial<CreateActivityDTO>;

/**
 * Query parameters for filtering activities
 * GET /api/activities
 */
export interface ActivityQueryParamsDTO {
  hasAvailableSpots?: boolean;
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  tags?: string[];
  page?: number;
  limit?: number;
}

/**
 * List of activities response with pagination
 * GET /api/activities
 */
export interface ActivitiesListDTO {
  activities: ActivityDTO[];
  pagination: PaginationDTO;
}

/**
 * Activity update response with notification count
 * PATCH /api/admin/activities/:id
 */
export interface UpdateActivityResponseDTO extends ActivityDTO {
  notifications_sent: number;
}

/**
 * Activity deletion response with notification count
 * DELETE /api/admin/activities/:id
 */
export interface DeleteActivityResponseDTO {
  message: string;
  notifications_sent: number;
}

// =============================================================================
// Enrollments Domain
// =============================================================================

/**
 * Command model for creating an enrollment
 * POST /api/enrollments
 */
export interface CreateEnrollmentDTO {
  child_id: number;
  activity_id: number;
}

/**
 * Simplified activity info for enrollment context
 */
export interface EnrollmentActivityDTO {
  id: number;
  name: string;
  description: string | null;
  cost: number;
  start_datetime: string;
  worker: {
    first_name: string;
    last_name: string;
  };
}

/**
 * Simplified child info for enrollment context
 */
export interface EnrollmentChildDTO {
  first_name: string;
  last_name: string;
}

/**
 * Enrollment response DTO with nested relations and computed fields
 * GET /api/children/:childId/enrollments
 */
export interface EnrollmentDTO {
  child_id: number;
  activity_id: number;
  enrolled_at: string;
  can_withdraw: boolean; // Computed: activity.start_datetime - now >= 24 hours
  activity: EnrollmentActivityDTO;
}

/**
 * Enrollment creation response with nested details
 * POST /api/enrollments
 */
export interface EnrollmentResponseDTO {
  child_id: number;
  activity_id: number;
  enrolled_at: string;
  activity: {
    name: string;
    start_datetime: string;
    cost: number;
  };
  child: EnrollmentChildDTO;
}

/**
 * List of enrollments response
 * GET /api/children/:childId/enrollments
 */
export interface EnrollmentsListDTO {
  enrollments: EnrollmentDTO[];
}

/**
 * Enrollment deletion response
 * DELETE /api/enrollments/:childId/:activityId
 */
export interface DeleteEnrollmentResponseDTO {
  message: string;
}

// =============================================================================
// Admin - Parent Management Domain
// =============================================================================

/**
 * Parent list item DTO with computed children count
 * GET /api/admin/parents
 */
export interface ParentListItemDTO {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  children_count: number; // Computed: COUNT of children
  created_at: string;
}

/**
 * Simplified child info for parent detail context
 */
export interface ParentChildDTO {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string;
  enrollments_count: number; // Computed: COUNT of enrollments
}

/**
 * Parent detail response with children
 * GET /api/admin/parents/:id
 */
export interface ParentDetailDTO {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  children: ParentChildDTO[];
}

/**
 * Query parameters for parent list filtering
 * GET /api/admin/parents
 */
export interface ParentQueryParamsDTO {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * List of parents response with pagination
 * GET /api/admin/parents
 */
export interface ParentsListDTO {
  parents: ParentListItemDTO[];
  pagination: PaginationDTO;
}

/**
 * Parent deletion response with cascade counts
 * DELETE /api/admin/parents/:id
 */
export interface DeleteParentResponseDTO {
  message: string;
  deleted_children: number;
  deleted_enrollments: number;
}

// =============================================================================
// Tags Domain
// =============================================================================

/**
 * List of available activity tags
 * GET /api/admin/tags
 */
export interface TagsListDTO {
  tags: string[];
}

/**
 * Predefined activity tags (closed list)
 */
export const ACTIVITY_TAGS = [
  "zajęcia kreatywne",
  "sport",
  "muzyka",
  "taniec",
  "nauka",
  "język obcy",
  "na świeżym powietrzu",
  "w pomieszczeniu",
  "indywidualne",
] as const;

export type ActivityTag = (typeof ACTIVITY_TAGS)[number];

// =============================================================================
// Reports Domain
// =============================================================================

/**
 * Query parameters for cost report generation
 * GET /api/reports/costs
 */
export interface CostReportQueryDTO {
  week?: string; // ISO date (Monday of the week), defaults to current week
}

/**
 * Cost report row structure (internal, for Excel generation)
 */
export interface CostReportRowDTO {
  child_first_name: string;
  child_last_name: string;
  activity_name: string;
  activity_date: string;
  activity_time: string;
  cost: number;
}

// =============================================================================
// Database Entity Exports (for service layer use)
// =============================================================================

/**
 * Re-export database table types for direct use in services
 */
export type ProfileEntity = Tables<"profiles">;
export type ChildEntity = Tables<"children">;
export type WorkerEntity = Tables<"workers">;
export type ActivityEntity = Tables<"activities">;
export type ActivityTagEntity = Tables<"activity_tags">;
export type EnrollmentEntity = Tables<"enrollments">;
export type FacilityEntity = Tables<"facilities">;

/**
 * Re-export database insert types for service layer
 */
export type ProfileInsert = TablesInsert<"profiles">;
export type ChildInsert = TablesInsert<"children">;
export type WorkerInsert = TablesInsert<"workers">;
export type ActivityInsert = TablesInsert<"activities">;
export type ActivityTagInsert = TablesInsert<"activity_tags">;
export type EnrollmentInsert = TablesInsert<"enrollments">;
export type FacilityInsert = TablesInsert<"facilities">;

/**
 * Re-export database update types for service layer
 */
export type ProfileUpdate = TablesUpdate<"profiles">;
export type ChildUpdate = TablesUpdate<"children">;
export type WorkerUpdate = TablesUpdate<"workers">;
export type ActivityUpdate = TablesUpdate<"activities">;
export type ActivityTagUpdate = TablesUpdate<"activity_tags">;
export type EnrollmentUpdate = TablesUpdate<"enrollments">;
export type FacilityUpdate = TablesUpdate<"facilities">;
