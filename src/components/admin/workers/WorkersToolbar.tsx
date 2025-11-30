import React from "react";
import { Button } from "@/components/ui/button";

interface WorkersToolbarProps {
  count?: number;
}

export const WorkersToolbar: React.FC<WorkersToolbarProps> = ({ count }) => {
  return (
    <div className="flex items-center justify-between rounded-md border bg-background p-4">
      <Button type="button" variant="default" asChild>
        <a href="/admin/workers/new" aria-label="Dodaj nowego opiekuna">
          Dodaj opiekuna
        </a>
      </Button>
      <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        <span>Opiekunowie</span>
        <span aria-label="Liczba opiekunów" className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium">
          {count ?? 0}
        </span>
      </div>
    </div>
  );
};
