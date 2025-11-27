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
    <div className="w-full overflow-x-auto p-4" aria-label="Sekcja tabeli z listą zajęć">
      <table className="w-full border-collapse" aria-label="Lista zajęć">
        <caption className="sr-only">Lista zajęć dostępnych do zapisania dziecka</caption>
        <thead>
          <tr className="text-left border-b align-middle bg-border/40">
            <th scope="col" className="py-2 pr-2">
              Nazwa
            </th>
            <th scope="col" className="py-2 pr-2">
              Opis
            </th>
            <th scope="col" className="py-2 pr-2">
              Opiekun
            </th>
            <th scope="col" className="py-2 pr-2">
              Data
            </th>
            <th scope="col" className="py-2 pr-2">
              Godzina
            </th>
            <th scope="col" className="py-2 pr-2">
              Koszt
            </th>
            <th scope="col" className="py-2 pr-2">
              Wolne miejsca
            </th>
            <th scope="col" className="py-2 pr-2">
              Tagi
            </th>
            <th scope="col" className="py-2 pr-2">
              Akcja
            </th>
          </tr>
        </thead>
        <tbody>
          {activities.length === 0 && (
            <tr>
              <td colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
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
    <tr className="border-b align-top">
      <td className="py-2 pr-2 font-medium" data-label="Nazwa">
        {activity.name}
      </td>
      <td className="py-2 pr-2 max-w-[200px] text-xs text-muted-foreground" data-label="Opis">
        <span className="line-clamp-3" title={activity.description ?? undefined}>
          {activity.description || "—"}
        </span>
      </td>
      <td className="py-2 pr-2 text-sm" data-label="Opiekun">
        <div className="flex flex-col" title={activity.workerEmail}>
          <span>{activity.workerName}</span>
          <span className="text-xs text-muted-foreground">{activity.workerEmail}</span>
        </div>
      </td>
      <td className="py-2 pr-2 text-sm" data-label="Data">
        {activity.startDateLocal}
      </td>
      <td className="py-2 pr-2 text-sm" data-label="Godzina">
        {activity.startTimeLocal}
      </td>
      <td className="py-2 pr-2 text-sm" data-label="Koszt">
        {activity.costFormatted}
      </td>
      <td className="py-2 pr-2 text-sm" data-label="Wolne miejsca">
        <span aria-label={`Wolne miejsca: ${activity.availableSpots} z ${activity.participantLimit}`}>
          {activity.availableSpots}/{activity.participantLimit}
        </span>
      </td>
      <td className="py-2 pr-2 text-xs" data-label="Tagi">
        <div className="flex flex-wrap gap-1" aria-label="Tagi">
          {activity.tags.length === 0 && <span className="text-muted-foreground">—</span>}
          {activity.tags.map((t) => (
            <span key={t} className="rounded bg-neutral-200 dark:bg-neutral-700 px-2 py-0.5 text-[11px] font-medium">
              {t}
            </span>
          ))}
        </div>
      </td>
      <td className="py-2 pr-2" data-label="Akcja">
        <Button
          size="sm"
          onClick={handleEnrollClick}
          disabled={activity.isFull}
          aria-disabled={activity.isFull}
          variant={activity.isFull ? "outline" : "default"}
          title={activity.isFull ? "Brak miejsc" : "Zapisz dziecko"}
        >
          {activity.isFull ? "Brak miejsc" : "Zapisz"}
        </Button>
      </td>
    </tr>
  );
});
ActivityRow.displayName = "ActivityRow";
