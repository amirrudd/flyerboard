import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useSaveToggle } from "../../hooks/useSaveToggle";

/** Bookmarking a whole Bundle — binds the bundle queries to the shared toggle. */
export function useSaveBundle(bundleId: Id<"saleBundles">) {
  const isSaved = useQuery(api.bundles.isBundleSaved, { bundleId });
  const saveBundle = useMutation(api.bundles.saveBundle);
  return useSaveToggle({
    isSaved,
    toggle: () => saveBundle({ bundleId }),
    noun: "bundle",
  });
}
