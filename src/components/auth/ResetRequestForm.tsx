import * as React from "react";
import { z } from "zod";
import { TextField } from "@/components/form/TextField";
import { SubmitButton } from "@/components/form/SubmitButton";
import { ValidationErrors } from "@/components/form/ValidationErrors";
import { Button } from "@/components/ui/button";

const schema = z.object({ email: z.string().email({ message: "Nieprawidłowy email" }) });

interface State {
  values: { email: string };
  errors: Record<string, string | string[]>;
  submitting: boolean;
  info?: string;
}

export const ResetRequestForm: React.FC = () => {
  const [state, setState] = React.useState<State>({ values: { email: "" }, errors: {}, submitting: false });

  function setField(value: string) {
    setState((s) => {
      const { ...restErrors } = s.errors;
      return { ...s, values: { email: value }, errors: restErrors };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(state.values);
    if (!parsed.success) {
      setState((s) => ({ ...s, errors: { email: parsed.error.errors[0]?.message || "Nieprawidłowy email" } }));
      return;
    }
    setState((s) => ({ ...s, submitting: true, errors: {}, info: undefined }));
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = (data && data.message) || "Nie udało się wysłać wiadomości";
        setState((s) => ({ ...s, submitting: false, errors: { _global: [message] } }));
        return;
      }
      setState((s) => ({ ...s, submitting: false, info: "Jeśli email istnieje, wysłaliśmy instrukcje resetu." }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Problem z połączeniem";
      setState((s) => ({ ...s, submitting: false, errors: { _global: [message] } }));
    }
  }

  const { values, errors, submitting, info } = state;

  return (
    <section role="main" className="space-y-4">
      <div className="rounded-md border p-4">
        {errors._global && (
          <ValidationErrors
            errors={Array.isArray(errors._global) ? (errors._global as string[]) : [String(errors._global)]}
          />
        )}
        {info && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {info}
          </p>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <TextField
            label="Email"
            name="email"
            type="email"
            required
            value={values.email}
            error={errors.email as string | undefined}
            onChange={(v) => setField(v)}
          />
          <div className="flex items-center justify-between">
            <Button variant="link" asChild>
              <a href="/auth/login">Wróć do logowania</a>
            </Button>
          </div>
          <SubmitButton label="Wyślij instrukcje" loading={submitting} disabled={submitting} />
        </form>
      </div>
    </section>
  );
};

export default ResetRequestForm;
