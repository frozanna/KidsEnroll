import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = "md", message }) => {
  const dimension = size === "sm" ? 16 : size === "lg" ? 40 : 24;
  return (
    <div className="flex flex-col items-center gap-2" role="status" aria-live="polite">
      <svg
        width={dimension}
        height={dimension}
        viewBox="0 0 24 24"
        className="animate-spin text-blue-600"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {message && <span className="text-xs text-gray-600">{message}</span>}
    </div>
  );
};
