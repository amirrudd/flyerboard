import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { useState } from "react";
import { ToggleLeft, ToggleRight, Plus, Trash2, Flag } from "lucide-react";

// Default flags to seed when the tab is first opened
const DEFAULT_FLAGS = [
    {
        key: "userSelfVerification",
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
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Flag className="w-6 h-6 text-primary-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Feature Flags</h2>
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-sm">
                        {featureFlags.length} flags
                    </span>
                </div>
                <div className="flex gap-2">
                    {featureFlags.length === 0 && (
                        <button
                            onClick={seedDefaultFlags}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Default Flags
                        </button>
                    )}
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Flag
                    </button>
                </div>
            </div>

            {/* Create New Flag Form */}
            {isCreating && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="font-medium text-gray-900 mb-3">Create New Feature Flag</h3>
                    <div className="space-y-3">
                        <div>
                            <label htmlFor="flag-key" className="block text-sm font-medium text-gray-700 mb-1">
                                Key (unique identifier)
                            </label>
                            <input
                                id="flag-key"
                                type="text"
                                value={newKey}
                                onChange={(e) => setNewKey(e.target.value)}
                                placeholder="e.g., newFeatureName"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="flag-description" className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <input
                                id="flag-description"
                                type="text"
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                placeholder="What does this flag control?"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => {
                                    setIsCreating(false);
                                    setNewKey("");
                                    setNewDescription("");
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                            >
                                Create Flag
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Flags List */}
            {featureFlags.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <Flag className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No feature flags configured</p>
                    <p className="text-sm">Run <code className="bg-gray-100 px-1 rounded">npx convex run migrations:seedFeatureFlags</code> to seed defaults.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {featureFlags.map((flag) => (
                        <div
                            key={flag._id}
                            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <code className="text-sm font-medium text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                                        {flag.key}
                                    </code>
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${flag.enabled
                                            ? "bg-green-100 text-green-700"
                                            : "bg-gray-100 text-gray-600"
                                            }`}
                                    >
                                        {flag.enabled ? "Enabled" : "Disabled"}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{flag.description}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleToggle(flag.key, flag.enabled)}
                                    disabled={pendingToggle === flag.key}
                                    className={`p-2 rounded-lg transition-colors ${flag.enabled
                                        ? "text-green-600 hover:bg-green-50"
                                        : "text-gray-400 hover:bg-gray-100"
                                        } ${pendingToggle === flag.key ? "opacity-50 cursor-not-allowed" : ""}`}
                                    title={flag.enabled ? "Click to disable" : "Click to enable"}
                                >
                                    {pendingToggle === flag.key ? (
                                        <div className="w-6 h-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600"></div>
                                    ) : flag.enabled ? (
                                        <ToggleRight className="w-6 h-6" />
                                    ) : (
                                        <ToggleLeft className="w-6 h-6" />
                                    )}
                                </button>
                                <button
                                    onClick={() => handleDelete(flag.key)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete flag"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-1">About Feature Flags</h3>
                <p className="text-sm text-blue-700">
                    Feature flags allow you to enable or disable features without code changes.
                    To sync flags between environments, add them to the <code className="bg-blue-100 px-1 rounded">seedFeatureFlags</code> migration in <code className="bg-blue-100 px-1 rounded">convex/migrations.ts</code>.
                </p>
            </div>
        </div>
    );
}
