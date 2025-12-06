import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function PaginationControls({ page, limit, total, onPageChange }: PaginationProps) {
  const maxPage = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const canPrev = page > 1;
  const canNext = page < maxPage;

  return (
    <nav className="flex items-center gap-2">
      <Button variant="outline" disabled={!canPrev} onClick={() => onPageChange(page - 1)}>
        Poprzednia
      </Button>
      <span className="text-sm">
        Strona {page} / {maxPage}
      </span>
      <Button variant="outline" disabled={!canNext} onClick={() => onPageChange(page + 1)}>
        Następna
      </Button>
    </nav>
  );
}
