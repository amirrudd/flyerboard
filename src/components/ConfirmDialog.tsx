import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: ReactNode;
  /** Confirm-button text while `busy` (defaults to confirmLabel). */
  busyLabel?: ReactNode;
  cancelLabel?: string;
  /** Destructive styling for the title + confirm button (e.g. account deletion). */
  danger?: boolean;
  /** Disables both buttons and backdrop-cancel while the action is in flight. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shared portal-based confirm dialog: blurred backdrop, rounded-2xl card,
 * Cancel/confirm button pair. Backdrop click cancels (unless busy).
 * Deliberately no focus trap — parity with the hand-rolled modals it replaced.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  busyLabel,
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={() => !busy && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card-hover p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className={`font-display text-2xl font-semibold tracking-tight mb-3 ${danger ? "text-destructive" : "text-foreground"}`}
        >
          {title}
        </h2>
        <p className="text-[15px] leading-relaxed text-foreground/75 mb-6 max-w-prose">
          {body}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 inline-flex items-center justify-center h-11 px-4 rounded-full bg-muted/40 ring-1 ring-border text-foreground font-medium hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`flex-1 inline-flex items-center justify-center h-11 px-4 rounded-full font-semibold shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all disabled:opacity-50 ${
              danger
                ? "bg-destructive text-destructive-foreground shadow-destructive/25 hover:bg-destructive/90 focus-visible:ring-destructive"
                : "bg-primary text-primary-foreground shadow-primary/25 hover:bg-primary/90 focus-visible:ring-ring"
            }`}
          >
            {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
