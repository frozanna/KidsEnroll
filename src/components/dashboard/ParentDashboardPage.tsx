import React, { useEffect, useCallback } from "react";
import { useParentDashboard } from "../hooks/parentDashboard/useParentDashboard.ts";
import { ChildrenAccordion } from "./ChildrenAccordion";
import { ActionsBar } from "./actions/ActionsBar";
import { EmptyChildrenState } from "./EmptyChildrenState";
import { LoadingSpinner } from "./LoadingSpinner";
import { useToastFeedback } from "../useToastFeedback";

// Root component orchestrating parent dashboard state.
const ParentDashboardPage: React.FC = () => {
  const {
    state,
    toggleChildExpansion,
    isChildExpanded,
    fetchEnrollmentsLazy,
    navigateAddChild,
    generateReport,
    withdraw,
  } = useParentDashboard();
  const toast = useToastFeedback();

  useEffect(() => {
    // initial children fetch handled inside hook.
  }, []);

  // Toast errors outside render to avoid duplicate side-effects
  useEffect(() => {
    if (state.errorChildren) {
      toast.error(state.errorChildren);
    }
  }, [state.errorChildren, toast]);

  const handleWithdraw = useCallback(
    ({ childId, activityId }: { childId: number; activityId: number }) => withdraw(childId, activityId),
    [withdraw]
  );

  if (state.loadingChildren) {
    return <LoadingSpinner size="lg" message="Ładowanie dzieci..." />;
  }

  if (!state.loadingChildren && state.children.length === 0) {
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
        onAddChild={navigateAddChild}
        onGenerateReport={generateReport}
        disabledReport={state.loadingReport}
        loadingReport={state.loadingReport}
      />
      <ChildrenAccordion
        childrenData={state.children}
        expandedIds={state.expandedChildIds}
        loadingChildIds={state.loadingChildEnrollments}
        loadingEnrollmentsFor={state.loadingChildEnrollments}
        enrollmentsByChild={state.enrollmentsByChild}
        onWithdraw={handleWithdraw}
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
