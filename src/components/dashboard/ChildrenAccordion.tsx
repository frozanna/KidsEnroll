import React, { useId } from "react";
import type { ChildViewModel, EnrollmentViewModel } from "./types";
import { EnrollmentList } from "./enrollments/EnrollmentList";

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
            <button
              id={`${panelId}-button`}
              type="button"
              aria-expanded={isExpanded}
              aria-controls={contentId}
              onClick={() => onExpand(child.id)}
              className="w-full text-left px-4 py-3 flex items-center justify-between focus:outline-none focus-visible:ring"
            >
              <span className="font-medium">
                {child.fullName} <span className="text-xs text-gray-500">({child.age})</span>
              </span>
              <span className="text-sm text-gray-600">
                {isLoading ? "Ładowanie..." : isExpanded ? "Zwiń" : "Rozwiń"}
              </span>
            </button>
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
