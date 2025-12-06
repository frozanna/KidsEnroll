import * as React from "react";
import { z } from "zod";
import { TextField } from "@/components/form/TextField";
import { SubmitButton } from "@/components/form/SubmitButton";
import { ValidationErrors } from "@/components/form/ValidationErrors";

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, { message: "Hasło min. 8 znaków" })
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: "Hasło musi zawierać literę i cyfrę" }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Hasła muszą być takie same",
  });

interface State {
  values: { newPassword: string; confirmPassword: string };
  errors: Record<string, string | string[] | undefined>;
  submitting: boolean;
}

export const UpdatePasswordForm: React.FC = () => {
  const [state, setState] = React.useState<State>({
    values: { newPassword: "", confirmPassword: "" },
    errors: {},
    submitting: false,
  });

  function setField<K extends keyof State["values"]>(field: K, value: string) {
    setState((s) => ({ ...s, values: { ...s.values, [field]: value }, errors: { ...s.errors, [field]: undefined } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(state.values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        const key = err.path[0] as string;
        fieldErrors[key] = err.message;
      });
      setState((s) => ({ ...s, errors: fieldErrors }));
      return;
    }
    setState((s) => ({ ...s, submitting: true, errors: {} }));
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: parsed.data.newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = (data && data.message) || "Nie udało się zaktualizować hasła";
        setState((s) => ({ ...s, submitting: false, errors: { _global: [message] } }));
        return;
      }
      window.location.href = "/auth/login";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Problem z połączeniem";
      setState((s) => ({ ...s, submitting: false, errors: { _global: [message] } }));
    }
  }

  const { values, errors, submitting } = state;

  return (
    <section role="main" className="space-y-4">
      <div className="rounded-md border p-4">
        {errors._global && (
          <ValidationErrors
            errors={Array.isArray(errors._global) ? (errors._global as string[]) : [String(errors._global)]}
          />
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <TextField
            label="Nowe hasło"
            name="newPassword"
            type="password"
            required
            value={values.newPassword}
            error={errors.newPassword as string | undefined}
            onChange={(v) => setField("newPassword", v)}
          />
          <TextField
            label="Powtórz nowe hasło"
            name="confirmPassword"
            type="password"
            required
            value={values.confirmPassword}
            error={errors.confirmPassword as string | undefined}
            onChange={(v) => setField("confirmPassword", v)}
          />
          <SubmitButton label="Ustaw nowe hasło" loading={submitting} disabled={submitting} />
        </form>
      </div>
    </section>
  );
};

export default UpdatePasswordForm;
