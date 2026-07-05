import type { ReactNode } from "react";
import { CaretLeft, X } from "@phosphor-icons/react";

interface WizardShellProps {
  /** 0-based index of the active step (drives the progress dots). Ignored when the header is hidden. */
  currentStep: number;
  /** Total number of progress dots to render. */
  totalSteps: number;
  onBack: () => void;
  onExit: () => void;
  /** Tailwind class for the "reached" progress dot. Defaults to the brand primary. */
  accentClassName?: string;
  /**
   * Render the sticky back/progress/exit chrome. Full-bleed steps (e.g. a wizard's
   * intro/share screens) pass `false` and provide their own close affordance.
   */
  showHeader?: boolean;
  children: ReactNode;
}

/**
 * Shared full-screen wizard shell for the /sell flows (BundleFlow, MovingSaleFlow).
 *
 * Fixed-height flex column with an internal scroll region: the app disables body
 * scroll at <=768px (src/index.css), so step content — and its primary CTA — must
 * own its own scroll container (`.mobile-scroll-container`) or it becomes unreachable
 * on narrow viewports. Guarded by e2e/wizard-mobile-scroll.spec.ts and the BundleFlow
 * scroll-container test.
 */
export function WizardShell({
  currentStep,
  totalSteps,
  onBack,
  onExit,
  accentClassName = "bg-primary",
  showHeader = true,
  children,
}: WizardShellProps) {
  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      {showHeader && (
        <header
          className="shrink-0 border-b border-border bg-background/95 backdrop-blur"
          style={{ paddingTop: "var(--safe-area-inset-top)" }}
        >
          <div className="mx-auto flex max-w-md items-center gap-3 px-3 py-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
            >
              <CaretLeft size={20} />
            </button>
            <div className="flex flex-1 items-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i <= currentStep ? accentClassName : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onExit}
              aria-label="Exit"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X size={20} />
            </button>
          </div>
        </header>
      )}

      <div className="mobile-scroll-container flex-1">{children}</div>
    </div>
  );
}

export default WizardShell;
