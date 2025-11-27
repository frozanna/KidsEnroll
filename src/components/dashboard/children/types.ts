// Types dedicated to ChildForm (frontend only abstraction)
// Keep separate from shared API types in `src/types.ts`.

export type ChildFormMode = "create" | "edit";

export interface ChildFormValues {
  first_name: string;
  last_name: string;
  birth_date: string; // YYYY-MM-DD
  description?: string | null; // optional
}

export interface ChildFormErrors {
  first_name?: string;
  last_name?: string;
  birth_date?: string;
  description?: string;
  _global?: string[]; // non-field errors
}

export interface ChildFormState {
  values: ChildFormValues;
  errors: ChildFormErrors;
  submitting: boolean;
  submitSuccess: boolean;
}

export interface ApiErrorDTO {
  code: string;
  message: string;
  status?: number;
  details?: Record<string, unknown>;
}

export interface ChildFormProps {
  mode: ChildFormMode;
  initialData?: ChildFormValues; // Provided in edit mode via SSR
  childId?: number; // Required for edit PATCH endpoint
  onSuccessRedirect?: string; // default: /app/dashboard
}
