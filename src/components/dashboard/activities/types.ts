// Local types for Activities list view (frontend mapping layer)
// Some overlap with backend DTOs in src/types.ts; we create a focused set for UI concerns.

import type { ActivitiesListResponseDTO, ActivityDTO, CreateEnrollmentResponseDTO } from "../../../types";

export interface ActivityViewModel {
  id: number;
  name: string;
  description: string | null;
  costFormatted: string;
  participantLimit: number;
  availableSpots: number;
  isFull: boolean;
  startDateLocal: string; // YYYY-MM-DD in user locale
  startTimeLocal: string; // HH:mm in user locale
  workerName: string; // First + Last
  workerEmail: string;
  tags: string[];
  startISO: string; // original start_datetime
}

export interface ActivitiesFilters {
  hasAvailableSpots?: boolean;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  tags?: string[]; // normalized lowercase
}

export interface ActivitiesPagination {
  page: number;
  limit: number;
  total: number;
}

export type LoadState = "idle" | "loading" | "error" | "success";

export interface ActivitiesListState {
  filters: ActivitiesFilters;
  pagination: ActivitiesPagination;
  data: ActivityViewModel[];
  loadState: LoadState;
  error?: string;
  enrollDialog: { open: boolean; activityId?: number };
}

export interface ChildSummary {
  id: number;
  first_name: string;
  last_name: string;
}

// --- Enrollment specific local types (dialog scope) ---
// Request payload matches backend contract (POST /api/enrollments)
export interface EnrollmentRequestPayload {
  child_id: number;
  activity_id: number;
}

// Canonical error kinds mapped from API error codes / HTTP statuses
export type EnrollmentErrorKind =
  | "ACTIVITY_FULL"
  | "ALREADY_ENROLLED"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "UNKNOWN";

// Simplified API error adapter (subset of ErrorResponseDTO)
export interface ApiErrorShape {
  code: string;
  message: string;
}

// Local dialog state snapshot (not all fields exposed via props)
export interface EnrollDialogState {
  selectedChildId?: number;
  isSubmitting: boolean;
  error?: (ApiErrorShape & { kind: EnrollmentErrorKind }) | null;
  success?: CreateEnrollmentResponseDTO | null;
}

// Mapper from backend ActivityDTO to ActivityViewModel
export function mapDtoToVm(dto: ActivityDTO): ActivityViewModel {
  const date = new Date(dto.start_datetime);
  const startDateLocal = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/(\d{2})\.(\d{2})\.(\d{4})/, "$3-$2-$1"); // ensure YYYY-MM-DD (fallback transformation)

  const startTimeLocal = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  const costFormatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
  }).format(dto.cost);

  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? null,
    costFormatted,
    participantLimit: dto.participant_limit,
    availableSpots: dto.available_spots,
    isFull: dto.available_spots === 0,
    startDateLocal,
    startTimeLocal,
    workerName: `${dto.worker.first_name} ${dto.worker.last_name}`.trim(),
    workerEmail: dto.worker.email,
    tags: dto.tags,
    startISO: dto.start_datetime,
  };
}

export function mapResponseToVm(resp: ActivitiesListResponseDTO): ActivityViewModel[] {
  return resp.activities.map(mapDtoToVm);
}
