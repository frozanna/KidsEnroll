// Simple wrapper for shadcn/ui toast system (placeholder until integrated)
// In a real setup, we'd import useToast from the UI library. Here we simulate with console + optional global event.
import { useCallback } from "react";
import { useToast } from "./use-toast";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success" | "info";
}

export function useToastFeedback() {
  const { toast } = useToast();
  const push = useCallback(
    (opts: ToastOptions) => {
      toast({
        title: opts.title || undefined,
        description: opts.description,
        variant: opts.variant,
        duration: 4500,
      });
    },
    [toast]
  );

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
