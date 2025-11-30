import React, { useCallback } from "react";
import { useActivitiesList } from "../../hooks/parentDashboard/useActivitiesList";
import { ActivitiesToolbar } from "./ActivitiesToolbar";
import { ActivitiesTable } from "./ActivitiesTable";
import { PaginationControls } from "./PaginationControls";
import { EmptyState } from "./EmptyState";
import { Button } from "../../ui/button";
import { LoadingSkeleton } from "../../ui/LoadingSkeleton";
import { EnrollDialog } from "./EnrollDialog";
import { useChildren } from "../../hooks/parentDashboard/useChildren"; // existing hook
import type { ActivityViewModel } from "./types";

export const ActivitiesListPage: React.FC = () => {
  const { state, setFilters, resetFilters, goToPage, openEnrollDialog, closeEnrollDialog, retry } = useActivitiesList();
  const { children, loading: childrenLoading } = useChildren();

  const handleEnrollClick = useCallback(
    (activity: ActivityViewModel) => {
      if (activity.isFull) return; // guard
      openEnrollDialog(activity.id);
    },
    [openEnrollDialog]
  );

  const selectedActivity = state.data.find((a) => a.id === state.enrollDialog.activityId) || null;

  const onConfirmEnroll = useCallback(() => {
    closeEnrollDialog();
    retry();
  }, [closeEnrollDialog, retry]);

  return (
    <section role="main" className="space-y-4">
      <ActivitiesToolbar filters={state.filters} onFiltersChange={setFilters} onReset={resetFilters} />
      <div className="rounded-md border p-2">
        {state.loadState === "loading" && <LoadingSkeleton />}
        {state.loadState === "error" && (
          <div className="space-y-4">
            <EmptyState message={state.error || "Wystąpił błąd."} />
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => window.location && window.location.reload()} className="mr-2">
                Odśwież stronę
              </Button>
              <Button variant="default" onClick={() => state.error && retry()}>
                Spróbuj ponownie
              </Button>
            </div>
          </div>
        )}
        {state.loadState === "success" && state.data.length === 0 && <EmptyState />}
        {state.loadState === "success" && state.data.length > 0 && (
          <>
            <ActivitiesTable activities={state.data} onEnrollClick={handleEnrollClick} />
            <PaginationControls
              page={state.pagination.page}
              limit={state.pagination.limit}
              total={state.pagination.total}
              onPageChange={goToPage}
            />
          </>
        )}
      </div>
      <EnrollDialog
        open={state.enrollDialog.open}
        activity={selectedActivity}
        childrenList={
          childrenLoading
            ? []
            : children.map((c) => ({
                id: c.id,
                first_name: c.fullName.split(" ")[0] || c.fullName,
                last_name: c.fullName.split(" ")[1] || "",
              }))
        }
        onClose={closeEnrollDialog}
        onSuccess={onConfirmEnroll}
      />
    </section>
  );
};
