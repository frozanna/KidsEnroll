import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivitiesFilters, ActivitiesListState, ActivitiesPagination } from "../../dashboard/activities/types";
import { mapResponseToVm } from "../../dashboard/activities/types";
import { useToastFeedback } from "../../ui/useToastFeedback";

const DEFAULT_LIMIT = 20;

function buildQuery(filters: ActivitiesFilters, pagination: ActivitiesPagination): string {
  const params = new URLSearchParams();
  params.set("page", String(pagination.page));
  params.set("limit", String(pagination.limit));
  if (filters.hasAvailableSpots) params.set("hasAvailableSpots", "true");
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.tags && filters.tags.length > 0) params.set("tags", filters.tags.join(","));
  return `/api/activities?${params.toString()}`;
}

export function useActivitiesList() {
  const [state, setState] = useState<ActivitiesListState>(() => ({
    filters: {},
    pagination: { page: 1, limit: DEFAULT_LIMIT, total: 0 },
    data: [],
    loadState: "idle",
    enrollDialog: { open: false },
  }));

  const { error: pushError } = useToastFeedback();
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Tracks last executed query key (filters + page + limit) to avoid duplicate fetches
  // in React StrictMode (double effects) and after pagination.total updates.
  const lastQueryKeyRef = useRef<string | null>(null);

  // Single stable fetch function; accepts snapshot of filters & pagination to avoid
  // recreating the callback on every state change (which was causing cascading effects).
  const performFetch = useCallback(
    async (filters: ActivitiesFilters, pagination: ActivitiesPagination) => {
      // Skip fetch if invalid date range
      if (filters.startDate && filters.endDate && filters.endDate < filters.startDate) {
        setState((s) => ({ ...s, loadState: "error", error: "Niepoprawny zakres dat" }));
        return;
      }
      // Cancel previous
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
            // avoid triggering effect loops by preserving identical pagination object reference
            pagination: samePagination ? s.pagination : p,
            data: vm,
            loadState: "success",
            error: undefined,
          };
        });
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return; // ignore aborted fetches
        const message = e instanceof Error ? e.message : "Nie udało się pobrać listy zajęć.";
        pushError(message);
        setState((s) => ({ ...s, loadState: "error", error: message }));
      }
    },
    [pushError]
  );

  // Debounce refetch on filters/pagination changes (except initial mount)
  useEffect(() => {
    // Build a stable query key excluding pagination.total (server-derived)
    const queryKey = JSON.stringify({
      f: state.filters,
      p: { page: state.pagination.page, limit: state.pagination.limit },
    });
    if (lastQueryKeyRef.current === queryKey) return; // Skip duplicate
    lastQueryKeyRef.current = queryKey;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      performFetch(state.filters, state.pagination);
    }, 150);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [state.filters, state.pagination, performFetch]);

  const setFilters = useCallback((partial: Partial<ActivitiesFilters>) => {
    setState((s) => ({
      ...s,
      filters: { ...s.filters, ...partial },
      pagination: { ...s.pagination, page: 1 }, // reset to first page on filter change
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setState((s) => ({ ...s, filters: {}, pagination: { ...s.pagination, page: 1 } }));
  }, []);

  const goToPage = useCallback((page: number) => {
    setState((s) => ({ ...s, pagination: { ...s.pagination, page } }));
  }, []);

  const openEnrollDialog = useCallback((activityId: number) => {
    setState((s) => ({ ...s, enrollDialog: { open: true, activityId } }));
  }, []);
  const closeEnrollDialog = useCallback(() => {
    setState((s) => ({ ...s, enrollDialog: { open: false } }));
  }, []);

  const retry = useCallback(
    () => performFetch(state.filters, state.pagination),
    [performFetch, state.filters, state.pagination]
  );

  return {
    state,
    setFilters,
    resetFilters,
    goToPage,
    openEnrollDialog,
    closeEnrollDialog,
    retry,
  } as const;
}
