/* eslint-disable react/prop-types */
import React, { memo } from "react";
import type { WorkerRowViewModel } from "./types";
import { Button } from "@/components/ui/button";

interface WorkersDataTableProps {
  rows: WorkerRowViewModel[];
  onDelete: (id: number) => void;
  isBusy?: boolean;
}

export const WorkersDataTable: React.FC<WorkersDataTableProps> = ({ rows, onDelete }) => {
  return (
    <div className="w-full overflow-hidden rounded-lg border" aria-label="Tabela opiekunów (admin)">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" aria-label="Lista opiekunów (admin)">
          <caption className="sr-only">Lista opiekunów</caption>
          <thead className="sticky top-0 z-10 bg-muted">
            <tr className="text-left align-middle">
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Imię
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Nazwisko
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                E-mail
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Dodano
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Akcje
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="h-24 px-4 text-center text-sm text-muted-foreground">
                  Brak opiekunów.
                </td>
              </tr>
            )}
            {rows.map((w) => (
              <WorkerRow key={w.id} worker={w} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface WorkerRowProps {
  worker: WorkerRowViewModel;
  onDelete: (id: number) => void;
}

const WorkerRow: React.FC<WorkerRowProps> = memo(({ worker, onDelete }) => {
  return (
    <tr className="border-t align-top transition-colors hover:bg-muted/40">
      <td className="px-4 py-2 text-sm" data-label="Imię">
        {worker.firstName}
      </td>
      <td className="px-4 py-2 text-sm" data-label="Nazwisko">
        {worker.lastName}
      </td>
      <td className="px-4 py-2 text-sm" data-label="E-mail">
        <a href={`mailto:${worker.email}`} className="text-primary underline-offset-2 hover:underline">
          {worker.email}
        </a>
      </td>
      <td className="px-4 py-2 text-sm" data-label="Dodano">
        {worker.createdAtLocal}
      </td>
      <td className="px-4 py-2" data-label="Akcje">
        <div className="flex gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            aria-label={`Edytuj dane pracownika ${worker.firstName} ${worker.lastName}`}
          >
            <a href={`/admin/workers/${worker.id}/edit`} className="inline-flex items-center">
              Edytuj
            </a>
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(worker.id)} aria-label="Usuń opiekuna">
            Usuń
          </Button>
        </div>
      </td>
    </tr>
  );
});
WorkerRow.displayName = "AdminWorkerRow";
