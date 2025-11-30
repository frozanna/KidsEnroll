import React, { useCallback, useMemo, useState } from "react";
import { useAdminWorkers } from "@/components/hooks/adminDashboard/useAdminWorkers";
import { WorkersToolbar } from "./AdminWorkersToolbar";
import { WorkersDataTable } from "./AdminWorkersTable";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { DeleteWorkerDialog } from "./DeleteWorkerDialog";

const EmptyState: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <p className="text-sm text-muted-foreground">{message || "Brak opiekunów."}</p>
  </div>
);

export const AdminWorkersPage: React.FC = () => {
  const { state, deleteWorker, fetchWorkers } = useAdminWorkers();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);

  const onDelete = useCallback((id: number) => {
    setSelectedWorkerId(id);
    setDeleteError(undefined);
    setDeleteDialogOpen(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setSelectedWorkerId(null);
    setSubmitting(false);
    setDeleteError(undefined);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (selectedWorkerId == null) return;
    try {
      setSubmitting(true);
      setDeleteError(undefined);
      await deleteWorker(selectedWorkerId);
      setDeleteDialogOpen(false);
      setSelectedWorkerId(null);
    } catch (e: unknown) {
      const message = e && typeof e === "object" && "message" in e ? (e as { message?: string }).message : undefined;
      setDeleteError(message || "Nie udało się usunąć opiekuna.");
    } finally {
      setSubmitting(false);
    }
  }, [deleteWorker, selectedWorkerId]);

  const deleteWorkerName = useMemo(() => {
    if (selectedWorkerId == null) return undefined;
    const w = state.workers.find((w) => w.id === selectedWorkerId);
    if (!w) return undefined;
    return `${w.firstName} ${w.lastName}`.trim();
  }, [selectedWorkerId, state.workers]);

  return (
    <section role="main" className="space-y-4">
      <WorkersToolbar count={state.workers.length} />
      <div className="rounded-md border p-2">
        {state.loadState === "loading" && <LoadingSkeleton />}
        {state.loadState === "error" && (
          <div className="space-y-4">
            <EmptyState message={state.error || "Wystąpił błąd."} />
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => window.location && window.location.reload()} className="mr-2">
                Odśwież stronę
              </Button>
              <Button variant="default" onClick={() => fetchWorkers()}>
                Spróbuj ponownie
              </Button>
            </div>
          </div>
        )}
        {state.loadState === "success" && state.workers.length === 0 && <EmptyState />}
        {state.loadState === "success" && state.workers.length > 0 && (
          <WorkersDataTable rows={state.workers} onDelete={onDelete} />
        )}
      </div>
      <DeleteWorkerDialog
        open={deleteDialogOpen}
        workerName={deleteWorkerName}
        onCancel={closeDeleteDialog}
        onConfirm={confirmDelete}
        submitting={submitting}
        error={deleteError}
      />
    </section>
  );
};

export default AdminWorkersPage;
