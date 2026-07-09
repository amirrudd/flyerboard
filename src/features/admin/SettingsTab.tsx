import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { useState } from "react";
import { Sliders } from "@phosphor-icons/react";
import {
    SETTING_BOOST_COOLDOWN_DAYS,
    SETTING_BOOST_DAILY_CAP,
    BOOST_COOLDOWN_DAYS_MIN,
    BOOST_COOLDOWN_DAYS_MAX,
    BOOST_DAILY_CAP_MIN,
    BOOST_DAILY_CAP_MAX,
    DEFAULT_BOOST_COOLDOWN_DAYS,
    DEFAULT_BOOST_DAILY_CAP,
} from "../../../convex/lib/boost";

/**
 * Admin "Settings" tab — numeric, admin-tunable app config (the numeric sibling of
 * FeatureFlagsTab, which stores booleans). First consumers are the two Boost knobs:
 * cooldown days + per-user daily cap. Ranges/defaults are imported from
 * convex/lib/boost.ts (frontend-safe) and never hardcoded here, so the client bounds
 * always track the server's clamp/reject logic.
 */

// Field recipe for each known numeric setting. `unit` is the noun used in the
// out-of-range helper ("Enter 1–30 days"); `suffix` is the label rendered beside
// the input. Bounds/defaults come from convex/lib/boost.ts.
const SETTING_FIELDS = [
    {
        key: SETTING_BOOST_COOLDOWN_DAYS,
        label: "Boost cooldown",
        suffix: "days",
        unit: "days",
        min: BOOST_COOLDOWN_DAYS_MIN,
        max: BOOST_COOLDOWN_DAYS_MAX,
        fallback: DEFAULT_BOOST_COOLDOWN_DAYS,
        note: "Changes apply immediately — in-progress countdowns recompute live.",
    },
    {
        key: SETTING_BOOST_DAILY_CAP,
        label: "Daily boost cap",
        suffix: "boosts per user / day",
        unit: "boosts",
        min: BOOST_DAILY_CAP_MIN,
        max: BOOST_DAILY_CAP_MAX,
        fallback: DEFAULT_BOOST_DAILY_CAP,
        note: undefined as string | undefined,
    },
] as const;

export function SettingsTab() {
    const settings = useQuery(api.appSettings.getAllSettings);
    const updateSetting = useMutation(api.appSettings.updateSetting);

    // Draft edits keyed by setting key. A key is present only while the admin is
    // mid-edit; once saved we delete it so the input falls back to the (now updated,
    // reactive) server value — no useEffect syncing needed.
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [savingKey, setSavingKey] = useState<string | null>(null);

    if (settings === undefined) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    const byKey = new Map(settings.map((s) => [s.key, s]));

    const handleSave = async (key: string, label: string, value: number) => {
        setSavingKey(key);
        try {
            await updateSetting({ key, value });
            toast.success(`${label} updated`);
            setDrafts((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : `Failed to update ${label}`);
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <section className="space-y-6">
            {/* Header */}
            <header className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <Sliders className="w-6 h-6 text-primary" aria-hidden="true" />
                    <div>
                        <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-1">Configuration</h3>
                        <div className="flex items-center gap-2">
                            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Settings</h2>
                            <span className="bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase ring-1 ring-border tabular-nums">
                                {SETTING_FIELDS.length} settings
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Settings List */}
            <div className="space-y-4">
                {SETTING_FIELDS.map((field) => {
                    const setting = byKey.get(field.key);
                    const isMissing = !setting;
                    const serverValue = setting ? setting.value : field.fallback;
                    const draft = drafts[field.key];
                    const inputValue = draft ?? String(serverValue);

                    const parsed = Number(inputValue);
                    const isValid =
                        inputValue.trim() !== "" &&
                        Number.isInteger(parsed) &&
                        parsed >= field.min &&
                        parsed <= field.max;
                    const isChanged = inputValue !== String(serverValue);
                    const isSaving = savingKey === field.key;
                    const canSave = isValid && isChanged && !isSaving && !isMissing;

                    const inputId = `setting-${field.key}`;
                    const helperId = `${inputId}-helper`;

                    return (
                        <article
                            key={field.key}
                            className="bg-card ring-1 ring-border/70 rounded-2xl p-5 shadow-sm"
                        >
                            <label
                                htmlFor={inputId}
                                className="block text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2"
                            >
                                {field.label}
                            </label>
                            {setting?.description && (
                                <p className="text-sm text-foreground/80 leading-relaxed mb-3">{setting.description}</p>
                            )}
                            <div className="flex items-center gap-3 flex-wrap">
                                <input
                                    id={inputId}
                                    type="number"
                                    inputMode="numeric"
                                    min={field.min}
                                    max={field.max}
                                    step={1}
                                    value={inputValue}
                                    disabled={isMissing}
                                    aria-invalid={!isValid}
                                    aria-describedby={!isValid ? helperId : undefined}
                                    onChange={(e) =>
                                        setDrafts((prev) => ({ ...prev, [field.key]: e.target.value }))
                                    }
                                    className="w-28 h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground placeholder:text-muted-foreground/70 tabular-nums disabled:opacity-50 disabled:cursor-not-allowed aria-[invalid=true]:ring-destructive/60"
                                />
                                <span className="text-sm text-muted-foreground">{field.suffix}</span>
                                <button
                                    type="button"
                                    onClick={() => { void handleSave(field.key, field.label, parsed); }}
                                    disabled={!canSave}
                                    className="ml-auto inline-flex items-center gap-2 h-11 px-4 bg-primary text-primary-foreground rounded-full text-sm font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:bg-primary disabled:active:scale-100"
                                >
                                    {isSaving && (
                                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" aria-hidden="true"></div>
                                    )}
                                    Save
                                </button>
                            </div>
                            {!isValid && (
                                <p id={helperId} className="text-sm text-destructive mt-2">
                                    Enter {field.min}–{field.max} {field.unit}
                                </p>
                            )}
                            {isMissing && (
                                <p className="text-sm text-destructive mt-2">
                                    Not configured — run <code className="bg-muted/60 px-1 rounded text-foreground tabular-nums">npx convex run migrations:seedAppSettings</code>
                                </p>
                            )}
                            {field.note && (
                                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{field.note}</p>
                            )}
                        </article>
                    );
                })}
            </div>

            {/* Info Card */}
            <aside className="bg-blue-500/10 ring-1 ring-blue-500/20 rounded-2xl p-4">
                <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-blue-700 dark:text-blue-400 mb-2">About Settings</h3>
                <p className="text-sm text-blue-600/80 dark:text-blue-300/80 leading-relaxed">
                    Numeric configuration applied live across the app. Values are bounded on both
                    the client and the server, so an out-of-range entry is rejected rather than
                    silently clamped. Seed defaults with <code className="bg-blue-500/10 px-1 rounded text-blue-700 dark:text-blue-400 tabular-nums">npx convex run migrations:seedAppSettings</code>.
                </p>
            </aside>
        </section>
    );
}
