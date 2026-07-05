import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAnimation } from "framer-motion";
import { useSession } from "@descope/react-sdk";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";

/**
 * Bookmarking a whole Bundle — mirrors useSaveSaleEvent (Moving Sale) exactly,
 * just for saleBundles: optimistic toggle, toast, and the bookmark "pop"
 * animation, all reduced-motion aware.
 */
export function useSaveBundle(bundleId: Id<"saleBundles"> | undefined) {
  const { reduced } = useMotionPrefs();
  const { isAuthenticated } = useSession();
  const convexUser = useQuery(api.descopeAuth.getCurrentUser);
  const user = isAuthenticated ? convexUser : null;

  const isSavedQuery = useQuery(
    api.bundles.isBundleSaved,
    bundleId ? { bundleId } : "skip"
  );
  const saveBundle = useMutation(api.bundles.saveBundle);
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);
  const displaySaved = optimisticSaved !== null ? optimisticSaved : (isSavedQuery ?? false);
  const bookmarkControls = useAnimation();

  async function toggleSaved() {
    if (!bundleId) return;
    if (!user) {
      toast.error("Please sign in to save this bundle");
      return;
    }
    const next = !displaySaved;
    setOptimisticSaved(next);
    try {
      const result = await saveBundle({ bundleId });
      toast.success(result.saved ? "Bundle saved!" : "Bundle removed from saved");
      if (result.saved && !reduced) {
        void bookmarkControls.start({
          scale: [1, 1.35, 0.9, 1],
          transition: { duration: 0.3, ease: "easeOut" },
        });
      }
      setOptimisticSaved(null);
    } catch {
      setOptimisticSaved(null);
      toast.error("Failed to save bundle");
    }
  }

  return { displaySaved, toggleSaved, bookmarkControls };
}
