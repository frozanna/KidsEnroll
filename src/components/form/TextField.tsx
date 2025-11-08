import * as React from "react";
import { cn } from "@/lib/utils";

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label: string;
  name: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, name, value, error, onChange, required, className, ...rest }, ref) => {
    const id = React.useId();
    const errorId = `${id}-error`;
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-medium">
          {label} {required && <span className="text-red-600">*</span>}
        </label>
        <input
          ref={ref}
          id={id}
          name={name}
          value={value}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            error && "border-red-500",
            className
          )}
          {...rest}
        />
        {error && (
          <p id={errorId} role="alert" className="text-xs text-red-600" aria-live="assertive">
            {error}
          </p>
        )}
      </div>
    );
  }
);
TextField.displayName = "TextField";
