import * as React from "react";
import { cn } from "@/lib/utils";

interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  name: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  error,
  required,
  name,
  className,
  ...rest
}) => {
  const id = React.useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input
        id={id}
        type="date"
        name={name}
        value={value}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400",
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
};
