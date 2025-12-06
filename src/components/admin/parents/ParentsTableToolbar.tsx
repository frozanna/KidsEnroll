import { Button } from "@/components/ui/button";

interface ToolbarProps {
  search: string;
  limit: number;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onLimitChange: (limit: number) => void;
}

export default function ParentsTableToolbar({ search, loading, onSearchChange }: ToolbarProps) {
  return (
    <div role="search" className="flex flex-col gap-3 rounded-md border bg-background p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex flex-1 items-center gap-2 text-sm" htmlFor="parents-search-input">
          <span className="font-medium">Szukaj (imię, nazwisko, email)</span>
          <input
            id="parents-search-input"
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="np. Kowalski"
            maxLength={100}
            aria-label="Wyszukaj rodziców"
            className="flex-1 rounded border px-2 py-1"
          />
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => onSearchChange("")}
          aria-label="Wyczyść wyszukiwanie"
        >
          Resetuj
        </Button>
      </div>
      {search && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Wyniki dla: <strong>{search}</strong>
        </p>
      )}
    </div>
  );
}
