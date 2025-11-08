import * as React from "react";

interface ValidationErrorsProps {
  errors: string[];
}

export const ValidationErrors: React.FC<ValidationErrorsProps> = ({ errors }) => {
  if (!errors || errors.length === 0) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 flex flex-col gap-1"
    >
      {errors.map((e, i) => (
        <div key={i}>{e}</div>
      ))}
    </div>
  );
};
