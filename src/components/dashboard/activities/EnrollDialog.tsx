import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
  ActivityViewModel,
  ChildSummary,
  EnrollDialogState,
  EnrollmentRequestPayload,
  EnrollmentErrorKind,
  ApiErrorShape,
} from "./types";
import { Button } from "../../ui/button";
import { useToastFeedback } from "../../ui/useToastFeedback";

// NOTE: API integration & error mapping will be added in subsequent steps (todo #4/#5)

interface EnrollDialogProps {
  open: boolean;
  activity: ActivityViewModel | null;
  childrenList: ChildSummary[];
  onClose: () => void;
  onSuccess?: (resp: unknown) => void; // placeholder; refined later with CreateEnrollmentResponseDTO
}

export const EnrollDialog: React.FC<EnrollDialogProps> = ({ open, activity, childrenList, onClose, onSuccess }) => {
  const [state, setState] = useState<EnrollDialogState>({ isSubmitting: false, success: null, error: null });
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const { error: pushError, success: pushSuccess } = useToastFeedback();

  // Reset state whenever dialog closes or activity changes
  useEffect(() => {
    if (!open) {
      setState({ isSubmitting: false, selectedChildId: undefined, success: null, error: null });
    } else if (open && activity) {
      setState((prev) => ({ ...prev, success: null, error: null }));
    }
  }, [open, activity]);

  const setSelectedChildId = useCallback((id: number) => {
    setState((prev) => ({ ...prev, selectedChildId: id }));
  }, []);

  // Keyboard: ESC to close (unless submitting)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !state.isSubmitting) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, state.isSubmitting, onClose]);

  // Focus trap (basic implementation)
  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    if (!node) return;
    const focusableSelector = [
      "button:not([disabled])",
      'input[type="radio"]:not([disabled])',
      "[href]",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const getFocusable = () => Array.from(node.querySelectorAll<HTMLElement>(focusableSelector));
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    node.addEventListener("keydown", handleKeyDown);
    // Initial focus: first child radio or cancel button
    const radios = node.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    if (radios.length > 0) {
      radios[0].focus();
    } else {
      const cancelBtn = node.querySelector<HTMLButtonElement>("button[data-cancel]");
      cancelBtn?.focus();
    }
    return () => node.removeEventListener("keydown", handleKeyDown);
  }, [open, childrenList.length]);

  // Placeholder submit (will call API later)
  const mapError = useCallback((code: string, message: string): { kind: EnrollmentErrorKind; userMessage: string } => {
    switch (code) {
      case "ACTIVITY_FULL":
        return { kind: "ACTIVITY_FULL", userMessage: "Brak wolnych miejsc na te zajęcia." };
      case "ENROLLMENT_DUPLICATE":
        return { kind: "ALREADY_ENROLLED", userMessage: "To dziecko jest już zapisane na te zajęcia." };
      case "CHILD_NOT_FOUND":
      case "ACTIVITY_NOT_FOUND":
        return { kind: "NOT_FOUND", userMessage: "Nie znaleziono zasobu. Spróbuj odświeżyć stronę." };
      case "CHILD_NOT_OWNED":
      case "ACTIVITY_STARTED":
        return { kind: "FORBIDDEN", userMessage: "Nie możesz zapisać tego dziecka na te zajęcia." };
      case "AUTH_UNAUTHORIZED":
        return { kind: "UNAUTHORIZED", userMessage: "Sesja wygasła. Zaloguj się ponownie." };
      default:
        return { kind: "UNKNOWN", userMessage: message || "Wystąpił nieoczekiwany błąd." };
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!state.selectedChildId || !activity || state.isSubmitting) return;
    setState((prev) => ({ ...prev, isSubmitting: true, error: null }));
    const payload: EnrollmentRequestPayload = {
      child_id: state.selectedChildId,
      activity_id: activity.id,
    };
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const maybeError = (json as Record<string, unknown>)?.error;
        let apiErr: ApiErrorShape | undefined;
        if (maybeError && typeof maybeError === "object") {
          apiErr = maybeError as ApiErrorShape;
        }
        const mapped = mapError(apiErr?.code || "UNKNOWN", apiErr?.message || "Błąd zapisu");
        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          error: { code: apiErr?.code || "UNKNOWN", message: mapped.userMessage, kind: mapped.kind },
        }));
        pushError(mapped.userMessage);
        return;
      }
      setState((prev) => ({ ...prev, isSubmitting: false, success: json }));
      pushSuccess("Zapis zakończony pomyślnie");
      if (onSuccess) onSuccess(json);
      onClose();
    } catch (err: unknown) {
      const mapped = mapError("UNKNOWN", err instanceof Error ? err.message : "Błąd sieci");
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: { code: "UNKNOWN", message: mapped.userMessage, kind: mapped.kind },
      }));
      pushError(mapped.userMessage);
    }
  }, [state.selectedChildId, activity, state.isSubmitting, mapError, pushError, pushSuccess, onSuccess, onClose]);

  if (!open || !activity) return null;

  const overlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !state.isSubmitting) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={overlayClick}
      aria-hidden={!open}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="enroll-dialog-title"
        aria-describedby="enroll-dialog-desc"
        aria-busy={state.isSubmitting || undefined}
        className="w-full max-w-md rounded-md bg-background p-6 shadow-lg focus:outline-none"
      >
        <h2 id="enroll-dialog-title" className="mb-4 text-lg font-semibold">
          Zapis na zajęcia
        </h2>
        <div className="mb-4 rounded-md bg-muted/30 p-3 text-xs leading-relaxed">
          <div>
            <span className="font-medium text-lg">{activity.name}</span>
          </div>
          <div>
            <span className="font-medium ">Termin:</span> {activity.startDateLocal} {activity.startTimeLocal}
          </div>
          <div>
            <span className="font-medium">Koszt:</span> {activity.costFormatted}
          </div>
          <div>
            <span className="font-medium">Miejsca:</span> {activity.availableSpots}/{activity.participantLimit}{" "}
            {activity.isFull && <span className="ml-1 text-destructive">(Brak miejsc)</span>}
          </div>
          {activity.tags.length > 0 && (
            <div className="mt-1">
              <span className="font-medium">Tagi:</span> {activity.tags.join(", ")}
            </div>
          )}
        </div>
        <p id="enroll-dialog-desc" className="mb-2">
          Wybierz dziecko do zapisu:
        </p>
        <div className="mb-4 max-h-48 overflow-y-auto">
          {state.error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-3 rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error.message}
            </div>
          )}
          {childrenList.length === 0 && (
            <div className="text-sm text-muted-foreground">Nie masz jeszcze dodanych dzieci.</div>
          )}
          <ul className="space-y-2">
            {childrenList.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="selectedChild"
                  value={c.id}
                  disabled={state.isSubmitting}
                  checked={state.selectedChildId === c.id}
                  onChange={() => setSelectedChildId(c.id)}
                />
                <span>
                  {c.first_name} {c.last_name}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" data-cancel onClick={onClose} disabled={state.isSubmitting}>
            Anuluj
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!state.selectedChildId || state.isSubmitting}
            aria-disabled={!state.selectedChildId || state.isSubmitting}
          >
            {state.isSubmitting ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </div>
      </div>
    </div>
  );
};
