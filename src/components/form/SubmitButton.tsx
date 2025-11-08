import * as React from "react";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading: boolean;
  label: string;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({ loading, label, disabled, ...rest }) => {
  return (
    <Button type="submit" disabled={loading || disabled} {...rest}>
      {loading && (
        <svg
          aria-hidden="true"
          className="size-4 animate-spin text-white"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      <span>{label}</span>
    </Button>
  );
};
