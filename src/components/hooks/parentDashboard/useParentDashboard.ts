import { useCallback, useMemo, useState } from "react";
import { formatUtcToLocal, joinFullName } from "../../../lib/utils";
import { useToastFeedback } from "../../../components/useToastFeedback";
import type { DashboardState, EnrollmentViewModel } from "../../../components/dashboard/types";
import { useChildren } from "./useChildren";

// Parent dashboard composite hook
export function useParentDashboard() {
  const { children, loading: loadingChildren, error: errorChildren, refetch } = useChildren();
  const toast = useToastFeedback();
  const [expandedChildIds, setExpandedChildIds] = useState<number[]>([]);
  const [enrollmentsByChild, setEnrollmentsByChild] = useState<Record<number, EnrollmentViewModel[]>>({});
  const [loadingChildEnrollments, setLoadingChildEnrollments] = useState<number[]>([]);
  const [errorEnrollments, setErrorEnrollments] = useState<Record<number, string>>({});
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | undefined>();

  const toggleChildExpansion = useCallback((childId: number) => {
    setExpandedChildIds((prev) => (prev.includes(childId) ? prev.filter((id) => id !== childId) : [...prev, childId]));
  }, []);

  const isChildExpanded = useCallback((childId: number) => expandedChildIds.includes(childId), [expandedChildIds]);

  const isChildLoading = useCallback(
    (childId: number) => loadingChildEnrollments.includes(childId),
    [loadingChildEnrollments]
  );

  interface RawEnrollmentApiItem {
    child_id: number;
    activity_id: number;
    can_withdraw: boolean;
    enrolled_at: string;
    activity: {
      name: string;
      description?: string | null;
      start_datetime: string;
      cost: number;
      worker: { first_name: string; last_name: string };
    };
  }

  const fetchEnrollmentsLazy = useCallback(
    async (childId: number) => {
      if (enrollmentsByChild[childId]) return; // cached
      setLoadingChildEnrollments((prev) => [...prev, childId]);
      try {
        const res = await fetch(`/api/children/${childId}/enrollments`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Dziecko nie znalezione");
          if (res.status === 403) throw new Error("To dziecko nie należy do Twojego konta");
          throw new Error("Nie udało się pobrać zapisów");
        }
        const data = await res.json(); // ChildEnrollmentsListResponseDTO
        const mapped: EnrollmentViewModel[] = (data.enrollments || []).map((e: RawEnrollmentApiItem) => {
          const { date, time } = formatUtcToLocal(e.activity.start_datetime);
          return {
            childId: e.child_id,
            activityId: e.activity_id,
            activityName: e.activity.name,
            workerFullName: joinFullName(e.activity.worker.first_name, e.activity.worker.last_name),
            startLocalDate: date,
            startLocalTime: time,
            cost: e.activity.cost,
            canWithdraw: e.can_withdraw,
            description: e.activity.description ?? null,
          };
        });
        setEnrollmentsByChild((prev) => ({ ...prev, [childId]: mapped }));
        toast.info("Zapisy pobrane", `Dziecko #${childId}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Błąd";
        setErrorEnrollments((prev) => ({ ...prev, [childId]: msg }));
        toast.error(msg);
      } finally {
        setLoadingChildEnrollments((prev) => prev.filter((id) => id !== childId));
      }
    },
    [enrollmentsByChild, toast]
  );

  const withdraw = useCallback(
    async (childId: number, activityId: number) => {
      try {
        const res = await fetch(`/api/enrollments/${childId}/${activityId}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const errMsg = body?.error?.message || "Nie udało się wypisać z zajęć";
          throw new Error(errMsg);
        }
        // Optimistically remove enrollment from state
        setEnrollmentsByChild((prev) => {
          const current = prev[childId] || [];
          return {
            ...prev,
            [childId]: current.filter((e) => !(e.activityId === activityId && e.childId === childId)),
          };
        });
        toast.success("Wypisano z zajęć");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Błąd wypisywania");
      }
    },
    [toast]
  );

  const navigateAddChild = useCallback(() => {
    window.location.href = "/app/dzieci/dodaj"; // simple navigation; can replace with router if added later
  }, []);

  const generateReport = useCallback(async () => {
    setLoadingReport(true);
    setReportError(undefined);
    try {
      const res = await fetch("/api/reports/costs");
      if (!res.ok) throw new Error("Nie udało się wygenerować raportu");
      toast.success("Raport wygenerowany (stub)");
      // Future: parse and download or display.
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Nieznany błąd";
      setReportError(msg);
      toast.error(msg);
    } finally {
      setLoadingReport(false);
    }
  }, [toast]);

  const hasAnyEnrollments = useMemo(
    () => Object.values(enrollmentsByChild).some((arr) => arr.length > 0),
    [enrollmentsByChild]
  );

  const state: DashboardState = {
    children,
    expandedChildIds,
    enrollmentsByChild,
    loadingChildren,
    loadingChildEnrollments,
    errorChildren,
    errorEnrollments,
    loadingReport,
    reportError,
  };

  return {
    state,
    toggleChildExpansion,
    isChildExpanded,
    isChildLoading,
    fetchEnrollmentsLazy,
    navigateAddChild,
    generateReport,
    hasAnyEnrollments,
    refetchChildren: refetch,
    withdraw,
  };
}
