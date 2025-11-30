import * as React from "react";

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label: string;
  name: string;
  value: string;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: string) => void;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ label, name, value, error, min, max, step = 1, onChange, required, ...rest }, ref) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const v = e.target.value;
      onChange(v);
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
          inputMode="decimal"
          className="w-full rounded-md border border-neutral-300 bg-sidebar px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
          value={value}
          onChange={handleChange}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
          min={min}
          max={max}
          step={step}
          {...rest}
        />
        {error && (
          <p id={`${name}-error`} className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

NumberInput.displayName = "NumberInput";

export default NumberInput;
