import React, { useCallback, useMemo } from "react";
import { AdminActivitiesToolbar } from "./AdminActivitiesToolbar";
import { AdminActivitiesTable } from "./AdminActivitiesTable";
import { PaginationControls } from "@/components/dashboard/activities/PaginationControls";
import { DeleteActivityDialog } from "./DeleteActivityDialog";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/dashboard/activities/EmptyState";
import { useAdminActivitiesList } from "../../hooks/adminDashboard/useAdminActivitiesList";
import { Button } from "../../ui/button";

export const AdminActivitiesPage: React.FC = () => {
  const { state, setSearch, goToPage, openDeleteDialog, closeDeleteDialog, confirmDelete, retry } =
    useAdminActivitiesList();

  const onDeleteClick = useCallback((id: number) => openDeleteDialog(id), [openDeleteDialog]);

  const deleteActivityName = useMemo(() => {
    if (!state.deleteDialog.activityId) return undefined;
    return state.data.find((a) => a.id === state.deleteDialog.activityId)?.name;
  }, [state.deleteDialog.activityId, state.data]);

  return (
    <section role="main" className="space-y-4">
      <AdminActivitiesToolbar search={state.filters.search} onSearchChange={setSearch} />
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
            <AdminActivitiesTable activities={state.data} onDeleteClick={onDeleteClick} />
            <PaginationControls
              page={state.pagination.page}
              limit={state.pagination.limit}
              total={state.pagination.total}
              onPageChange={goToPage}
            />
          </>
        )}
      </div>
      <DeleteActivityDialog
        open={state.deleteDialog.open}
        activityName={deleteActivityName}
        onCancel={closeDeleteDialog}
        onConfirm={confirmDelete}
        submitting={state.deleting}
      />
    </section>
  );
};

export default AdminActivitiesPage;
