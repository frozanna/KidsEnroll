import React, { useId } from "react";
import type { ChildViewModel, EnrollmentViewModel } from "./types";
import { EnrollmentList } from "./enrollments/EnrollmentList";
import { Button } from "../ui/button";

interface ChildrenAccordionProps {
  childrenData: ChildViewModel[];
  expandedIds: number[];
  loadingChildIds: number[];
  onExpand: (childId: number) => void;
  enrollmentsByChild?: Record<number, EnrollmentViewModel[]>;
  loadingEnrollmentsFor?: number[]; // redundant to loadingChildIds but allows refinement later
  onWithdraw?: (ids: { childId: number; activityId: number }) => void;
}

export const ChildrenAccordion: React.FC<ChildrenAccordionProps> = ({
  childrenData,
  expandedIds,
  loadingChildIds,
  onExpand,
  enrollmentsByChild = {},
  loadingEnrollmentsFor = [],
  onWithdraw,
}) => {
  const idPrefix = useId();
  return (
    <div className="space-y-4" role="region" aria-label="Lista dzieci">
      {childrenData.map((child) => {
        const isExpanded = expandedIds.includes(child.id);
        const isLoading = loadingChildIds.includes(child.id);
        const panelId = `${idPrefix}-child-panel-${child.id}`;
        const contentId = `${idPrefix}-child-content-${child.id}`;
        return (
          <section key={child.id} id={panelId} className="border rounded-md" aria-labelledby={`${panelId}-button`}>
            <div className="flex items-stretch justify-between gap-2 px-4 py-3">
              <button
                id={`${panelId}-button`}
                type="button"
                aria-expanded={isExpanded}
                aria-controls={contentId}
                onClick={() => onExpand(child.id)}
                className="flex-1 text-left focus:outline-none focus-visible:ring"
              >
                <span className="font-medium">
                  {child.fullName} <span className="text-xs text-gray-500">({child.age})</span>
                </span>
                <span className="ml-2 text-sm text-gray-600">
                  {isLoading ? "Ładowanie..." : isExpanded ? "Zwiń" : "Rozwiń"}
                </span>
              </button>
              <Button asChild variant="outline" size="sm" aria-label={`Edytuj dane dziecka ${child.fullName}`}>
                <a href={`/app/dzieci/${child.id}/edytuj`} className="inline-flex items-center" tabIndex={0}>
                  Edytuj
                </a>
              </Button>
            </div>
            {isExpanded && (
              <div id={contentId} role="region" aria-live="polite" className="px-4 pb-4">
                <EnrollmentList
                  enrollments={enrollmentsByChild[child.id] || []}
                  loading={loadingEnrollmentsFor.includes(child.id)}
                  onWithdraw={onWithdraw}
                />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
