import { useEffect, useMemo, useState } from "react";
import type { ParentListItemDTO, ParentsListResponseDTO, PaginationDTO } from "@/types";
import ParentsTableToolbar from "./ParentsTableToolbar";
import ParentsDataTable from "./ParentsDataTable";
import PaginationControls from "./PaginationControls";
import { useToast } from "@/components/ui/use-toast";

interface AdminParentsListToolbar {
  initialPage?: number;
  initialLimit?: number;
  initialSearch?: string;
}

interface FetchState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

export default function AdminParentsToolbar({
  initialPage = 1,
  initialLimit = 10,
  initialSearch = "",
}: AdminParentsListToolbar) {
  const { toast } = useToast();
  const [page, setPage] = useState<number>(Math.max(1, initialPage));
  const [limit, setLimit] = useState<number>(initialLimit);
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch);
  const [fetchState, setFetchState] = useState<FetchState<ParentsListResponseDTO>>({ loading: true });

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 500);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Fetch list
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (debouncedSearch) params.set("search", debouncedSearch);

    setFetchState({ loading: true });
    fetch(`/api/admin/parents?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          interface Err {
            error?: { message?: string };
          }
          const parsed: unknown = await res.json().catch(() => ({}));
          const data: Err = parsed as Err;
          const msg = data.error?.message ?? `Błąd ${res.status}`;
          throw new Error(msg);
        }
        return res.json() as Promise<ParentsListResponseDTO>;
      })
      .then((data) => {
        setFetchState({ data, loading: false });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setFetchState({ loading: false, error: err?.message || "Nieznany błąd" });
        toast({
          title: "Błąd pobierania",
          description: err?.message || "Nie udało się pobrać listy rodziców",
          variant: "destructive",
        });
      });

    return () => controller.abort();
  }, [page, limit, debouncedSearch, toast]);

  const parents: ParentListItemDTO[] = useMemo(() => fetchState.data?.parents ?? [], [fetchState]);
  const pagination: PaginationDTO | undefined = fetchState.data?.pagination;

  const onLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const onPageChange = (newPage: number) => {
    setPage(Math.max(1, newPage));
  };

  return (
    <div className="space-y-4">
      <ParentsTableToolbar
        search={searchInput}
        limit={limit}
        loading={fetchState.loading}
        onSearchChange={setSearchInput}
        onLimitChange={onLimitChange}
      />

      <ParentsDataTable data={parents} loading={fetchState.loading} error={fetchState.error} />

      {pagination && (
        <PaginationControls page={page} limit={limit} total={pagination.total} onPageChange={onPageChange} />
      )}
    </div>
  );
}
