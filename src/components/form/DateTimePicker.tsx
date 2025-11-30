import * as React from "react";

interface DateTimePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label: string;
  name: string;
  value: string; // local datetime string, e.g., 2025-11-28T10:00
  error?: string;
  onChange: (v: string) => void;
}

const DateTimePicker = React.forwardRef<HTMLInputElement, DateTimePickerProps>(
  ({ label, name, value, error, onChange, required, ...rest }, ref) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      onChange(e.target.value);
    }
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={name} className="text-sm font-medium">
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
        <input
          ref={ref}
          id={name}
          name={name}
          type="datetime-local"
          className="w-full rounded-md border border-neutral-300 bg-sidebar px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
          value={value}
          onChange={handleChange}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
          {...rest}
        />
        {error && (
          <p id={`${name}-error`} className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
        {/* <p className="text-xs text-neutral-500" aria-live="polite">
          Uwaga: data i godzina zostaną zapisane w strefie UTC.
        </p> */}
      </div>
    );
  }
);

DateTimePicker.displayName = "DateTimePicker";

export default DateTimePicker;
