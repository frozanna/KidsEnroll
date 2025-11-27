import * as React from "react";
import { z } from "zod";
import type { ProfileDTO, ErrorResponseDTO } from "@/types";
import { updateProfileSchema } from "@/lib/validation/profile.schema";
import { TextField } from "@/components/form/TextField";
import { ValidationErrors } from "@/components/form/ValidationErrors";
import { SubmitButton } from "@/components/form/SubmitButton";
import { useToastFeedback } from "@/components/useToastFeedback";

interface ParentProfileFormValues {
  first_name: string;
  last_name: string;
}

interface ParentProfileFormState {
  values: ParentProfileFormValues;
  touched: {
    first_name: boolean;
    last_name: boolean;
  };
  fieldErrors: Partial<Record<keyof ParentProfileFormValues, string>>;
  globalErrors: string[];
  dirty: boolean;
  status: "idle" | "submitting" | "success" | "error";
}

interface ApiErrorView {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

interface ParentProfileFormProps {
  initialProfile: ProfileDTO;
}

const mapZodErrorToFieldErrors = (error: z.ZodError): ApiErrorView => {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const pathKey = issue.path[0];
    if (typeof pathKey === "string" && !fieldErrors[pathKey]) {
      fieldErrors[pathKey] = issue.message;
    }
  }
  return { code: "VALIDATION_ERROR", message: "Invalid form data", fieldErrors };
};

export const ParentProfileForm: React.FC<ParentProfileFormProps> = ({ initialProfile }) => {
  const { success, error } = useToastFeedback();

  const [state, setState] = React.useState<ParentProfileFormState>(() => ({
    values: {
      first_name: initialProfile.first_name,
      last_name: initialProfile.last_name,
    },
    touched: { first_name: false, last_name: false },
    fieldErrors: {},
    globalErrors: [],
    dirty: false,
    status: "idle",
  }));

  const initialValuesRef = React.useRef<ParentProfileFormValues>({
    first_name: initialProfile.first_name,
    last_name: initialProfile.last_name,
  });

  React.useEffect(() => {
    initialValuesRef.current = {
      first_name: initialProfile.first_name,
      last_name: initialProfile.last_name,
    };
    setState((prev) => ({
      ...prev,
      values: { ...initialValuesRef.current },
      dirty: false,
      status: "idle",
      globalErrors: [],
      fieldErrors: {},
    }));
  }, [initialProfile.first_name, initialProfile.last_name]);

  const validateLocal = React.useCallback((values: ParentProfileFormValues): ApiErrorView | null => {
    const parsed = updateProfileSchema.safeParse(values);
    if (parsed.success) {
      return null;
    }
    return mapZodErrorToFieldErrors(parsed.error);
  }, []);

  const handleFieldChange = (field: keyof ParentProfileFormValues, value: string) => {
    setState((prev) => {
      const nextValues = { ...prev.values, [field]: value };
      const isDirty =
        nextValues.first_name !== initialValuesRef.current.first_name ||
        nextValues.last_name !== initialValuesRef.current.last_name;

      const validation = validateLocal(nextValues);
      const nextFieldErrors: ParentProfileFormState["fieldErrors"] = { ...prev.fieldErrors };
      const nextGlobalErrors: string[] = [];

      if (validation?.fieldErrors) {
        (Object.entries(validation.fieldErrors) as [keyof ParentProfileFormValues, string][]).forEach(
          ([key, message]) => {
            nextFieldErrors[key] = message;
          }
        );
      } else {
        nextFieldErrors.first_name = undefined;
        nextFieldErrors.last_name = undefined;
      }

      return {
        ...prev,
        values: nextValues,
        dirty: isDirty,
        fieldErrors: nextFieldErrors,
        globalErrors: nextGlobalErrors,
      };
    });
  };

  const handleBlur = (field: keyof ParentProfileFormValues) => {
    setState((prev) => ({
      ...prev,
      touched: { ...prev.touched, [field]: true },
    }));
  };

  const hasFieldError = (field: keyof ParentProfileFormValues) => {
    if (!state.touched[field]) return false;
    return !!state.fieldErrors[field];
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setState((prev) => ({ ...prev, status: "submitting", globalErrors: [] }));

    const validation = validateLocal(state.values);
    if (validation) {
      setState((prev) => ({
        ...prev,
        status: "error",
        fieldErrors: {
          ...prev.fieldErrors,
          ...(validation.fieldErrors as ParentProfileFormState["fieldErrors"]),
        },
        globalErrors: [validation.message],
        touched: { first_name: true, last_name: true },
      }));
      return;
    }

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.values),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (data && (data as ErrorResponseDTO).error) {
          const typed = data as ErrorResponseDTO;
          const issues = typed.error.details?.issues as z.ZodIssue[] | undefined;
          const fieldErrorsFromIssues: Record<string, string> = {};
          if (issues) {
            for (const issue of issues) {
              const key = issue.path[0];
              if (typeof key === "string" && !fieldErrorsFromIssues[key]) {
                fieldErrorsFromIssues[key] = issue.message;
              }
            }
          }

          const apiErr: ApiErrorView = {
            code: typed.error.code,
            message: typed.error.message,
            fieldErrors: fieldErrorsFromIssues,
          };

          setState((prev) => ({
            ...prev,
            status: "error",
            fieldErrors: {
              ...prev.fieldErrors,
              ...(apiErr.fieldErrors as ParentProfileFormState["fieldErrors"]),
            },
            globalErrors: [apiErr.message],
          }));

          if (apiErr.code === "AUTH_UNAUTHORIZED") {
            error("Brak dostępu", apiErr.message);
          } else if (apiErr.code === "PARENT_NOT_FOUND") {
            error("Profil nie został znaleziony", apiErr.message);
          } else {
            error("Nie udało się zaktualizować profilu", apiErr.message);
          }
        } else {
          setState((prev) => ({
            ...prev,
            status: "error",
            globalErrors: ["Wystąpił nieoczekiwany błąd"],
          }));
          error("Nie udało się zaktualizować profilu");
        }
        return;
      }

      const updated: ProfileDTO = await response.json();

      initialValuesRef.current = {
        first_name: updated.first_name,
        last_name: updated.last_name,
      };

      setState((prev) => ({
        ...prev,
        values: { ...initialValuesRef.current },
        dirty: false,
        status: "success",
        fieldErrors: {},
        globalErrors: [],
      }));

      success("Profil został zaktualizowany");
    } catch {
      setState((prev) => ({
        ...prev,
        status: "error",
        globalErrors: ["Błąd sieci lub serwera"],
      }));
      error("Nie udało się zaktualizować profilu");
    }
  };

  const isSubmitDisabled =
    !state.dirty || state.status === "submitting" || Object.values(state.fieldErrors).some(Boolean);

  const emailFieldId = React.useId();

  const globalErrorToShow = state.globalErrors.length > 0 ? state.globalErrors : [];

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {globalErrorToShow.length > 0 && <ValidationErrors errors={globalErrorToShow} />}

      {state.status === "submitting" && (
        <p className="text-xs text-neutral-500" aria-live="polite">
          Zapisywanie...
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={emailFieldId} className="text-sm font-medium">
          Email
        </label>
        <input
          id={emailFieldId}
          type="email"
          value={initialProfile.email}
          readOnly
          disabled
          className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">Adres email jest powiązany z kontem i nie można go zmienić.</p>
      </div>

      <TextField
        label="Imię"
        name="first_name"
        required
        value={state.values.first_name}
        onChange={(v) => handleFieldChange("first_name", v)}
        onBlur={() => handleBlur("first_name")}
        error={hasFieldError("first_name") ? state.fieldErrors.first_name : undefined}
      />

      <TextField
        label="Nazwisko"
        name="last_name"
        required
        value={state.values.last_name}
        onChange={(v) => handleFieldChange("last_name", v)}
        onBlur={() => handleBlur("last_name")}
        error={hasFieldError("last_name") ? state.fieldErrors.last_name : undefined}
      />

      <SubmitButton loading={state.status === "submitting"} label="Zapisz zmiany" disabled={isSubmitDisabled} />
    </form>
  );
};

ParentProfileForm.displayName = "ParentProfileForm";
