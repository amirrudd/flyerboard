import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Reactive numeric app-setting read, managed from Admin > Settings
 * (`convex/appSettings.ts`). Values are clamped to their valid range on the server
 * for known boost keys, so the client can never see an out-of-range value.
 *
 * Returns `undefined` while the query is loading OR when the key doesn't exist —
 * callers should fall back to the shared default constant (e.g. `BOOST_COOLDOWN_MS`)
 * in both cases, exactly as the server does.
 */
export function useAppSetting(key: string): number | undefined {
  const value = useQuery(api.appSettings.getSetting, { key });
  // useQuery → undefined while loading; getSetting → null when the key is missing.
  return value == null ? undefined : value;
}
