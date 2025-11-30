import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkerDTO } from "@/types";
import type { WorkerRowViewModel, LoadState } from "@/components/admin/workers/types";
import { mapResponseToVm, mapWorkerToVm } from "@/components/admin/workers/types";
import { useToastFeedback } from "@/components/ui/useToastFeedback";

export interface AdminWorkersState {
  workers: WorkerRowViewModel[];
  loadState: LoadState;
  error?: string;
  isSubmitting: boolean; // create
}

export function useAdminWorkers() {
  const [state, setState] = useState<AdminWorkersState>({ workers: [], loadState: "idle", isSubmitting: false });
  const { error: pushError, success: pushSuccess, info: pushInfo } = useToastFeedback();

  const abortRef = useRef<AbortController | null>(null);

  const fetchWorkers = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((s) => ({ ...s, loadState: "loading", error: undefined }));
    try {
      const res = await fetch("/api/admin/workers", { signal: controller.signal });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const message = errJson?.error?.message || `Błąd pobierania listy (${res.status})`;
        pushError(message);
        setState((s) => ({ ...s, loadState: "error", error: message }));
        return;
      }
      const json = await res.json();
      const vm = mapResponseToVm(json);
      setState((s) => ({ ...s, workers: vm, loadState: "success" }));
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const message = e instanceof Error ? e.message : "Nie udało się pobrać opiekunów.";
      pushError(message);
      setState((s) => ({ ...s, loadState: "error", error: message }));
    }
  }, [pushError]);

  useEffect(() => {
    fetchWorkers();
    return () => abortRef.current?.abort();
  }, [fetchWorkers]);

  const appendWorkerLocally = useCallback((dto: WorkerDTO) => {
    setState((s) => ({ ...s, workers: [mapWorkerToVm(dto), ...s.workers] }));
  }, []);

  const removeWorkerLocally = useCallback((id: number) => {
    setState((s) => ({ ...s, workers: s.workers.filter((w) => w.id !== id) }));
  }, []);

  const createWorker = useCallback(
    async (input: { first_name: string; last_name: string; email: string }) => {
      setState((s) => ({ ...s, isSubmitting: true }));
      try {
        const res = await fetch("/api/admin/workers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          const message = errJson?.error?.message || `Błąd dodawania (${res.status})`;
          pushError(message);
          setState((s) => ({ ...s, isSubmitting: false }));
          throw new Error(message);
        }
        const json: WorkerDTO = await res.json();
        appendWorkerLocally(json);
        pushSuccess("Opiekun dodany");
        setState((s) => ({ ...s, isSubmitting: false }));
        return json;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Nie udało się dodać opiekuna.";
        pushError(message);
        setState((s) => ({ ...s, isSubmitting: false }));
        throw e;
      }
    },
    [appendWorkerLocally, pushError, pushSuccess]
  );

  const deleteWorker = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`/api/admin/workers/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          const code = errJson?.error?.code;
          const message = errJson?.error?.message || `Błąd usuwania (${res.status})`;
          if (code === "WORKER_HAS_ACTIVITIES") {
            pushInfo("Nie można usunąć – opiekun ma przypisane zajęcia.");
          } else {
            pushError(message);
          }
          return false;
        }
        removeWorkerLocally(id);
        pushSuccess("Opiekun usunięty");
        return true;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Nie udało się usunąć opiekuna.";
        pushError(message);
        return false;
      }
    },
    [removeWorkerLocally, pushError, pushSuccess, pushInfo]
  );

  return {
    state,
    fetchWorkers,
    createWorker,
    deleteWorker,
  } as const;
}
