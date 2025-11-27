import React from "react";
import { AddChildButton } from "./AddChildButton";
import { ReportButton } from "./ReportButton";
import { EnrollActivityButton } from "./EnrollActivityButton";

interface ActionsBarProps {
  onGenerateReport: () => void;
  onAddChild: () => void;
  onNavigateActivities?: () => void; // optional to keep backward compatibility
  disabledReport: boolean;
  loadingReport: boolean;
}

export const ActionsBar: React.FC<ActionsBarProps> = ({
  onAddChild,
  onGenerateReport,
  onNavigateActivities,
  disabledReport,
  loadingReport,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-2" aria-label="Akcje główne">
      <EnrollActivityButton onNavigate={onNavigateActivities} />
      <AddChildButton onAdd={onAddChild} />
      <ReportButton onGenerate={onGenerateReport} disabled={disabledReport} loading={loadingReport} />
    </div>
  );
};
