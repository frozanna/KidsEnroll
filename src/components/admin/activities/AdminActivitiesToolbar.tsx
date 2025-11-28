import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

interface AdminActivitiesToolbarProps {
  search?: string;
  onSearchChange: (value: string | undefined) => void;
}

export const AdminActivitiesToolbar: React.FC<AdminActivitiesToolbarProps> = ({ search, onSearchChange }) => {
  const [value, setValue] = useState(search ?? "");

  const onInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValue(v);
      const trimmed = v.trim();
      onSearchChange(trimmed.length ? trimmed : undefined);
    },
    [onSearchChange]
  );

  const onReset = useCallback(() => {
    setValue("");
    onSearchChange(undefined);
  }, [onSearchChange]);

  return (
    <div role="search" className="flex flex-col gap-3 rounded-md border bg-background p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex flex-1 items-center gap-2 text-sm" htmlFor="admin-search-input">
          <span className="font-medium">Szukaj (nazwa)</span>
          <input
            id="admin-search-input"
            type="search"
            value={value}
            onChange={onInput}
            placeholder="np. Muzyka"
            maxLength={100}
            aria-label="Wyszukaj zajęcia po nazwie"
            className="flex-1 rounded border px-2 py-1"
          />
        </label>
        <Button type="button" variant="outline" onClick={onReset} aria-label="Wyczyść wyszukiwanie">
          Resetuj
        </Button>
        <Button type="button" variant="default" asChild>
          <a href="/admin/activities/new" aria-label="Dodaj nowe zajęcia">
            Dodaj zajęcia
          </a>
        </Button>
      </div>
      {search && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Wyniki dla: <strong>{search}</strong>
        </p>
      )}
    </div>
  );
};
