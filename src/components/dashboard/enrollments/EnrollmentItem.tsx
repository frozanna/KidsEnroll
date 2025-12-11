import React from "react";
import type { EnrollmentViewModel } from "../types";

interface EnrollmentItemProps {
  enrollment: EnrollmentViewModel;
  onWithdraw?: (ids: { childId: number; activityId: number }) => void;
}

const EnrollmentItemComponent: React.FC<EnrollmentItemProps> = ({ enrollment, onWithdraw }) => {
  const handleWithdraw = () => {
    if (!onWithdraw) return;
    onWithdraw({ childId: enrollment.childId, activityId: enrollment.activityId });
  };

  return (
    <li
      className="flex items-center justify-between py-2 border-b last:border-none"
      data-testid={`enrollment-item-${enrollment.activityId}`}
    >
      <div className="flex flex-col">
        <span className="font-medium">{enrollment.activityName}</span>
        <span className="text-xs text-gray-500">
          {enrollment.workerFullName} • {enrollment.startLocalDate} {enrollment.startLocalTime}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-700 font-medium">{enrollment.cost} zł</span>
        {onWithdraw && (
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={!enrollment.canWithdraw}
            className="px-3 py-1 rounded-md bg-red-600 disabled:opacity-40 text-white text-xs font-medium hover:bg-red-500 focus:outline-none focus-visible:ring"
            aria-disabled={!enrollment.canWithdraw}
            title={enrollment.canWithdraw ? "Wypisz z zajęć" : "Nie można wypisać na mniej niż 24h przed zajęciami"}
          >
            Wypisz
          </button>
        )}
      </div>
    </li>
  );
};

export const EnrollmentItem = React.memo(EnrollmentItemComponent);
EnrollmentItem.displayName = "EnrollmentItem";
