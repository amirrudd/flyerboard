import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { useState } from "react";
import { ToggleLeft, ToggleRight, Plus, Trash2, Flag } from "lucide-react";

// Default flags to seed when the tab is first opened
const DEFAULT_FLAGS = [
    {
        key: "identityVerification",
        description: "Allow users to self-verify their identity from their dashboard",
        enabled: true,
    },
];

export function FeatureFlagsTab() {
    const featureFlags = useQuery(api.featureFlags.getAllFeatureFlags);
    const updateFlag = useMutation(api.featureFlags.updateFeatureFlag);
    const createFlag = useMutation(api.featureFlags.createFeatureFlag);
    const deleteFlag = useMutation(api.featureFlags.deleteFeatureFlag);

    const [isCreating, setIsCreating] = useState(false);
    const [newKey, setNewKey] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [pendingToggle, setPendingToggle] = useState<string | null>(null);

    // Seed default flags if none exist
    const seedDefaultFlags = async () => {
        for (const flag of DEFAULT_FLAGS) {
            try {
                await createFlag(flag);
            } catch {
                // Flag already exists, ignore
            }
        }
        toast.success("Default feature flags created");
    };

    const handleToggle = async (key: string, currentEnabled: boolean) => {
        setPendingToggle(key);
        try {
            await updateFlag({ key, enabled: !currentEnabled });
            toast.success(`Feature flag "${key}" ${!currentEnabled ? "enabled" : "disabled"}`);
        } catch (error) {
            toast.error("Failed to update feature flag");
        } finally {
            setPendingToggle(null);
        }
    };

    const handleCreate = async () => {
        if (!newKey.trim() || !newDescription.trim()) {
            toast.error("Key and description are required");
            return;
        }

        try {
            await createFlag({
                key: newKey.trim(),
                description: newDescription.trim(),
                enabled: false,
            });
            toast.success(`Feature flag "${newKey}" created`);
            setNewKey("");
            setNewDescription("");
            setIsCreating(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create feature flag");
        }
    };

    const handleDelete = async (key: string) => {
        if (!confirm(`Are you sure you want to delete the "${key}" feature flag?`)) {
            return;
        }

        try {
            await deleteFlag({ key });
            toast.success(`Feature flag "${key}" deleted`);
        } catch (error) {
            toast.error("Failed to delete feature flag");
        }
    };

    if (featureFlags === undefined) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    return (
        <section className="space-y-6">
            {/* Header */}
            <header className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <Flag className="w-6 h-6 text-primary" aria-hidden="true" />
                    <div>
                        <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-1">Configuration</h3>
                        <div className="flex items-center gap-2">
                            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Feature Flags</h2>
                            <span className="bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase ring-1 ring-border tabular-nums">
                                {featureFlags.length} flags
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {featureFlags.length === 0 && (
                        <button
                            type="button"
                            onClick={seedDefaultFlags}
                            className="inline-flex items-center gap-2 h-11 px-4 bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/20 active:scale-[0.98] rounded-full text-sm font-medium transition-all"
                        >
                            <Plus className="w-4 h-4" aria-hidden="true" />
                            Add Default Flags
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsCreating(true)}
                        className="inline-flex items-center gap-2 h-11 px-4 bg-primary text-primary-foreground rounded-full font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        New Flag
                    </button>
                </div>
            </header>

            {/* Create New Flag Form */}
            {isCreating && (
                <div className="bg-card ring-1 ring-border/70 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-4">Create New Feature Flag</h3>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="flag-key" className="block text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">
                                Key (unique identifier)
                            </label>
                            <input
                                id="flag-key"
                                type="text"
                                value={newKey}
                                onChange={(e) => setNewKey(e.target.value)}
                                placeholder="e.g., newFeatureName"
                                className="w-full h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground placeholder:text-muted-foreground/70"
                            />
                        </div>
                        <div>
                            <label htmlFor="flag-description" className="block text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">
                                Description
                            </label>
                            <input
                                id="flag-description"
                                type="text"
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                placeholder="What does this flag control?"
                                className="w-full h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground placeholder:text-muted-foreground/70"
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCreating(false);
                                    setNewKey("");
                                    setNewDescription("");
                                }}
                                className="h-11 px-4 bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] rounded-full text-sm font-medium transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCreate}
                                className="h-11 px-4 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] rounded-full text-sm font-semibold shadow-sm shadow-primary/25 transition-all"
                            >
                                Create Flag
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Flags List */}
            {featureFlags.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Flag className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" aria-hidden="true" />
                    <p className="font-display text-xl font-semibold tracking-tight text-foreground">No feature flags configured</p>
                    <p className="text-sm mt-1">Run <code className="bg-muted/60 px-1 rounded text-foreground tabular-nums">npx convex run migrations:seedFeatureFlags</code> to seed defaults.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {featureFlags.map((flag) => (
                        <article
                            key={flag._id}
                            className="flex items-center justify-between gap-4 p-4 bg-card ring-1 ring-border/70 rounded-2xl shadow-sm hover:ring-foreground/15 transition-colors"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <code className="text-sm font-medium text-foreground bg-muted/60 ring-1 ring-border px-2 py-0.5 rounded-full tabular-nums">
                                        {flag.key}
                                    </code>
                                    <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase ring-1 ${flag.enabled
                                            ? "bg-green-500/10 text-green-700 dark:text-green-400 ring-green-500/30"
                                            : "bg-muted text-muted-foreground ring-border"
                                            }`}
                                    >
                                        {flag.enabled ? "Enabled" : "Disabled"}
                                    </span>
                                </div>
                                <p className="text-sm text-foreground/80 mt-1 leading-relaxed">{flag.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleToggle(flag.key, flag.enabled)}
                                    disabled={pendingToggle === flag.key}
                                    aria-label={flag.enabled ? `Disable ${flag.key}` : `Enable ${flag.key}`}
                                    className={`w-10 h-10 rounded-full inline-flex items-center justify-center transition-all active:scale-[0.98] ${flag.enabled
                                        ? "text-green-600 hover:bg-green-500/10"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                        } ${pendingToggle === flag.key ? "opacity-50 cursor-not-allowed" : ""}`}
                                    title={flag.enabled ? "Click to disable" : "Click to enable"}
                                >
                                    {pendingToggle === flag.key ? (
                                        <div className="w-6 h-6 animate-spin rounded-full border-2 border-muted border-t-primary" aria-hidden="true"></div>
                                    ) : flag.enabled ? (
                                        <ToggleRight className="w-6 h-6" aria-hidden="true" />
                                    ) : (
                                        <ToggleLeft className="w-6 h-6" aria-hidden="true" />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(flag.key)}
                                    aria-label={`Delete ${flag.key}`}
                                    className="w-10 h-10 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all active:scale-[0.98]"
                                    title="Delete flag"
                                >
                                    <Trash2 className="w-5 h-5" aria-hidden="true" />
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {/* Info Card */}
            <aside className="bg-blue-500/10 ring-1 ring-blue-500/20 rounded-2xl p-4">
                <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-blue-700 dark:text-blue-400 mb-2">About Feature Flags</h3>
                <p className="text-sm text-blue-600/80 dark:text-blue-300/80 leading-relaxed">
                    Feature flags allow you to enable or disable features without code changes.
                    To sync flags between environments, add them to the <code className="bg-blue-500/10 px-1 rounded text-blue-700 dark:text-blue-400 tabular-nums">seedFeatureFlags</code> migration in <code className="bg-blue-500/10 px-1 rounded text-blue-700 dark:text-blue-400 tabular-nums">convex/migrations.ts</code>.
                </p>
            </aside>
        </section>
    );
}
