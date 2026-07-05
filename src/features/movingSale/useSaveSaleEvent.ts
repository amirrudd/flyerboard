import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useSaveToggle } from "../../hooks/useSaveToggle";

/**
 * Bookmarking a whole Sale — shared between both public sale-page designs
 * (PublicSaleView / PublicSaleViewEditorial) so the save behavior stays
 * identical across the A/B test. Binds the sale queries to the shared
 * optimistic toggle in `useSaveToggle`.
 */
export function useSaveSaleEvent(saleEventId: Id<"saleEvents"> | undefined) {
  const isSaved = useQuery(
    api.saleEvents.isSaleEventSaved,
    saleEventId ? { saleEventId } : "skip"
  );
  const saveSaleEvent = useMutation(api.saleEvents.saveSaleEvent);
  return useSaveToggle({
    isSaved,
    toggle: () => {
      if (!saleEventId) return Promise.reject(new Error("No sale"));
      return saveSaleEvent({ saleEventId });
    },
    noun: "sale",
  });
}
