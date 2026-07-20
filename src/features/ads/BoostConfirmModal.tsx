import { ConfirmDialog } from "../../components/ConfirmDialog";

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
 * Thin wrapper over ConfirmDialog; the confirm button is `bg-primary`, NOT the
 * delete modal's destructive red — boosting is a positive, reversible action.
 * Copy is fixed per the Phase 3 UX decisions; the "It's free" line is
 * load-bearing (Terms mention paid boost, so users hesitate).
 */
export function BoostConfirmModal({
  open,
  cooldownDays,
  isBoosting,
  onConfirm,
  onCancel,
}: BoostConfirmModalProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Boost this flyer?"
      body={
        <>
          This pushes your flyer back to the top of the board, so it&apos;s the
          first thing people see again. It&apos;s free — you can boost again in{" "}
          {cooldownDays} days.
        </>
      }
      confirmLabel="Boost to top"
      cancelLabel="Not now"
      busy={isBoosting}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
