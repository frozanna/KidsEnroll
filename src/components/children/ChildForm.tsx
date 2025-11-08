import * as React from "react";
import { TextField } from "../form/TextField";
import { DatePicker } from "../form/DatePicker";
import { Textarea } from "../form/Textarea";
import { SubmitButton } from "../form/SubmitButton";
import { ValidationErrors } from "../form/ValidationErrors";
import type { ChildFormProps, ChildFormState, ChildFormValues, ApiErrorDTO } from "./types";

// Reducer actions
type Action =
  | { type: "SET_FIELD"; field: keyof ChildFormValues; value: string }
  | { type: "SET_ERRORS"; errors: ChildFormState["errors"] }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_ERROR"; errors: ChildFormState["errors"] };

function initState(initial?: ChildFormValues): ChildFormState {
  return {
    values: initial ?? { first_name: "", last_name: "", birth_date: "", description: "" },
    errors: {},
    submitting: false,
    submitSuccess: false,
  };
}

function reducer(state: ChildFormState, action: Action): ChildFormState {
  switch (action.type) {
    case "SET_FIELD": {
      const restErrors = Object.fromEntries(
        Object.entries(state.errors).filter(([k]) => k !== action.field)
      ) as ChildFormState["errors"];
      return { ...state, values: { ...state.values, [action.field]: action.value }, errors: restErrors };
    }
    case "SET_ERRORS":
      return { ...state, errors: action.errors };
    case "SUBMIT_START":
      return { ...state, submitting: true };
    case "SUBMIT_SUCCESS":
      return { ...state, submitting: false, submitSuccess: true };
    case "SUBMIT_ERROR":
      return { ...state, submitting: false, errors: action.errors };
    default:
      return state;
  }
}

// Frontend validation (mirrors backend constraints roughly)
function validate(values: ChildFormValues): ChildFormState["errors"] {
  const errors: ChildFormState["errors"] = {};
  if (!values.first_name.trim()) errors.first_name = "Imię wymagane";
  if (!values.last_name.trim()) errors.last_name = "Nazwisko wymagane";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.birth_date)) errors.birth_date = "Data w formacie RRRR-MM-DD";
  else {
    const d = new Date(values.birth_date + "T00:00:00Z");
    const today = new Date();
    const dateOnly = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const todayOnly = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    if (isNaN(d.getTime()) || dateOnly > todayOnly) errors.birth_date = "Data nie może być przyszła";
  }
  if (values.description && values.description.length > 1000) errors.description = "Opis za długi";
  return errors;
}

function mapApiErrorToFormErrors(err: ApiErrorDTO): ChildFormState["errors"] {
  if (err.code === "CHILD_NOT_OWNED") return { _global: ["Brak uprawnień do edycji tego dziecka."] };
  if (err.code === "CHILD_NOT_FOUND") return { _global: ["Dziecko nie znalezione."] };
  if (err.code === "VALIDATION_ERROR") {
    // Try extract field level details (assuming details.fields: Record<string,string>)
    const fields = (err.details?.fields as Record<string, string> | undefined) || {};
    const fieldErrors: ChildFormState["errors"] = { ...fields };
    if (Object.keys(fieldErrors).length === 0) fieldErrors._global = [err.message];
    return fieldErrors;
  }
  if (err.code === "INTERNAL_ERROR") return { _global: ["Wewnętrzny błąd serwera. Spróbuj później."] };
  return { _global: [err.message || "Nieznany błąd"] };
}

// Derive age (years) for preview
function deriveAgeYears(birthDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const d = new Date(birthDate + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  const mDiff = today.getUTCMonth() - d.getUTCMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getUTCDate() < d.getUTCDate())) age--;
  return age >= 0 ? age : null;
}

export const ChildForm: React.FC<ChildFormProps> = ({
  mode,
  initialData,
  childId,
  onSuccessRedirect = "/app/dashboard",
}) => {
  const [state, dispatch] = React.useReducer(reducer, initialData, initState);
  const firstInvalidRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Focus first invalid field when errors change
  React.useEffect(() => {
    const order: (keyof ChildFormValues)[] = ["first_name", "last_name", "birth_date", "description"];
    for (const f of order) {
      if ((state.errors as Record<string, unknown>)[f]) {
        firstInvalidRef.current?.focus();
        break;
      }
    }
  }, [state.errors]);

  React.useEffect(() => {
    if (state.submitSuccess) {
      window.location.href = onSuccessRedirect;
    }
  }, [state.submitSuccess, onSuccessRedirect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validate(state.values);
    if (Object.keys(fieldErrors).length > 0) {
      dispatch({ type: "SET_ERRORS", errors: fieldErrors });
      return;
    }
    dispatch({ type: "SUBMIT_START" });
    try {
      const endpoint = mode === "create" ? "/api/children" : `/api/children/${childId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      // Build payload for update (full set for simplicity)
      const payload = {
        first_name: state.values.first_name.trim(),
        last_name: state.values.last_name.trim(),
        birth_date: state.values.birth_date,
        description: state.values.description?.trim() || undefined,
      };
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: ApiErrorDTO };
        const mapped = data.error ? mapApiErrorToFormErrors(data.error) : { _global: ["Błąd zapisania"] };
        dispatch({ type: "SUBMIT_ERROR", errors: mapped });
        return;
      }
      dispatch({ type: "SUBMIT_SUCCESS" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Problem z połączeniem – spróbuj ponownie.";
      dispatch({ type: "SUBMIT_ERROR", errors: { _global: [message] } });
    }
  }

  const { values, errors, submitting } = state;
  const disableSubmit = submitting || Object.keys(errors).length > 0 || !state.values.birth_date;
  const age = deriveAgeYears(state.values.birth_date);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {errors._global && <ValidationErrors errors={errors._global} />}
      {submitting && (
        <p className="text-xs text-neutral-500" aria-live="polite">
          Zapisywanie...
        </p>
      )}
      <TextField
        label="Imię"
        name="first_name"
        value={values.first_name}
        required
        error={errors.first_name}
        onChange={(v: string) => dispatch({ type: "SET_FIELD", field: "first_name", value: v })}
        ref={(el: HTMLInputElement | null) => {
          if (errors.first_name && el) firstInvalidRef.current = el;
        }}
      />
      <TextField
        label="Nazwisko"
        name="last_name"
        value={values.last_name}
        required
        error={errors.last_name}
        onChange={(v: string) => dispatch({ type: "SET_FIELD", field: "last_name", value: v })}
        ref={(el: HTMLInputElement | null) => {
          if (errors.last_name && el) firstInvalidRef.current = el;
        }}
      />
      <div className="flex flex-col gap-1">
        <DatePicker
          label="Data urodzenia"
          name="birth_date"
          value={values.birth_date}
          required
          error={errors.birth_date}
          onChange={(v: string) => dispatch({ type: "SET_FIELD", field: "birth_date", value: v })}
        />
        {age !== null && (
          <p className="text-xs text-neutral-600" aria-live="polite">
            Wiek: {age} {age === 1 ? "rok" : "lat"}
          </p>
        )}
      </div>
      <Textarea
        label="Opis (opcjonalnie)"
        name="description"
        value={values.description ?? ""}
        error={errors.description}
        onChange={(v: string) => dispatch({ type: "SET_FIELD", field: "description", value: v })}
      />
      <SubmitButton
        loading={submitting}
        label={mode === "create" ? "Zapisz dziecko" : "Zapisz zmiany"}
        disabled={disableSubmit}
      />
    </form>
  );
};

export default ChildForm;
