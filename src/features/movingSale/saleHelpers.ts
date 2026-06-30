import { format } from "date-fns";

/** Format a number as AUD with no decimals, e.g. 1240 → "$1,240". */
export function formatAUD(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "—";
  return "$" + Math.round(amount).toLocaleString("en-AU");
}

/** True when a title is still the bulk-upload placeholder ("Item 3"). */
export function isPlaceholderTitle(title: string): boolean {
  return /^Item \d+$/.test(title.trim());
}

export type Confidence = "high" | "medium" | "low";

/**
 * AI-stub confidence. With real AI this comes from the vision model; until then we
 * derive a meaningful badge from how complete the draft is, so the batch-review
 * "slow down on the red ones" UX still works:
 *   - real title + price        → high   (green, one-tap approve)
 *   - one of title/price missing → medium (amber, quick fix)
 *   - both missing               → low    (red, needs a full edit)
 */
export function itemConfidence(item: {
  title: string;
  price?: number | null;
}): Confidence {
  const hasTitle = !isPlaceholderTitle(item.title) && item.title.trim().length > 0;
  const hasPrice = item.price !== undefined && item.price !== null && item.price > 0;
  if (hasTitle && hasPrice) return "high";
  if (hasTitle || hasPrice) return "medium";
  return "low";
}

export const CONFIDENCE_META: Record<
  Confidence,
  { label: string; dot: string; text: string; ring: string }
> = {
  high: {
    label: "Looks good",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
  },
  medium: {
    label: "Quick check",
    dot: "bg-amber-500",
    text: "text-amber-700",
    ring: "ring-amber-200",
  },
  low: {
    label: "Needs review",
    dot: "bg-primary",
    text: "text-primary",
    ring: "ring-primary/30",
  },
};

/** "Saturday 12 Jul, 9:00am – 2:00pm" */
export function formatPickupRange(start: number, end: number): string {
  const day = format(start, "EEEE d MMM");
  const startTime = format(start, "h:mmaaa");
  const endTime = format(end, "h:mmaaa");
  return `${day}, ${startTime} – ${endTime}`;
}

/** Short label for cards/flyers: "Sat 12 Jul". */
export function formatPickupShort(start: number): string {
  return format(start, "EEE d MMM");
}

export interface PickupPreset {
  id: string;
  label: string;
  start: number;
  end: number;
}

/**
 * Generate friendly pickup presets ("This Saturday 9am–2pm") relative to `from`.
 * Sellers think in "this Saturday", not timestamps.
 */
export function getPickupPresets(from: Date = new Date()): PickupPreset[] {
  function atTime(base: Date, hour: number): number {
    const d = new Date(base);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  }
  // Day of week: 0 = Sun … 6 = Sat
  function nextWeekday(target: number, minDaysAhead = 1): Date {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    let add = (target - d.getDay() + 7) % 7;
    if (add < minDaysAhead) add += 7;
    d.setDate(d.getDate() + add);
    return d;
  }

  const thisSat = nextWeekday(6, 1);
  const thisSun = nextWeekday(0, 1);
  const nextSat = new Date(thisSat);
  nextSat.setDate(nextSat.getDate() + 7);

  return [
    {
      id: "this-sat",
      label: `This Saturday · ${format(thisSat, "d MMM")} · 9am–2pm`,
      start: atTime(thisSat, 9),
      end: atTime(thisSat, 14),
    },
    {
      id: "this-sun",
      label: `This Sunday · ${format(thisSun, "d MMM")} · 10am–1pm`,
      start: atTime(thisSun, 10),
      end: atTime(thisSun, 13),
    },
    {
      id: "next-sat",
      label: `Next Saturday · ${format(nextSat, "d MMM")} · 9am–2pm`,
      start: atTime(nextSat, 9),
      end: atTime(nextSat, 14),
    },
  ];
}

/** Build a datetime-local input value (local time) from a timestamp. */
export function toDateTimeLocal(ts: number): string {
  return format(ts, "yyyy-MM-dd'T'HH:mm");
}
