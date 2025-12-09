import * as React from "react";
import { z } from "zod";
import { TextField } from "@/components/form/TextField";
import { SubmitButton } from "@/components/form/SubmitButton";
import { ValidationErrors } from "@/components/form/ValidationErrors";
import { Button } from "@/components/ui/button";
import { useToastFeedback } from "@/components/ui/useToastFeedback";

const schema = z
  .object({
    email: z.string().email({ message: "Nieprawidłowy email" }),
    password: z
      .string()
      .min(8, { message: "Hasło min. 8 znaków" })
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: "Hasło musi zawierać literę i cyfrę" }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Hasła muszą być takie same",
  });

interface State {
  values: { email: string; password: string; confirmPassword: string };
  errors: Record<string, string | string[] | undefined>;
  submitting: boolean;
}

export const RegisterForm: React.FC<{ onSuccessRedirect?: string }> = ({
  onSuccessRedirect = "/app/onboarding/child",
}) => {
  const [state, setState] = React.useState<State>({
    values: { email: "", password: "", confirmPassword: "" },
    errors: {},
    submitting: false,
  });
  const { success } = useToastFeedback();

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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: parsed.data.email,
          password: parsed.data.password,
          confirmPassword: parsed.data.confirmPassword,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = (data && data.message) || "Rejestracja nieudana";
        setState((s) => ({ ...s, submitting: false, errors: { _global: [message] } }));
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { redirectTo?: string };
      success("Konto utworzone", "Sprawdź skrzynkę, aby potwierdzić adres email");
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
          <TextField
            label="Powtórz hasło"
            name="confirmPassword"
            type="password"
            required
            value={values.confirmPassword}
            error={errors.confirmPassword as string | undefined}
            onChange={(v) => setField("confirmPassword", v)}
          />
          <div className="flex items-center justify-center">
            <Button variant="link" asChild>
              <a href="/auth/login">Masz konto? Zaloguj się</a>
            </Button>
          </div>
          <SubmitButton label="Zarejestruj się" loading={submitting} disabled={submitting} />
        </form>
      </div>
    </section>
  );
};

export default RegisterForm;
