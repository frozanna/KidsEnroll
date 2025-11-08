import React, { useEffect } from "react";
import { useParentDashboard } from "./useParentDashboard";
import { ChildrenAccordion } from "./ChildrenAccordion";
import { ActionsBar } from "./actions/ActionsBar";
import { EmptyChildrenState } from "./EmptyChildrenState";
import { LoadingSpinner } from "./LoadingSpinner";
import { useToastFeedback } from "../useToastFeedback";

// Root component orchestrating parent dashboard state.
const ParentDashboardPage: React.FC = () => {
  const {
    state,
    hasAnyEnrollments,
    toggleChildExpansion,
    isChildExpanded,
    // isChildLoading, // kept in hook for future per-panel spinners
    fetchEnrollmentsLazy,
    navigateAddChild,
    generateReport,
    withdraw,
  } = useParentDashboard();
  const toast = useToastFeedback();

  useEffect(() => {
    // initial children fetch handled inside hook.
  }, []);

  if (state.loadingChildren) {
    return <LoadingSpinner size="lg" message="Ładowanie dzieci..." />;
  }

  if (!state.loadingChildren && state.children.length === 0) {
    if (state.errorChildren) {
      toast.error(state.errorChildren);
    }
    return <EmptyChildrenState onAddChild={navigateAddChild} />;
  }

  return (
    <div className="space-y-6" role="region" aria-label="Panel rodzica">
      {/* Live region for status updates (errors, report generation) */}
      <div aria-live="polite" className="sr-only" id="dashboard-status">
        {state.errorChildren ? `Błąd: ${state.errorChildren}` : ""}
        {state.reportError ? `Błąd raportu: ${state.reportError}` : ""}
        {state.loadingReport ? "Generowanie raportu" : ""}
      </div>
      <ActionsBar
        onGenerateReport={generateReport}
        onAddChild={navigateAddChild}
        disabledReport={!hasAnyEnrollments || state.loadingReport}
        loadingReport={state.loadingReport}
      />
      <ChildrenAccordion
        childrenData={state.children}
        expandedIds={state.expandedChildIds}
        loadingChildIds={state.loadingChildEnrollments}
        loadingEnrollmentsFor={state.loadingChildEnrollments}
        enrollmentsByChild={state.enrollmentsByChild}
        onWithdraw={({ childId, activityId }: { childId: number; activityId: number }) => withdraw(childId, activityId)}
        onExpand={(childId: number) => {
          toggleChildExpansion(childId);
          if (!isChildExpanded(childId)) {
            fetchEnrollmentsLazy(childId); // fetch when expanding
          }
        }}
      />
    </div>
  );
};

export default ParentDashboardPage;
