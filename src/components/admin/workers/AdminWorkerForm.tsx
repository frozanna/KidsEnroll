import React, { useEffect, useId, useMemo, useReducer } from "react";
import type { WorkerCreateCommand, WorkerUpdateCommand } from "@/types";
import { TextField } from "@/components/form/TextField";
import { ValidationErrors } from "@/components/form/ValidationErrors";
import { SubmitButton } from "@/components/form/SubmitButton";
import { useToast } from "@/components/ui/use-toast";
import { isValidEmail } from "@/lib/utils";

type Mode = "create" | "edit";

export interface WorkerFormValues {
  first_name: string;
  last_name: string;
  email: string;
}

export interface WorkerFormErrors {
  first_name?: string;
  last_name?: string;
  email?: string;
  _global?: string[];
}

interface Props {
  mode: Mode;
  initialData?: WorkerFormValues;
  workerId?: number;
  onSuccessRedirect?: string; // default /admin/workers
}

type Action =
  | { type: "SET_FIELD"; field: keyof WorkerFormValues; value: string }
  | { type: "SET_ERRORS"; errors: WorkerFormErrors }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_ERROR"; errors: WorkerFormErrors };

interface State {
  values: WorkerFormValues;
  errors: WorkerFormErrors;
  submitting: boolean;
  submitSuccess: boolean;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_FIELD":
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: undefined },
      };
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

function validate(values: WorkerFormValues): WorkerFormErrors {
  const errors: WorkerFormErrors = {};

  const first = values.first_name.trim();
  const last = values.last_name.trim();
  const email = values.email.trim();

  if (!first) errors.first_name = "Imię jest wymagane";
  else if (first.length > 120) errors.first_name = "Imię jest za długie";

  if (!last) errors.last_name = "Nazwisko jest wymagane";
  else if (last.length > 120) errors.last_name = "Nazwisko jest za długie";

  if (!email) errors.email = "Email jest wymagany";
  else if (email.length > 255) errors.email = "Email jest za długi";
  else if (!isValidEmail(email)) errors.email = "Nieprawidłowy format email";

  return errors;
}

export default function WorkerForm({ mode, initialData, workerId, onSuccessRedirect }: Props) {
  const idPrefix = useId();
  const { toast } = useToast();

  const initialValues: WorkerFormValues = useMemo(
    () =>
      initialData ?? {
        first_name: "",
        last_name: "",
        email: "",
      },
    [initialData]
  );

  const [state, dispatch] = useReducer(reducer, {
    values: initialValues,
    errors: {},
    submitting: false,
    submitSuccess: false,
  });

  useEffect(() => {
    if (state.submitSuccess) {
      toast({
        title: "Opiekun zapisany",
        description: mode === "create" ? "Dodano nowego opiekuna" : "Zaktualizowano dane opiekuna",
      });
      const url = onSuccessRedirect ?? "/admin/workers";
      window.location.href = url;
    }
  }, [state.submitSuccess, mode, onSuccessRedirect, toast]);

  useEffect(() => {
    // Focus first invalid field when errors appear
    if (!state.submitting && state.errors) {
      const order: (keyof WorkerFormValues)[] = ["first_name", "last_name", "email"];
      for (const key of order) {
        if (state.errors[key]) {
          const el = document.getElementById(`${idPrefix}-${key}`) as HTMLInputElement | null;
          if (el) {
            el.focus();
            break;
          }
        }
      }
    }
  }, [state.errors, state.submitting, idPrefix]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errors = validate(state.values);
    if (Object.keys(errors).length > 0) {
      dispatch({ type: "SET_ERRORS", errors });
      return;
    }

    dispatch({ type: "SUBMIT_START" });

    try {
      const payload: WorkerCreateCommand | WorkerUpdateCommand = {
        first_name: state.values.first_name.trim(),
        last_name: state.values.last_name.trim(),
        email: state.values.email.trim(),
      };

      const endpoint = mode === "create" ? "/api/admin/workers" : `/api/admin/workers/${workerId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        dispatch({ type: "SUBMIT_SUCCESS" });
        return;
      }

      // Error mapping
      const contentType = res.headers.get("Content-Type") || "";
      let serverError: { error?: { message?: string; details?: { fields?: Record<string, string[]> } } } | null = null;
      if (contentType.includes("application/json")) {
        serverError = await res.json().catch(() => null);
      } else {
        serverError = { error: { message: await res.text().catch(() => "") } };
      }

      const mapped: WorkerFormErrors = {};

      if (res.status === 409) {
        mapped.email = "Podany email już istnieje";
      } else if (res.status === 400) {
        const details = serverError?.error?.details as { fields?: Record<string, string[]> } | undefined;
        const fields = details?.fields as Record<string, string[]> | undefined;
        if (fields) {
          if (fields.first_name?.length) mapped.first_name = fields.first_name[0];
          if (fields.last_name?.length) mapped.last_name = fields.last_name[0];
          if (fields.email?.length) mapped.email = fields.email[0];
        } else {
          mapped._global = [serverError?.error?.message || "Nieprawidłowe dane wejściowe"];
        }
      } else if (res.status === 404) {
        mapped._global = ["Nie znaleziono opiekuna"];
      } else if (res.status === 401 || res.status === 403) {
        mapped._global = ["Brak uprawnień do wykonania operacji"];
      } else {
        mapped._global = [serverError?.error?.message || "Wewnętrzny błąd serwera"];
      }

      dispatch({ type: "SUBMIT_ERROR", errors: mapped });
    } catch {
      dispatch({ type: "SUBMIT_ERROR", errors: { _global: ["Błąd sieci lub nieoczekiwany błąd"] } });
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-live="polite" className="space-y-6">
      {state.errors._global && state.errors._global.length > 0 && <ValidationErrors errors={state.errors._global} />}

      <TextField
        id={`${idPrefix}-first_name`}
        label="Imię"
        name="first_name"
        value={state.values.first_name}
        onChange={(v) => dispatch({ type: "SET_FIELD", field: "first_name", value: v })}
        error={state.errors.first_name}
        required
      />

      <TextField
        id={`${idPrefix}-last_name`}
        label="Nazwisko"
        name="last_name"
        value={state.values.last_name}
        onChange={(v) => dispatch({ type: "SET_FIELD", field: "last_name", value: v })}
        error={state.errors.last_name}
        required
      />

      <TextField
        id={`${idPrefix}-email`}
        label="Email"
        type="email"
        name="email"
        value={state.values.email}
        onChange={(v) => dispatch({ type: "SET_FIELD", field: "email", value: v })}
        error={state.errors.email}
        required
      />

      <div className="pt-2">
        <SubmitButton loading={state.submitting} label={mode === "create" ? "Zapisz opiekuna" : "Zapisz zmiany"} />
      </div>
    </form>
  );
}
