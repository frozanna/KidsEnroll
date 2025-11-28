/* eslint-disable react/prop-types */
import React, { memo } from "react";
import type { AdminActivityViewModel } from "./types";
import { Button } from "@/components/ui/button";

interface AdminActivitiesTableProps {
  activities: AdminActivityViewModel[];
  onDeleteClick: (id: number) => void;
}

export const AdminActivitiesTable: React.FC<AdminActivitiesTableProps> = ({ activities, onDeleteClick }) => {
  return (
    <div className="w-full overflow-hidden rounded-lg border" aria-label="Tabela zajęć (admin)">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" aria-label="Lista zajęć (admin)">
          <caption className="sr-only">Lista zajęć administracyjnych</caption>
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
                Limit / Wolne
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Koszt
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Tagi
              </th>
              <th scope="col" className="h-10 px-4 text-sm font-medium">
                Akcje
              </th>
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 && (
              <tr>
                <td colSpan={9} className="h-24 px-4 text-center text-sm text-muted-foreground">
                  Brak zajęć.
                </td>
              </tr>
            )}
            {activities.map((a) => (
              <ActivityRow key={a.id} activity={a} onDeleteClick={onDeleteClick} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface ActivityRowProps {
  activity: AdminActivityViewModel;
  onDeleteClick: (id: number) => void;
}

const ActivityRow: React.FC<ActivityRowProps> = memo(({ activity, onDeleteClick }) => {
  return (
    <tr className="border-t align-top transition-colors hover:bg-muted/40">
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
      <td className="px-4 py-2 text-sm" data-label="Limit / Wolne">
        <span aria-label={`Wolne miejsca: ${activity.availableSpots} z ${activity.participantLimit}`}>
          {activity.availableSpots}/{activity.participantLimit}
        </span>
      </td>
      <td className="px-4 py-2 text-sm" data-label="Koszt">
        {activity.costFormatted}
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
      <td className="px-4 py-2" data-label="Akcje">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={`/app/admin/activities/${activity.id}/edit`} aria-label="Edytuj zajęcia">
              Edytuj
            </a>
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDeleteClick(activity.id)} aria-label="Usuń zajęcia">
            Usuń
          </Button>
        </div>
      </td>
    </tr>
  );
});
ActivityRow.displayName = "AdminActivityRow";
