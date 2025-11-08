import React, { useCallback, useState } from "react";
import type { ActivityViewModel, ChildSummary } from "./types";
import { Button } from "../../ui/button";
// Placeholder dialog structure; replace with shadcn Dialog when installed.

interface EnrollDialogProps {
  open: boolean;
  activity: ActivityViewModel | null;
  childrenList: ChildSummary[];
  onClose: () => void;
  onConfirm: (childId: number, activityId: number) => void;
}

export const EnrollDialog: React.FC<EnrollDialogProps> = ({ open, activity, childrenList, onClose, onConfirm }) => {
  const [selectedChildId, setSelectedChildId] = useState<number | undefined>();

  const confirm = useCallback(() => {
    if (selectedChildId && activity) onConfirm(selectedChildId, activity.id);
  }, [selectedChildId, activity, onConfirm]);

  if (!open || !activity) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="enroll-dialog-title"
      aria-describedby="enroll-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-md bg-background p-6 shadow-lg">
        <h2 id="enroll-dialog-title" className="mb-4 text-lg font-semibold">
          Zapis na zajęcia
        </h2>
        <p id="enroll-dialog-desc" className="mb-4 text-sm">
          Wybierz dziecko do zapisu na: <strong>{activity.name}</strong>
        </p>
        <div className="mb-4 max-h-48 overflow-y-auto">
          {childrenList.length === 0 && (
            <div className="text-sm text-muted-foreground">Nie masz jeszcze dodanych dzieci.</div>
          )}
          <ul className="space-y-2">
            {childrenList.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="selectedChild"
                  value={c.id}
                  checked={selectedChildId === c.id}
                  onChange={() => setSelectedChildId(c.id)}
                />
                <span>
                  {c.first_name} {c.last_name}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Anuluj
          </Button>
          <Button onClick={confirm} disabled={!selectedChildId} aria-disabled={!selectedChildId}>
            Zapisz
          </Button>
        </div>
      </div>
    </div>
  );
};
