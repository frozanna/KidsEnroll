import React, { useCallback } from "react";
import type { ActivitiesPagination } from "./types";
import { Button } from "../../ui/button";
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";

interface PaginationControlsProps extends ActivitiesPagination {
  onPageChange: (page: number) => void;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({ page, limit, total, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const goPrev = useCallback(() => canPrev && onPageChange(page - 1), [canPrev, onPageChange, page]);
  const goNext = useCallback(() => canNext && onPageChange(page + 1), [canNext, onPageChange, page]);
  const goFirst = useCallback(() => onPageChange(1), [onPageChange]);
  const goLast = useCallback(() => onPageChange(totalPages), [onPageChange, totalPages]);

  return (
    <nav
      aria-label="Paginacja"
      className="flex items-center justify-between px-4 py-3"
      data-testid="pagination-controls"
    >
      <div className="flex w-full items-center gap-8 lg:w-fit">
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          Strona {page} z {totalPages}
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button variant="outline" className="hidden h-8 w-8 p-0 lg:flex" onClick={goFirst} disabled={!canPrev}>
            <span className="sr-only">Pierwsza strona</span>
            <ChevronsLeftIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="size-8"
            size="icon"
            onClick={goPrev}
            disabled={!canPrev}
            aria-disabled={!canPrev}
          >
            <span className="sr-only">Poprzednia strona</span>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="size-8"
            size="icon"
            onClick={goNext}
            disabled={!canNext}
            aria-disabled={!canNext}
          >
            <span className="sr-only">Następna strona</span>
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button variant="outline" className="hidden size-8 lg:flex" size="icon" onClick={goLast} disabled={!canNext}>
            <span className="sr-only">Ostatnia strona</span>
            <ChevronsRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
};
