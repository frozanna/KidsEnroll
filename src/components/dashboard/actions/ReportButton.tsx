import React from "react";
import { Button } from "../../ui/button";

interface ReportButtonProps {
  loading: boolean;
  disabled: boolean;
  onGenerate: () => void;
}

// Secondary action: weekly report generation
export const ReportButton: React.FC<ReportButtonProps> = ({ loading, disabled, onGenerate }) => {
  const isDisabled = disabled || loading;
  return (
    <Button
      type="button"
      onClick={onGenerate}
      disabled={isDisabled}
      variant="secondary"
      size="lg"
      aria-disabled={isDisabled}
      aria-busy={loading}
      aria-live="polite"
    >
      {loading ? "Generowanie..." : "Pobierz tygodniowy raport kosztów"}
    </Button>
  );
};
