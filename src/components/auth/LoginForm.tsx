import * as React from "react";
import { z } from "zod";
import { TextField } from "@/components/form/TextField";
import { SubmitButton } from "@/components/form/SubmitButton";
import { ValidationErrors } from "@/components/form/ValidationErrors";
import { Button } from "@/components/ui/button";

const schema = z.object({
  email: z.string().email({ message: "Nieprawidłowy email" }),
  password: z.string(),
});

interface State {
  values: { email: string; password: string };
  errors: Record<string, string | string[] | undefined>;
  submitting: boolean;
}

export const LoginForm: React.FC<{ onSuccessRedirect?: string }> = ({ onSuccessRedirect = "/app/dashboard" }) => {
  const [state, setState] = React.useState<State>({
    values: { email: "", password: "" },
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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        // Zgodnie z polityką: zawsze ogólny komunikat
        setState((s) => ({ ...s, submitting: false, errors: { _global: ["Nieprawidłowe dane logowania"] } }));
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { redirectTo?: string };
      window.location.href = data.redirectTo || onSuccessRedirect;
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
            label="Email"
            name="email"
            type="email"
            required
            value={values.email}
            error={errors.email as string | undefined}
            onChange={(v) => setField("email", v)}
          />
          <TextField
            label="Hasło"
            name="password"
            type="password"
            required
            value={values.password}
            error={errors.password as string | undefined}
            onChange={(v) => setField("password", v)}
          />
          <div className="flex items-center justify-center">
            <Button variant="link" asChild>
              <a href="/auth/reset">Nie pamiętasz hasła?</a>
            </Button>
          </div>
          <Button type="button" variant="secondary" asChild>
            <a href="/auth/register">Nie masz konta? Zarejestruj się</a>
          </Button>
          <SubmitButton label="Zaloguj" loading={submitting} disabled={submitting} />
        </form>
      </div>
    </section>
  );
};

export default LoginForm;
