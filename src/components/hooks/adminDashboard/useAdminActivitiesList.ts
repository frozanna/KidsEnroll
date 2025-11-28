import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AdminActivitiesFilters,
  AdminActivitiesListState,
  AdminActivitiesPagination,
} from "../../admin/activities/types";
import { mapResponseToVm } from "../../admin/activities/types";
import { useToastFeedback } from "@/components/ui/useToastFeedback";

const DEFAULT_LIMIT = 10;

function buildQuery(filters: AdminActivitiesFilters, pagination: AdminActivitiesPagination): string {
  const params = new URLSearchParams();
  params.set("page", String(pagination.page));
  params.set("limit", String(pagination.limit));
  if (filters.search) params.set("search", filters.search);
  return `/api/admin/activities?${params.toString()}`;
}

export function useAdminActivitiesList() {
  const [state, setState] = useState<AdminActivitiesListState>(() => ({
    filters: {},
    pagination: { page: 1, limit: DEFAULT_LIMIT, total: 0 },
    data: [],
    loadState: "idle",
    deleteDialog: { open: false },
    deleting: false,
    deleteResult: null,
  }));

  const { error: pushError, success: pushSuccess } = useToastFeedback();
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastQueryKeyRef = useRef<string | null>(null);

  const performFetch = useCallback(
    async (filters: AdminActivitiesFilters, pagination: AdminActivitiesPagination) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState((s) => ({ ...s, loadState: "loading" }));
      try {
        const url = buildQuery(filters, pagination);
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          const message = errJson?.error?.message || `Błąd pobierania (${res.status})`;
          pushError(message);
          setState((s) => ({ ...s, loadState: "error", error: message }));
          return;
        }
        const json = await res.json();
        const vm = mapResponseToVm(json);
        setState((s) => {
          const p = json.pagination;
          const samePagination =
            s.pagination.page === p.page && s.pagination.limit === p.limit && s.pagination.total === p.total;
          return {
            ...s,
            pagination: samePagination ? s.pagination : p,
            data: vm,
            loadState: "success",
            error: undefined,
          };
        });
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const message = e instanceof Error ? e.message : "Nie udało się pobrać listy zajęć.";
        pushError(message);
        setState((s) => ({ ...s, loadState: "error", error: message }));
      }
    },
    [pushError]
  );

  useEffect(() => {
    const queryKey = JSON.stringify({
      f: state.filters,
      p: { page: state.pagination.page, limit: state.pagination.limit },
    });
    if (lastQueryKeyRef.current === queryKey) return;
    lastQueryKeyRef.current = queryKey;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      performFetch(state.filters, state.pagination);
    }, 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [state.filters, state.pagination, performFetch]);

  const setSearch = useCallback((search: string | undefined) => {
    setState((s) => ({
      ...s,
      filters: { ...s.filters, search: search || undefined },
      pagination: { ...s.pagination, page: 1 },
    }));
  }, []);

  const goToPage = useCallback((page: number) => {
    setState((s) => ({ ...s, pagination: { ...s.pagination, page } }));
  }, []);

  const openDeleteDialog = useCallback((activityId: number) => {
    setState((s) => ({ ...s, deleteDialog: { open: true, activityId }, deleteResult: null }));
  }, []);
  const closeDeleteDialog = useCallback(() => {
    setState((s) => ({ ...s, deleteDialog: { open: false }, deleting: false }));
  }, []);

  const removeLocally = useCallback((id: number) => {
    setState((s) => ({ ...s, data: s.data.filter((a) => a.id !== id) }));
  }, []);

  const confirmDelete = useCallback(async () => {
    setState((s) => ({ ...s, deleting: true }));
    const id = state.deleteDialog.activityId;
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/activities/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const message = errJson?.error?.message || `Błąd usuwania (${res.status})`;
        pushError(message);
        setState((s) => ({ ...s, deleting: false }));
        return;
      }
      const json = await res.json();
      removeLocally(id);
      pushSuccess(`Usunięto zajęcia (powiadomienia: ${json.notifications_sent})`);
      setState((s) => ({ ...s, deleting: false, deleteDialog: { open: false }, deleteResult: json }));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Nie udało się usunąć zajęć.";
      pushError(message);
      setState((s) => ({ ...s, deleting: false }));
    }
  }, [pushError, pushSuccess, removeLocally, state.deleteDialog.activityId]);

  const retry = useCallback(
    () => performFetch(state.filters, state.pagination),
    [performFetch, state.filters, state.pagination]
  );

  return {
    state,
    setSearch,
    goToPage,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
    retry,
  } as const;
}
