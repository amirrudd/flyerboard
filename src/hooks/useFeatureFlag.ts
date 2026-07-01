import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Reactive feature-flag check, managed from Admin > Feature Flags
 * (`convex/featureFlags.ts`). Returns `undefined` while loading — callers that
 * need to avoid a flash of hidden/shown content should treat `undefined` as
 * "not yet known" rather than defaulting to enabled or disabled.
 */
export function useFeatureFlag(key: string): boolean | undefined {
  return useQuery(api.featureFlags.getFeatureFlag, { key });
}
