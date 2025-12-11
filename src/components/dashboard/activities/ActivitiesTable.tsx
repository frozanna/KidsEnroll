/* eslint-disable react/prop-types */
import React, { memo } from "react";
import type { ActivityViewModel } from "./types";
import { Button } from "../../ui/button";

interface ActivitiesTableProps {
  activities: ActivityViewModel[];
  onEnrollClick: (activity: ActivityViewModel) => void;
}

export const ActivitiesTable: React.FC<ActivitiesTableProps> = ({ activities, onEnrollClick }) => {
  return (
    <div className="w-full overflow-hidden rounded-lg border" aria-label="Sekcja tabeli z listą zajęć">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" aria-label="Lista zajęć">
          <caption className="sr-only">Lista zajęć dostępnych do zapisania dziecka</caption>
          <thead className="sticky top-0 z-10 bg-muted">
            <tr className="text-left align-middle">
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Nazwa
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Opis
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Opiekun
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Data
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Godzina
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Koszt
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Wolne miejsca
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Tagi
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Akcja
              </th>
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 && (
              <tr>
                <td colSpan={9} className="h-24 px-4 text-center text-sm text-muted-foreground">
                  Brak dostępnych zajęć.
                </td>
              </tr>
            )}
            {activities.map((a) => (
              <ActivityRow key={a.id} activity={a} onEnrollClick={onEnrollClick} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 px-4 py-3 text-sm text-muted-foreground">
        {/* Pagination summary can be plugged here if needed */}
      </div>
    </div>
  );
};

interface ActivityRowProps {
  activity: ActivityViewModel;
  onEnrollClick: (activity: ActivityViewModel) => void;
}

const ActivityRow: React.FC<ActivityRowProps> = memo(({ activity, onEnrollClick }) => {
  const handleEnrollClick = () => {
    if (activity.isFull) return; // Guard: avoid firing for disabled state
    onEnrollClick(activity);
  };

  return (
    <tr className="border-t transition-colors hover:bg-muted/40 align-top" data-testid={`activity-row-${activity.id}`}>
      <td className="px-4 py-2 font-medium" data-label="Nazwa">
        {activity.name}
      </td>
      <td className="px-4 py-2 max-w-[260px] text-xs text-muted-foreground" data-label="Opis">
        <span className="line-clamp-3" title={activity.description ?? undefined}>
          {activity.description || "—"}
        </span>
      </td>
      <td className="px-4 py-2 text-sm" data-label="Opiekun">
        <div className="flex flex-col" title={activity.workerEmail}>
          <span>{activity.workerName}</span>
          <span className="text-xs text-muted-foreground">{activity.workerEmail}</span>
        </div>
      </td>
      <td className="px-4 py-2 text-sm" data-label="Data">
        {activity.startDateLocal}
      </td>
      <td className="px-4 py-2 text-sm" data-label="Godzina">
        {activity.startTimeLocal}
      </td>
      <td className="px-4 py-2 text-sm" data-label="Koszt">
        {activity.costFormatted}
      </td>
      <td className="px-4 py-2 text-sm" data-label="Wolne miejsca">
        <span aria-label={`Wolne miejsca: ${activity.availableSpots} z ${activity.participantLimit}`}>
          {activity.availableSpots}/{activity.participantLimit}
        </span>
      </td>
      <td className="px-4 py-2 text-xs" data-label="Tagi">
        <div className="flex flex-wrap gap-1.5" aria-label="Tagi">
          {activity.tags.length === 0 && <span className="text-muted-foreground">—</span>}
          {activity.tags.map((t) => (
            <span key={t} className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium">
              {t}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-2" data-label="Akcja">
        <Button
          size="sm"
          onClick={handleEnrollClick}
          disabled={activity.isFull}
          aria-disabled={activity.isFull}
          variant={activity.isFull ? "outline" : "default"}
          title={activity.isFull ? "Brak miejsc" : "Zapisz dziecko"}
          data-testid={`enroll-button-${activity.id}`}
        >
          {activity.isFull ? "Brak miejsc" : "Zapisz"}
        </Button>
      </td>
    </tr>
  );
});
ActivityRow.displayName = "ActivityRow";
