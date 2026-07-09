import { useCallback, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useAnimationControls } from "framer-motion";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAppSetting } from "./useAppSetting";
import { useMotionPrefs } from "./useMotionPrefs";
import { useMarketplace } from "../context/MarketplaceContext";
import {
  DEFAULT_BOOST_COOLDOWN_DAYS,
  SETTING_BOOST_COOLDOWN_DAYS,
  MS_PER_DAY,
} from "../../convex/lib/boost";

/** Display state of the Boost CTA for a single ad. Server re-checks authoritatively. */
export type BoostState = "eligible" | "cooldown" | "ineligible";

/** Minimal ad shape the Boost CTA needs — satisfied by both `getUserAds` docs and `getAdWithContext`. */
export interface BoostableAd {
  _id: Id<"ads">;
  bumpedAt: number;
  isActive?: boolean;
  isSold?: boolean;
  saleEventId?: unknown;
  bundleId?: unknown;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Shared owner-facing Boost logic for the dashboard My-Ads card and the ad-detail
 * owner surfaces. Owns: reactive cooldown math (from the admin-tunable
 * `boostCooldownDays` setting, code-default fallback), the confirm-modal open state,
 * the double-tap-guarded mutation call, and the success "launch" animation state.
 *
 * The three display states:
 *   - `eligible`   → show the filled-primary "Boost to top" button.
 *   - `cooldown`   → show a disabled "Boost in Xd" (days ≥24h out, hours in the
 *                    final day so it never reads a stale "1d" all day).
 *   - `ineligible` → render nothing (sold / bundled / in a sale / inactive).
 *
 * Eligibility here is DISPLAY ONLY; `api.posts.boostAd` re-validates everything
 * (flag, ownership, eligibility, cooldown, daily cap) server-side.
 *
 * Accepts `ad | null | undefined` so callers ahead of a loading early return (e.g.
 * AdDetail) can call it unconditionally per the rules of hooks.
 */
export function useBoostAction(ad: BoostableAd | null | undefined) {
  const boostAd = useMutation(api.posts.boostAd);
  const { refreshAds } = useMarketplace();
  const { reduced, boostLaunch } = useMotionPrefs();
  const cardControls = useAnimationControls();

  // Reactive: admin edits to the cooldown propagate live; undefined (loading/missing)
  // falls back to the shared code default, exactly as the server does.
  const cooldownDays = useAppSetting(SETTING_BOOST_COOLDOWN_DAYS) ?? DEFAULT_BOOST_COOLDOWN_DAYS;

  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isBoosting, setBoosting] = useState(false);
  // Local override so the button flips to the cooldown state instantly on success,
  // without waiting for the reactive getUserAds/getAdWithContext round-trip.
  const [localBumpedAt, setLocalBumpedAt] = useState<number | null>(null);
  const [showArrow, setShowArrow] = useState(false);
  const [ringKey, setRingKey] = useState(0);

  // Current time as reactive state (Date.now() in the render body is impure and
  // banned by react-hooks/purity). Seeded lazily, refreshed each minute so the
  // "Boost in Xd/Xh" label rolls over on its own — pattern from useCountdown.ts.
  // The interval is gated below to run ONLY while this ad is in cooldown.
  const [now, setNow] = useState(() => Date.now());

  // Loading guard only: `bumpedAt` is a required field on loaded ads (never fall
  // back for a present ad). While `ad` is undefined, state is "ineligible" anyway.
  const baseBumpedAt = ad ? ad.bumpedAt : now;
  const effectiveBumpedAt =
    localBumpedAt != null ? Math.max(baseBumpedAt, localBumpedAt) : baseBumpedAt;

  const stateIneligible =
    !ad || ad.isActive === false || ad.isSold === true || !!ad.saleEventId || !!ad.bundleId;

  const cooldownMs = cooldownDays * MS_PER_DAY;
  const remaining = cooldownMs - (now - effectiveBumpedAt);

  let state: BoostState;
  if (stateIneligible) state = "ineligible";
  else if (remaining > 0) state = "cooldown";
  else state = "eligible";

  // Only tick while a countdown is actually shown. The final tick that drives
  // `remaining` to <=0 flips `state` to "eligible", which tears the interval
  // down — so a card transitions cooldown→eligible on its own, then stops
  // paying for a per-minute timer for the rest of its life (one hook instance
  // per dashboard card, so an always-on interval was N idle timers).
  const inCooldown = state === "cooldown";
  useEffect(() => {
    if (!inCooldown) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [inCooldown]);

  let cooldownLabel = "";
  let cooldownAria = "";
  if (remaining > 0) {
    if (remaining >= MS_PER_DAY) {
      const days = Math.ceil(remaining / MS_PER_DAY);
      cooldownLabel = `Boost in ${days}d`;
      cooldownAria = `You can boost this flyer again in ${days} day${days === 1 ? "" : "s"}.`;
    } else {
      const hours = Math.max(1, Math.ceil(remaining / HOUR_MS));
      cooldownLabel = `Boost in ${hours}h`;
      cooldownAria = `You can boost this flyer again in ${hours} hour${hours === 1 ? "" : "s"}.`;
    }
  }

  // Success-launch animation payload (ring/arrow props for render, `lift` for the
  // card control). Computed once in the render body and shared with the callback.
  const fx = boostLaunch();

  const confirmBoost = useCallback(async () => {
    if (!ad || isBoosting) return; // double-tap guard
    setBoosting(true);
    try {
      await boostAd({ adId: ad._id });
      // Success ONLY past this point — never celebrate a rejected boost.
      setConfirmOpen(false);
      setLocalBumpedAt(Date.now());
      void cardControls.start(fx.lift);
      setRingKey((k) => k + 1);
      if (!reduced) {
        setShowArrow(true);
        window.setTimeout(() => setShowArrow(false), 550);
      }
      toast.success("You're back on top of the board 🎉");
      // Forced refresh so the booster's own feed reflects the jump (Phase 2 seam).
      void refreshAds(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Couldn't boost this flyer";
      toast.error(message);
    } finally {
      setBoosting(false);
    }
  }, [ad, boostAd, cardControls, fx, isBoosting, reduced, refreshAds]);

  return {
    state,
    cooldownLabel,
    cooldownAria,
    cooldownDays,
    isConfirmOpen,
    openConfirm: () => setConfirmOpen(true),
    closeConfirm: () => setConfirmOpen(false),
    confirmBoost,
    isBoosting,
    // Success-launch animation wiring:
    cardControls,
    showArrow,
    ringKey,
    ringProps: fx.ring,
    arrowProps: fx.arrow,
  };
}
