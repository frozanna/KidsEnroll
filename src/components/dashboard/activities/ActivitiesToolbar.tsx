import React, { useCallback } from "react";
import type { ActivitiesFilters } from "./types";
import { Button } from "../../ui/button";

interface ActivitiesToolbarProps {
  filters: ActivitiesFilters;
  onFiltersChange: (partial: Partial<ActivitiesFilters>) => void;
  onReset: () => void;
}

// NOTE: Switch import may need adjustment once shadcn switch component is added.
// For now, we can use a simple checkbox styled via Tailwind if Switch not present.
export const ActivitiesToolbar: React.FC<ActivitiesToolbarProps> = ({ filters, onFiltersChange, onReset }) => {
  const onDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      if (value === "") {
        onFiltersChange({ [name]: undefined });
        return;
      }
      onFiltersChange({ [name]: value });
    },
    [onFiltersChange]
  );
  const onTagsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const tags = raw
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 30);
      onFiltersChange({ tags });
    },
    [onFiltersChange]
  );
  const onAvailableChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ hasAvailableSpots: e.target.checked || undefined });
    },
    [onFiltersChange]
  );

  const dateRangeInvalid = filters.startDate && filters.endDate ? filters.endDate < filters.startDate : false;

  return (
    <div role="search" className="mb-4 flex flex-col gap-4 rounded-md border p-4 bg-background">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Data od</span>
          <input
            type="date"
            name="startDate"
            value={filters.startDate ?? ""}
            onChange={onDateChange}
            aria-invalid={dateRangeInvalid}
            className={`rounded border px-2 py-1 ${dateRangeInvalid ? "border-red-500" : ""}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Data do</span>
          <input
            type="date"
            name="endDate"
            value={filters.endDate ?? ""}
            onChange={onDateChange}
            aria-invalid={dateRangeInvalid}
            className={`rounded border px-2 py-1 ${dateRangeInvalid ? "border-red-500" : ""}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Tagi (oddziel przecinkami)</span>
          <input type="text" placeholder="sport, muzyka" onChange={onTagsChange} className="rounded border px-2 py-1" />
          {filters.tags && filters.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1" aria-label="Wybrane tagi">
              {filters.tags.map((t) => (
                <span key={t} className="rounded bg-neutral-200 px-2 py-0.5 text-xs dark:bg-neutral-700">
                  {t}
                </span>
              ))}
            </div>
          )}
        </label>
      </div>
      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.hasAvailableSpots === true}
            onChange={onAvailableChange}
            aria-checked={filters.hasAvailableSpots === true}
          />
          <span>Tylko z wolnymi miejscami</span>
        </label>
        <Button type="button" variant="outline" onClick={onReset} aria-label="Resetuj filtry">
          Resetuj
        </Button>
      </div>
      {dateRangeInvalid && (
        <p className="text-sm text-red-600" role="alert">
          Niepoprawny zakres dat: Data do jest wcześniejsza niż Data od.
        </p>
      )}
    </div>
  );
};
