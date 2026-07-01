import { useEffect, useState } from "react";

export interface Countdown {
  days: number;
  hours: number;
  mins: number;
  secs: number;
  /** Pickup window has started (target time reached). */
  isLive: boolean;
}

/**
 * Live countdown to a target timestamp, ticking every second.
 * Used on the buyer sale page — the single strongest urgency lever in the UX.
 */
export function useCountdown(target: number): Countdown {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, target - now);
  const isLive = target - now <= 0;

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);

  return { days, hours, mins, secs, isLive };
}
