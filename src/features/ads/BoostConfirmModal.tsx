import { createPortal } from "react-dom";

interface BoostConfirmModalProps {
  open: boolean;
  /** Reactive cooldown length (days) rendered into the body copy — never a literal. */
  cooldownDays: number;
  /** Disables the confirm button while the boost mutation is in flight (double-tap guard). */
  isBoosting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shared Boost confirmation modal for the dashboard and ad-detail owner surfaces.
 * Reuses the delete-modal shell (portal, backdrop, rounded-2xl card, role=dialog) but
 * the confirm button is `bg-primary`, NOT the delete modal's destructive red — boosting
 * is a positive, reversible action. Copy is fixed per the Phase 3 UX decisions; the
 * "It's free" line is load-bearing (Terms mention paid boost, so users hesitate).
 */
export function BoostConfirmModal({
  open,
  cooldownDays,
  isBoosting,
  onConfirm,
  onCancel,
}: BoostConfirmModalProps) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="boost-flyer-title"
    >
      <div
        className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card-hover p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="boost-flyer-title"
          className="font-display text-2xl font-semibold tracking-tight text-foreground mb-3"
        >
          Boost this flyer?
        </h2>
        <p className="text-[15px] leading-relaxed text-foreground/75 mb-6 max-w-prose">
          This pushes your flyer back to the top of the board, so it&apos;s the first thing
          people see again. It&apos;s free — you can boost again in {cooldownDays} days.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 inline-flex items-center justify-center h-11 px-4 rounded-full bg-muted/40 ring-1 ring-border text-foreground font-medium hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all"
          >
            Not now
          </button>
          <button
            type="button"
            disabled={isBoosting}
            onClick={onConfirm}
            className="flex-1 inline-flex items-center justify-center h-11 px-4 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
          >
            Boost to top
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
