import type { WorkerDTO, WorkersListResponseDTO } from "@/types";
import { formatUtcToLocal } from "@/lib/utils";

export type LoadState = "idle" | "loading" | "error" | "success";

export interface WorkerRowViewModel {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  createdAtLocal: string;
}

export interface CreateWorkerFormState {
  first_name: string;
  last_name: string;
  email: string;
  fieldErrors?: Record<string, string>;
}

export function mapWorkerToVm(dto: WorkerDTO): WorkerRowViewModel {
  const { date, time } = formatUtcToLocal(dto.created_at);
  return {
    id: dto.id,
    firstName: dto.first_name,
    lastName: dto.last_name,
    email: dto.email,
    createdAtLocal: [date, time].filter(Boolean).join(" "),
  };
}

export function mapResponseToVm(resp: WorkersListResponseDTO): WorkerRowViewModel[] {
  return (resp.workers || []).map(mapWorkerToVm);
}
