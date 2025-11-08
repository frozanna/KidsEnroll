import React from "react";
import { AddChildButton } from "./AddChildButton";
import { ReportButton } from "./ReportButton";

interface ActionsBarProps {
  onGenerateReport: () => void;
  onAddChild: () => void;
  disabledReport: boolean;
  loadingReport: boolean;
}

export const ActionsBar: React.FC<ActionsBarProps> = ({
  onGenerateReport,
  onAddChild,
  disabledReport,
  loadingReport,
}) => {
  return (
    <div className="flex items-center gap-3 mb-2">
      <ReportButton onGenerate={onGenerateReport} disabled={disabledReport} loading={loadingReport} />
      <AddChildButton onAdd={onAddChild} />
    </div>
  );
};
