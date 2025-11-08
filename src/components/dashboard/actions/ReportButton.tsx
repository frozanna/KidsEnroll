import React from "react";

interface ReportButtonProps {
  loading: boolean;
  disabled: boolean;
  onGenerate: () => void;
}

export const ReportButton: React.FC<ReportButtonProps> = ({ loading, disabled, onGenerate }) => {
  return (
    <button
      type="button"
      onClick={onGenerate}
      disabled={disabled || loading}
      className="px-4 py-2 rounded-md bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium hover:bg-indigo-500 focus:outline-none focus-visible:ring"
      aria-disabled={disabled || loading}
    >
      {loading ? "Generowanie..." : "Raport tygodniowy"}
    </button>
  );
};
