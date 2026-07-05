import { useState } from "react";
import { useQuery } from "convex/react";
import { useAnimation } from "framer-motion";
import { useSession } from "@descope/react-sdk";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { useMotionPrefs } from "./useMotionPrefs";

interface UseSaveToggleOptions {
  /** Live saved-state from the entity's isXSaved query (undefined while loading). */
  isSaved: boolean | undefined;
  /** The entity's toggle mutation, pre-bound to its id. */
  toggle: () => Promise<{ saved: boolean }>;
  /** "sale" / "bundle" — drives the toast copy. */
  noun: string;
}

/**
 * Optimistic bookmark toggle shared by every savable entity (Sales, Bundles;
 * AdDetail's inline handleSave predates it). One place owns the optimistic
 * update/reset dance, the toast copy shape, and the reduced-motion-aware
 * "pop" animation — entity hooks are thin wrappers that bind the queries.
 */
export function useSaveToggle({ isSaved, toggle, noun }: UseSaveToggleOptions) {
  const { reduced } = useMotionPrefs();
  const { isAuthenticated } = useSession();
  // Signed-in check for the toast gate; skipped entirely for anonymous
  // visitors so public pages don't open a needless subscription.
  const convexUser = useQuery(api.descopeAuth.getCurrentUser, isAuthenticated ? {} : "skip");
  const user = isAuthenticated ? convexUser : null;

  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);
  const displaySaved = optimisticSaved !== null ? optimisticSaved : (isSaved ?? false);
  const bookmarkControls = useAnimation();

  async function toggleSaved() {
    if (!user) {
      toast.error(`Please sign in to save this ${noun}`);
      return;
    }
    setOptimisticSaved(!displaySaved);
    try {
      const result = await toggle();
      toast.success(
        result.saved
          ? `${noun[0].toUpperCase()}${noun.slice(1)} saved!`
          : `${noun[0].toUpperCase()}${noun.slice(1)} removed from saved`
      );
      if (result.saved && !reduced) {
        void bookmarkControls.start({
          scale: [1, 1.35, 0.9, 1],
          transition: { duration: 0.3, ease: "easeOut" },
        });
      }
      setOptimisticSaved(null);
    } catch {
      setOptimisticSaved(null);
      toast.error(`Failed to save ${noun}`);
    }
  }

  return { displaySaved, toggleSaved, bookmarkControls };
}
