import { useState } from "react";
import { CircleNotch, Check } from "@phosphor-icons/react";
import { getPickupPresets, toDateTimeLocal } from "../saleHelpers";

export interface SetupValues {
  title: string;
  suburb: string;
  note: string;
  pickupWindowStart: number;
  pickupWindowEnd: number;
}

interface SetupStepProps {
  defaultFirstName: string;
  initial?: Partial<SetupValues>;
  submitting: boolean;
  onSubmit: (values: SetupValues) => void;
}

export function SetupStep({
  defaultFirstName,
  initial,
  submitting,
  onSubmit,
}: SetupStepProps) {
  const presets = getPickupPresets();
  const [title, setTitle] = useState(
    initial?.title ?? `${defaultFirstName}'s Moving Sale`
  );
  const [suburb, setSuburb] = useState(initial?.suburb ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [presetId, setPresetId] = useState<string>(
    initial?.pickupWindowStart ? "custom" : presets[0].id
  );
  const [customStart, setCustomStart] = useState(
    initial?.pickupWindowStart ?? presets[0].start
  );
  const [customEnd, setCustomEnd] = useState(
    initial?.pickupWindowEnd ?? presets[0].end
  );
  const [error, setError] = useState<string | null>(null);

  function resolveWindow(): { start: number; end: number } {
    if (presetId === "custom") return { start: customStart, end: customEnd };
    const preset = presets.find((p) => p.id === presetId) ?? presets[0];
    return { start: preset.start, end: preset.end };
  }

  function handleSubmit() {
    if (!suburb.trim()) {
      setError("Add the suburb so buyers know where to come.");
      return;
    }
    const { start, end } = resolveWindow();
    if (end <= start) {
      setError("Pickup must end after it starts.");
      return;
    }
    setError(null);
    onSubmit({
      title: title.trim() || `${defaultFirstName}'s Moving Sale`,
      suburb: suburb.trim(),
      note: note.trim(),
      pickupWindowStart: start,
      pickupWindowEnd: end,
    });
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-card px-3.5 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h2 className="font-display text-2xl font-semibold text-foreground">
        Set up your sale
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A few details so buyers know what, where, and when.
      </p>

      <div className="mt-6 space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Sale name
          </label>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Amir's Moving Sale"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Suburb
          </label>
          <input
            className={inputClass}
            value={suburb}
            onChange={(e) => setSuburb(e.target.value)}
            placeholder="Richmond, VIC"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Pickup window
          </label>
          <div className="space-y-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setPresetId(preset.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-sm transition ${
                  presetId === preset.id
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/40"
                }`}
              >
                <span>{preset.label}</span>
                {presetId === preset.id && (
                  <Check size={18} weight="bold" className="text-primary" />
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPresetId("custom")}
              className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-sm transition ${
                presetId === "custom"
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/40"
              }`}
            >
              <span>Pick a custom time</span>
              {presetId === "custom" && (
                <Check size={18} weight="bold" className="text-primary" />
              )}
            </button>
            {presetId === "custom" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground">Start</span>
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={toDateTimeLocal(customStart)}
                    onChange={(e) => setCustomStart(new Date(e.target.value).getTime())}
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground">End</span>
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={toDateTimeLocal(customEnd)}
                    onChange={(e) => setCustomEnd(new Date(e.target.value).getTime())}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Note for buyers <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            className={`${inputClass} min-h-[72px] resize-none`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Everything must go before we move. Cash or transfer."
          />
        </div>

        {error && <p className="text-sm text-primary">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground transition active:scale-[0.99] disabled:opacity-60"
        >
          {submitting && <CircleNotch size={18} className="animate-spin" />}
          Continue to photos
        </button>
      </div>
    </div>
  );
}
