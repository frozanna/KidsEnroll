// Shared DTO & Command Model type definitions for KidsEnroll API layer.
// These types are derived from underlying database entity row definitions in `src/db/database.types.ts`.
// Any schema evolution in the DB will propagate here via utility types (Pick/Omit/Partial).

import type { Database } from "./db/database.types";

// --- Base entity row aliases (direct linkage to DB schema) ---
export type ProfileEntity = Database["public"]["Tables"]["profiles"]["Row"];
export type WorkerEntity = Database["public"]["Tables"]["workers"]["Row"];
export type ActivityEntity = Database["public"]["Tables"]["activities"]["Row"];
export type ActivityTagEntity = Database["public"]["Tables"]["activity_tags"]["Row"];
export type ChildEntity = Database["public"]["Tables"]["children"]["Row"];
export type EnrollmentEntity = Database["public"]["Tables"]["enrollments"]["Row"];
export type FacilityEntity = Database["public"]["Tables"]["facilities"]["Row"];

// --- Utility Types ---
// Ensures specified keys are non-nullable (API guarantees) even if DB allows null.
type ForceNonNullable<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };

// Common pagination wrapper.
export interface PaginationDTO {
  page: number;
  limit: number;
  total: number;
}

// Standardized error response shape per API plan.
export interface ErrorResponseDTO {
  error: {
    code: string; // e.g. AUTH_UNAUTHORIZED, NOT_FOUND, VALIDATION_ERROR
    message: string; // Human-readable
    details?: Record<string, unknown>; // Field-level or contextual info
  };
}

// --- Auth ---
export interface AuthRegisterCommand {
  email: string;
  password: string;
}

export interface AuthLoginCommand {
  email: string;
  password: string;
}

export interface AuthTokenDTO {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: "bearer";
}

// Optional onboarding status endpoint (mentioned in plan):
export interface OnboardingStatusDTO {
  has_children: boolean;
}

// --- Profile (Parent) ---
// DB allows null first_name/last_name; API responses require string.
type ProfileBaseDTO = ForceNonNullable<
  Pick<ProfileEntity, "id" | "role" | "created_at" | "first_name" | "last_name">,
  "first_name" | "last_name"
>;

export interface ProfileDTO extends ProfileBaseDTO {
  email: string; // Supabase Auth email (not stored in profiles table directly)
}

export interface CreateProfileCommand {
  first_name: string;
  last_name: string;
}

export type UpdateProfileCommand = CreateProfileCommand; // Same shape (full replacement of modifiable fields)

// --- Children ---
// Public child listing excludes parent_id, includes created_at.
export type ChildDTO = Omit<ChildEntity, "parent_id">; // description may be null; preserve as-is.

export interface CreateChildCommand {
  first_name: string;
  last_name: string;
  birth_date: string; // ISO date
  description?: string | null;
}

export interface UpdateChildCommand {
  first_name?: string;
  last_name?: string;
  birth_date?: string; // ISO date
  description?: string | null;
}

// Response after creation includes parent_id for confirmation.
export type CreateChildResponseDTO = ChildEntity;

// --- Activities (Parent-facing) ---
// Worker subset used in activity exposure to parents.
export type ActivityWorkerDTO = Pick<WorkerEntity, "id" | "first_name" | "last_name" | "email">;

// Derived field `available_spots` calculated from participant_limit - current_enrollments.
export interface ActivityListItemDTO
  extends Pick<
    ActivityEntity,
    "id" | "name" | "description" | "cost" | "participant_limit" | "start_datetime" | "created_at"
  > {
  available_spots: number;
  worker: ActivityWorkerDTO;
  tags: string[]; // Aggregated tags
}

// Detailed single activity view currently same shape as list item in MVP.
export type ActivityDTO = ActivityListItemDTO;

export interface ActivitiesListResponseDTO {
  activities: ActivityListItemDTO[];
  pagination: PaginationDTO;
}

// --- Enrollments ---
// Nested activity subset for enrollment listing; worker names only.
export interface EnrollmentActivityNestedDTO
  extends Pick<ActivityEntity, "id" | "name" | "description" | "cost" | "start_datetime"> {
  worker: Pick<WorkerEntity, "first_name" | "last_name">;
}

export interface EnrollmentListItemDTO extends EnrollmentEntity {
  can_withdraw: boolean; // Derived based on start_datetime - now >= 24h
  activity: EnrollmentActivityNestedDTO;
}

export interface ChildEnrollmentsListResponseDTO {
  enrollments: EnrollmentListItemDTO[];
}

export interface CreateEnrollmentCommand {
  child_id: number;
  activity_id: number;
}

export interface CreateEnrollmentResponseDTO
  extends Pick<EnrollmentEntity, "child_id" | "activity_id" | "enrolled_at"> {
  activity: Pick<ActivityEntity, "name" | "start_datetime" | "cost">;
  child: Pick<ChildEntity, "first_name" | "last_name">;
}

export interface DeleteEnrollmentResponseDTO {
  message: string;
}

// --- Weekly Cost Report ---
export interface WeeklyCostReportRowDTO {
  child_first_name: string;
  child_last_name: string;
  activity_name: string;
  activity_date: string; // ISO date part
  activity_time: string; // HH:mm (derived from start_datetime timezone normalized)
  cost: number;
}

export interface WeeklyCostReportDTO {
  rows: WeeklyCostReportRowDTO[];
  total: number; // Sum of cost
  week_start: string; // ISO Monday
  week_end: string; // ISO Sunday
}

// --- Workers (Admin) ---
export type WorkerDTO = WorkerEntity;

export interface WorkersListResponseDTO {
  workers: WorkerDTO[];
  pagination: PaginationDTO;
}

export interface WorkerCreateCommand {
  first_name: string;
  last_name: string;
  email: string;
}

export type WorkerUpdateCommand = WorkerCreateCommand; // Full overwrite semantics

export interface WorkerDeleteResponseDTO {
  message: string;
}

// --- Activities (Admin) ---
export type AdminActivityDTO = ActivityEntity; // Full raw row (includes facility_id, worker_id)

export interface AdminActivityCreateCommand {
  name: string;
  description?: string | null;
  cost: number;
  participant_limit: number;
  start_datetime: string; // ISO future datetime
  worker_id: number;
  tags?: string[]; // Closed list validation at service layer
  // facility_id implicit (single facility in MVP) -> omitted
}

// Partial update; runtime must ensure at least one property present.
export type AdminActivityUpdateCommand = Partial<AdminActivityCreateCommand>;

export interface AdminActivityUpdateResponseDTO extends AdminActivityDTO {
  notifications_sent: number; // Count of mocked notification logs
}

export interface AdminActivityDeleteResponseDTO {
  message: string;
  notifications_sent: number;
}

// --- Parents (Admin) ---
export interface ParentListItemDTO
  extends ForceNonNullable<
    Pick<ProfileEntity, "id" | "first_name" | "last_name" | "created_at">,
    "first_name" | "last_name"
  > {
  email: string; // Auth email
  children_count: number; // Aggregated count
}

export interface ParentsListResponseDTO {
  parents: ParentListItemDTO[];
  pagination: PaginationDTO;
}

export interface ParentDetailChildDTO extends Pick<ChildEntity, "id" | "first_name" | "last_name" | "birth_date"> {
  enrollments_count: number; // Aggregated
}

export interface ParentDetailDTO
  extends ForceNonNullable<
    Pick<ProfileEntity, "id" | "first_name" | "last_name" | "created_at">,
    "first_name" | "last_name"
  > {
  email: string;
  children: ParentDetailChildDTO[];
}

export interface ParentDeleteResponseDTO {
  message: string;
  deleted_children: number;
  deleted_enrollments: number;
}

// --- Tags (Admin) ---
export interface TagsListResponseDTO {
  tags: string[]; // Predefined closed list
}

// --- Misc / Future extensibility ---
// Generic list response pattern (for future reuse if needed)
export interface ListResponseDTO<T> {
  items: T[];
  pagination: PaginationDTO;
}

// Domain-specific discriminated union examples could be added here later.
