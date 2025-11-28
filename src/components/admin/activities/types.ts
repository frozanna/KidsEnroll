import type { ActivitiesListResponseDTO, ActivityDTO, AdminActivityDeleteResponseDTO } from "@/types";

export interface AdminActivitiesFilters {
  search?: string;
}

export interface AdminActivitiesPagination {
  page: number;
  limit: number;
  total: number;
}

export type LoadState = "idle" | "loading" | "error" | "success";

export interface AdminActivityViewModel {
  id: number;
  name: string;
  description: string | null;
  costFormatted: string;
  participantLimit: number;
  availableSpots: number;
  isFull: boolean;
  startDateLocal: string;
  startTimeLocal: string;
  workerName: string;
  workerEmail: string;
  tags: string[];
  startISO: string;
}

export interface AdminActivitiesListState {
  filters: AdminActivitiesFilters;
  pagination: AdminActivitiesPagination;
  data: AdminActivityViewModel[];
  loadState: LoadState;
  error?: string;
  deleteDialog: { open: boolean; activityId?: number };
  deleting: boolean;
  deleteResult?: AdminActivityDeleteResponseDTO | null;
}

export interface ApiErrorShape {
  code: string;
  message: string;
}

export function mapDtoToVm(dto: ActivityDTO): AdminActivityViewModel {
  const date = new Date(dto.start_datetime);
  const startDateLocal = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/(\d{2})\.(\d{2})\.(\d{4})/, "$3-$2-$1");
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

export function mapResponseToVm(resp: ActivitiesListResponseDTO): AdminActivityViewModel[] {
  return resp.activities.map(mapDtoToVm);
}
