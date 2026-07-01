import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAnimation } from "framer-motion";
import { useSession } from "@descope/react-sdk";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";

/**
 * Bookmarking a whole Sale — shared between both public sale-page designs
 * (PublicSaleView / PublicSaleViewEditorial) so the save behavior, optimistic
 * update, and "pop" animation stay identical across the A/B test. Mirrors
 * AdDetail's handleSave/heartControls pattern exactly, just for saleEvents.
 */
export function useSaveSaleEvent(saleEventId: Id<"saleEvents"> | undefined) {
  const { reduced } = useMotionPrefs();
  const { isAuthenticated } = useSession();
  const convexUser = useQuery(api.descopeAuth.getCurrentUser);
  const user = isAuthenticated ? convexUser : null;

  const isSavedQuery = useQuery(
    api.saleEvents.isSaleEventSaved,
    saleEventId ? { saleEventId } : "skip"
  );
  const saveSaleEvent = useMutation(api.saleEvents.saveSaleEvent);
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);
  const displaySaved = optimisticSaved !== null ? optimisticSaved : (isSavedQuery ?? false);
  const bookmarkControls = useAnimation();

  async function toggleSaved() {
    if (!saleEventId) return;
    if (!user) {
      toast.error("Please sign in to save this sale");
      return;
    }
    const next = !displaySaved;
    setOptimisticSaved(next);
    try {
      const result = await saveSaleEvent({ saleEventId });
      toast.success(result.saved ? "Sale saved!" : "Sale removed from saved");
      if (result.saved && !reduced) {
        void bookmarkControls.start({
          scale: [1, 1.35, 0.9, 1],
          transition: { duration: 0.3, ease: "easeOut" },
        });
      }
      setOptimisticSaved(null);
    } catch {
      setOptimisticSaved(null);
      toast.error("Failed to save sale");
    }
  }

  return { displaySaved, toggleSaved, bookmarkControls };
}
