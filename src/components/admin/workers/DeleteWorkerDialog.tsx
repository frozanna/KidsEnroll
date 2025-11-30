import React from "react";
import { Button } from "@/components/ui/button";

interface DeleteWorkerDialogProps {
  open: boolean;
  workerName?: string;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
  error?: string;
}

export const DeleteWorkerDialog: React.FC<DeleteWorkerDialogProps> = ({
  open,
  workerName,
  onConfirm,
  onCancel,
  submitting,
  error,
}) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      aria-label="Potwierdź usunięcie opiekuna"
    >
      <div className="w-full max-w-md rounded-md border bg-background p-6 shadow-lg">
        <h2 className="mb-2 text-lg font-semibold">Usuń opiekuna</h2>
        <p className="text-sm text-muted-foreground">
          Czy na pewno chcesz usunąć opiekuna <strong>{workerName || "(nieznany)"}</strong>?<br />
          Ta akcja jest nieodwracalna.
        </p>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={submitting} aria-label="Anuluj usuwanie">
            Anuluj
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={submitting}
            aria-busy={submitting}
            aria-label="Potwierdź usunięcie"
          >
            {submitting ? "Usuwanie..." : "Usuń"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeleteWorkerDialog;
