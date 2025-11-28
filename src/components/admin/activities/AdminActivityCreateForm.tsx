import * as React from "react";
import { TextField } from "@/components/form/TextField";
import { Textarea } from "@/components/form/Textarea";
import { SubmitButton } from "@/components/form/SubmitButton";
import { ValidationErrors } from "@/components/form/ValidationErrors";
import NumberInput from "@/components/form/NumberInput";
import DateTimePicker from "@/components/form/DateTimePicker";
import { useToastFeedback } from "@/components/ui/useToastFeedback";
import type { ActivityWorkerDTO, AdminActivityCreateCommand, ErrorResponseDTO } from "@/types";

interface AdminActivityCreateFormProps {
  workers: ActivityWorkerDTO[];
  onSuccessRedirect?: string;
}

interface AdminActivityFormValues {
  name: string;
  description: string;
  cost: string; // keep as string for controlled input; parse to number
  participant_limit: string; // same as above
  start_datetime_local: string; // e.g., 2025-11-28T10:00
  worker_id: string; // selected worker id as string
  tags: string[];
}

type AdminActivityFormErrors = Partial<Record<keyof AdminActivityFormValues, string>> & { _global?: string[] };

interface AdminActivityFormState {
  values: AdminActivityFormValues;
  errors: AdminActivityFormErrors;
  submitting: boolean;
  submitSuccess: boolean;
}

type Action =
  | { type: "SET_FIELD"; field: keyof AdminActivityFormValues; value: string | string[] }
  | { type: "SET_ERRORS"; errors: AdminActivityFormErrors }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_ERROR"; errors: AdminActivityFormErrors };

function initState(): AdminActivityFormState {
  return {
    values: {
      name: "",
      description: "",
      cost: "",
      participant_limit: "",
      start_datetime_local: "",
      worker_id: "",
      tags: [],
    },
    errors: {},
    submitting: false,
    submitSuccess: false,
  };
}

function reducer(state: AdminActivityFormState, action: Action): AdminActivityFormState {
  switch (action.type) {
    case "SET_FIELD": {
      const restErrors = Object.fromEntries(
        Object.entries(state.errors).filter(([k]) => k !== action.field)
      ) as AdminActivityFormErrors;
      return {
        ...state,
        values: {
          ...state.values,
          [action.field]: action.field === "tags" ? (action.value as string[]) : (action.value as string),
        },
        errors: restErrors,
      };
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

function validate(values: AdminActivityFormValues, workers: ActivityWorkerDTO[]): AdminActivityFormErrors {
  const errors: AdminActivityFormErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = "Nazwa wymagana";
  else if (name.length > 120) errors.name = "Nazwa zbyt długa (max 120)";

  if (values.description && values.description.length > 1000) errors.description = "Opis zbyt długi (max 1000)";

  const costNum = Number(values.cost);
  if (values.cost === "") errors.cost = "Koszt wymagany";
  else if (!isFinite(costNum) || costNum < 0) errors.cost = "Niepoprawny koszt";
  else if (!/^\d+(?:\.\d{1,2})?$/.test(values.cost)) errors.cost = "Maks. 2 miejsca po przecinku";

  const limitNum = Number(values.participant_limit);
  if (values.participant_limit === "") errors.participant_limit = "Limit miejsc wymagany";
  else if (!Number.isInteger(limitNum) || limitNum < 1) errors.participant_limit = "Limit musi być >= 1";

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(values.start_datetime_local))
    errors.start_datetime_local = "Ustaw datę i godzinę";
  else {
    const localDate = new Date(values.start_datetime_local);
    const utcIso = new Date(localDate).toISOString();
    const now = new Date();
    if (isNaN(localDate.getTime())) errors.start_datetime_local = "Niepoprawna data";
    else if (new Date(utcIso).getTime() <= now.getTime()) errors.start_datetime_local = "Data musi być w przyszłości";
  }

  if (!values.worker_id) errors.worker_id = "Wybierz opiekuna";
  else if (!workers.some((w) => String(w.id) === values.worker_id)) errors.worker_id = "Niepoprawny opiekun";

  const uniqueTags = Array.from(new Set(values.tags.map((t) => t.trim()).filter(Boolean)));
  if (uniqueTags.length !== values.tags.length) {
    errors.tags = "Tagi nie mogą być puste";
  }

  return errors;
}

function mapApiErrorToFormErrors(err: ErrorResponseDTO["error"]): AdminActivityFormErrors {
  if (err.code === "WORKER_NOT_FOUND") return { worker_id: "Wybrany opiekun nie istnieje." };
  if (err.code === "VALIDATION_ERROR") {
    const fields = (err.details?.fields as Record<string, string> | undefined) || {};
    const fieldErrors: AdminActivityFormErrors = Object.keys(fields).reduce((acc, key) => {
      acc[key as keyof AdminActivityFormValues] = fields[key];
      return acc;
    }, {} as AdminActivityFormErrors);
    if (Object.keys(fieldErrors).length === 0) fieldErrors._global = [err.message];
    return fieldErrors;
  }
  if (err.code === "AUTH_UNAUTHORIZED" || err.code === "FORBIDDEN")
    return { _global: ["Brak uprawnień lub sesja wygasła."] };
  if (err.code === "INTERNAL_ERROR") return { _global: ["Wewnętrzny błąd serwera. Spróbuj później."] };
  return { _global: [err.message || "Nieznany błąd"] };
}

const AdminActivityCreateForm: React.FC<AdminActivityCreateFormProps> = ({
  workers,
  onSuccessRedirect = "/admin/activities",
}) => {
  const [state, dispatch] = React.useReducer(reducer, undefined, initState);
  const { success, error } = useToastFeedback();
  const firstInvalidRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [tagInput, setTagInput] = React.useState("");

  React.useEffect(() => {
    const order: (keyof AdminActivityFormValues)[] = [
      "name",
      "cost",
      "participant_limit",
      "start_datetime_local",
      "worker_id",
      "description",
      "tags",
    ];
    for (const f of order) {
      if ((state.errors as Record<string, unknown>)[f]) {
        firstInvalidRef.current?.focus();
        break;
      }
    }
  }, [state.errors]);

  React.useEffect(() => {
    if (state.submitSuccess) {
      success("Zajęcia utworzone");
      window.location.href = onSuccessRedirect;
    }
  }, [state.submitSuccess, onSuccessRedirect, success]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validate(state.values, workers);
    if (Object.keys(fieldErrors).length > 0) {
      dispatch({ type: "SET_ERRORS", errors: fieldErrors });
      return;
    }
    dispatch({ type: "SUBMIT_START" });
    try {
      const local = new Date(state.values.start_datetime_local);
      const startIsoUtc = new Date(local).toISOString();
      const payload: AdminActivityCreateCommand = {
        name: state.values.name.trim(),
        description: state.values.description?.trim() || null,
        cost: Number(state.values.cost),
        participant_limit: Number(state.values.participant_limit),
        start_datetime: startIsoUtc,
        worker_id: Number(state.values.worker_id),
        tags: Array.from(new Set(state.values.tags.map((t) => t.trim()).filter(Boolean))),
      };
      const res = await fetch("/api/admin/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as ErrorResponseDTO;
        const mapped = data?.error ? mapApiErrorToFormErrors(data.error) : { _global: ["Błąd zapisania"] };
        dispatch({ type: "SUBMIT_ERROR", errors: mapped });
        error(mapped._global?.[0] || "Nie udało się utworzyć zajęć");
        return;
      }
      dispatch({ type: "SUBMIT_SUCCESS" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Problem z połączeniem – spróbuj ponownie.";
      dispatch({ type: "SUBMIT_ERROR", errors: { _global: [message] } });
      error(message);
    }
  }

  const { values, errors, submitting } = state;
  const disableSubmit = submitting || Object.keys(errors).length > 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {errors._global && <ValidationErrors errors={errors._global} />}
      {submitting && (
        <p className="text-xs text-neutral-500" aria-live="polite">
          Zapisywanie...
        </p>
      )}
      <TextField
        label="Nazwa"
        name="name"
        value={values.name}
        required
        error={errors.name}
        onChange={(v: string) => dispatch({ type: "SET_FIELD", field: "name", value: v })}
        ref={(el: HTMLInputElement | null) => {
          if (errors.name && el) firstInvalidRef.current = el;
        }}
      />
      <Textarea
        label="Opis (opcjonalnie)"
        name="description"
        value={values.description}
        error={errors.description}
        onChange={(v: string) => dispatch({ type: "SET_FIELD", field: "description", value: v })}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NumberInput
          label="Koszt"
          name="cost"
          value={values.cost}
          required
          error={errors.cost}
          step={0.01}
          min={0}
          onChange={(v: string) => dispatch({ type: "SET_FIELD", field: "cost", value: v })}
          ref={(el: HTMLInputElement | null) => {
            if (errors.cost && el) firstInvalidRef.current = el;
          }}
        />
        <NumberInput
          label="Limit miejsc"
          name="participant_limit"
          value={values.participant_limit}
          required
          error={errors.participant_limit}
          step={1}
          min={1}
          onChange={(v: string) => dispatch({ type: "SET_FIELD", field: "participant_limit", value: v })}
          ref={(el: HTMLInputElement | null) => {
            if (errors.participant_limit && el) firstInvalidRef.current = el;
          }}
        />
      </div>
      <DateTimePicker
        label="Data i godzina rozpoczęcia"
        name="start_datetime_local"
        value={values.start_datetime_local}
        required
        error={errors.start_datetime_local}
        onChange={(v: string) => dispatch({ type: "SET_FIELD", field: "start_datetime_local", value: v })}
        ref={(el: HTMLInputElement | null) => {
          if (errors.start_datetime_local && el) firstInvalidRef.current = el;
        }}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="worker_id" className="text-sm font-medium">
          Opiekun <span className="text-red-500">*</span>
        </label>
        <select
          id="worker_id"
          name="worker_id"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
          value={values.worker_id}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "worker_id", value: e.target.value })}
          aria-invalid={!!errors.worker_id}
          aria-describedby={errors.worker_id ? "worker_id-error" : undefined}
          required
        >
          <option value="">Wybierz opiekuna...</option>
          {workers.map((w) => (
            <option key={w.id} value={String(w.id)}>
              {w.first_name} {w.last_name} ({w.email})
            </option>
          ))}
        </select>
        {errors.worker_id && (
          <p id="worker_id-error" className="text-xs text-red-600" role="alert">
            {errors.worker_id}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tags-input" className="text-sm font-medium">
          Tagi (wpisz, Enter)
        </label>
        <div className="flex gap-2">
          <input
            id="tags-input"
            type="text"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
            placeholder="np. sport, muzyka, plener"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const t = tagInput.trim();
                if (!t) return;
                const next = Array.from(new Set([...(values.tags || []), t]));
                dispatch({ type: "SET_FIELD", field: "tags", value: next });
                setTagInput("");
              }
            }}
            aria-invalid={!!errors.tags}
          />
          <button
            type="button"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50"
            onClick={() => {
              const t = tagInput.trim();
              if (!t) return;
              const next = Array.from(new Set([...(values.tags || []), t]));
              dispatch({ type: "SET_FIELD", field: "tags", value: next });
              setTagInput("");
            }}
          >
            Dodaj
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2" id="tags">
          {(values.tags || []).map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-2 px-2 py-1 text-xs rounded-md border bg-white text-neutral-900 border-neutral-300"
            >
              {t}
              <button
                type="button"
                className="text-neutral-500 hover:text-neutral-800"
                onClick={() => {
                  const next = (values.tags || []).filter((x) => x !== t);
                  dispatch({ type: "SET_FIELD", field: "tags", value: next });
                }}
                aria-label={`Usuń tag ${t}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {errors.tags && (
          <p className="text-xs text-red-600" role="alert">
            {errors.tags}
          </p>
        )}
      </div>

      <SubmitButton loading={submitting} label="Utwórz zajęcia" disabled={disableSubmit} />
    </form>
  );
};

export default AdminActivityCreateForm;
