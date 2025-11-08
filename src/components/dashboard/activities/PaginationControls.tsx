import React, { useCallback } from "react";
import type { ActivitiesPagination } from "./types";
import { Button } from "../../ui/button";

interface PaginationControlsProps extends ActivitiesPagination {
  onPageChange: (page: number) => void;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({ page, limit, total, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const goPrev = useCallback(() => canPrev && onPageChange(page - 1), [canPrev, onPageChange, page]);
  const goNext = useCallback(() => canNext && onPageChange(page + 1), [canNext, onPageChange, page]);

  return (
    <nav aria-label="Paginacja" className="flex items-center justify-between py-3">
      <div className="text-sm text-muted-foreground">
        Strona {page} z {totalPages}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" disabled={!canPrev} onClick={goPrev} aria-disabled={!canPrev}>
          Poprzednia
        </Button>
        <Button variant="outline" disabled={!canNext} onClick={goNext} aria-disabled={!canNext}>
          Następna
        </Button>
      </div>
    </nav>
  );
};
