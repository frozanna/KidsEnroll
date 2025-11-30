import React, { useCallback } from "react";
import { useAdminWorkers } from "@/components/hooks/adminDashboard/useAdminWorkers";
import { WorkersToolbar } from "./WorkersToolbar";
import { WorkersDataTable } from "./AdminWorkersTable";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { Button } from "@/components/ui/button";

const EmptyState: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <p className="text-sm text-muted-foreground">{message || "Brak opiekunów."}</p>
  </div>
);

export const AdminWorkersPage: React.FC = () => {
  const { state, deleteWorker, fetchWorkers } = useAdminWorkers();

  const onDelete = useCallback(
    async (id: number) => {
      const ok = window.confirm("Czy na pewno chcesz usunąć tego opiekuna?");
      if (!ok) return;
      await deleteWorker(id);
    },
    [deleteWorker]
  );

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
    </section>
  );
};

export default AdminWorkersPage;
