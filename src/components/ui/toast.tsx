import React, { useEffect, useState, useCallback } from "react";
import type { ToastHandle, ToastVariant } from "./use-toast";
import { X } from "lucide-react";
import clsx from "clsx";

interface InternalToast extends ToastHandle {
  expiresAt?: number;
}

const baseStyle =
  "pointer-events-auto w-[320px] rounded-md border shadow-sm px-4 py-3 mb-3 bg-sidebar text-sm dark:bg-neutral-900 dark:border-neutral-800 flex gap-3 items-start animate-fade-in";

function variantClasses(variant: ToastVariant | undefined) {
  switch (variant) {
    case "destructive":
      return "border-red-500 bg-red-50 text-red-900 dark:bg-red-950";
    case "success":
      return "border-green-500 bg-green-50 text-green-900 dark:bg-green-950";
    case "info":
      return "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950";
    default:
      return "border-neutral-300 dark:border-neutral-700";
  }
}

export const Toaster: React.FC = () => {
  const [items, setItems] = useState<InternalToast[]>([]);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    function handler(e: Event) {
      const custom = e as CustomEvent<ToastHandle>;
      const { detail } = custom;
      const duration = detail.duration ?? 4000;
      setItems((prev) => [...prev, { ...detail, expiresAt: Date.now() + duration }]);
    }
    window.addEventListener("app:toast", handler);
    return () => window.removeEventListener("app:toast", handler);
  }, []);

  // Auto dismiss
  useEffect(() => {
    if (!items.length) return;
    const now = Date.now();
    const nextExpiry = Math.min(...items.map((i) => i.expiresAt || Infinity));
    const delay = Math.max(0, nextExpiry - now);
    const id = window.setTimeout(() => {
      setItems((prev) => prev.filter((i) => (i.expiresAt || Infinity) > Date.now()));
    }, delay + 50);
    return () => window.clearTimeout(id);
  }, [items]);

  if (!items.length) return null;

  return (
    <div
      className="fixed z-50 top-4 right-4 flex flex-col items-end max-w-full w-[320px]"
      role="region"
      aria-label="Powiadomienia"
    >
      <div className="sr-only" aria-live="polite" />
      {items.map((t) => (
        <div key={t.id} role="status" aria-atomic="true" className={clsx(baseStyle, variantClasses(t.variant))}>
          <div className="flex-1">
            {t.title && (
              <p className="font-medium mb-0 leading-none" data-variant={t.variant}>
                {t.title}
              </p>
            )}
            {t.description && <p className="mt-1 text-[13px] leading-relaxed">{t.description}</p>}
          </div>
          <button
            type="button"
            aria-label="Zamknij powiadomienie"
            onClick={() => remove(t.id)}
            className="mt-0 ml-2 inline-flex h-5 w-5 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
