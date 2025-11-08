// Simple wrapper for shadcn/ui toast system (placeholder until integrated)
// In a real setup, we'd import useToast from the UI library. Here we simulate with console + optional global event.
import { useCallback } from "react";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success" | "info";
}

export function useToastFeedback() {
  const push = useCallback((opts: ToastOptions) => {
    // Placeholder: Replace with real toast dispatch (e.g., useToast().toast({...}))
    // eslint-disable-next-line no-console
    console.log("TOAST", JSON.stringify(opts));
  }, []);

  const error = useCallback(
    (message: string, description?: string) => {
      push({ title: "Błąd", description: description || message, variant: "destructive" });
    },
    [push]
  );

  const success = useCallback(
    (message: string, description?: string) => {
      push({ title: "Sukces", description: description || message, variant: "success" });
    },
    [push]
  );

  const info = useCallback(
    (message: string, description?: string) => {
      push({ title: "Info", description: description || message, variant: "info" });
    },
    [push]
  );

  return { error, success, info };
}
