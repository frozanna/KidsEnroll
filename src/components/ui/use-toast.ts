import { useCallback } from "react";

// Lightweight toast dispatch system using CustomEvent (avoids extra deps).
// Consumers call toast(opts). The Toaster component listens for 'app:toast' events.

export type ToastVariant = "default" | "destructive" | "success" | "info";

export interface ToastPayload {
  id?: string; // optional external id
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // ms
}

export interface ToastHandle extends ToastPayload {
  id: string; // guaranteed id
  createdAt: number;
}

function emitToast(payload: ToastPayload) {
  const detail: ToastHandle = {
    id: payload.id || crypto.randomUUID(),
    createdAt: Date.now(),
    ...payload,
  };
  window.dispatchEvent(new CustomEvent("app:toast", { detail }));
  return detail.id;
}

export function useToast() {
  const toast = useCallback((payload: ToastPayload) => emitToast(payload), []);
  return { toast };
}

// Imperative helper for non-React contexts if ever needed.
export const toast = emitToast;
