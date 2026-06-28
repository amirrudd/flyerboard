import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Loader2 } from "lucide-react";

const LUCIDE_CDN_BASE = "https://cdn.jsdelivr.net/npm/lucide-static@0.517.0";
const TAGS_URL = `${LUCIDE_CDN_BASE}/tags.json`;

interface LucideIconPickerProps {
    value: string;
    onChange: (iconName: string) => void;
    onClose: () => void;
}

// Cache the tags data in memory
let tagsCache: Record<string, string[]> | null = null;

/**
 * Convert kebab-case to PascalCase for display
 */
function kebabToPascal(str: string): string {
    return str.split("-").map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join("");
}

/**
 * CDN-based Lucide icon picker with search across 1400+ icons
 */
export function LucideIconPicker({ value, onChange, onClose }: LucideIconPickerProps) {
    const [search, setSearch] = useState("");
    const [tags, setTags] = useState<Record<string, string[]> | null>(tagsCache);
    const [isLoading, setIsLoading] = useState(!tagsCache);
    const [error, setError] = useState<string | null>(null);

    // Fetch tags.json from CDN
    useEffect(() => {
        if (tagsCache) {
            // Hydrate synchronously from module-level cache on subsequent mounts.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setTags(tagsCache);
            setIsLoading(false);
            return;
        }

        fetch(TAGS_URL)
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch icons");
                return res.json();
            })
            .then(data => {
                tagsCache = data;
                setTags(data);
                setIsLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setIsLoading(false);
            });
    }, []);

    // Filter icons based on search
    const filteredIcons = useMemo(() => {
        if (!tags) return [];

        const searchLower = search.toLowerCase().trim();
        if (!searchLower) {
            // Return first 50 icons when no search
            return Object.keys(tags).slice(0, 50);
        }

        return Object.entries(tags)
            .filter(([name, iconTags]) => {
                // Match icon name
                if (name.includes(searchLower)) return true;
                // Match any tag
                return iconTags.some(tag => tag.toLowerCase().includes(searchLower));
            })
            .map(([name]) => name)
            .slice(0, 100); // Limit results for performance
    }, [tags, search]);

    const handleSelect = useCallback((iconName: string) => {
        // Convert to PascalCase for storage (matches lucide-react component names)
        onChange(kebabToPascal(iconName));
        onClose();
    }, [onChange, onClose]);

    if (isLoading) {
        return (
            <div className="absolute z-10 w-full mt-1 bg-card ring-1 ring-border/70 rounded-2xl shadow-lg p-8" role="status" aria-live="polite">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                    <span className="text-sm">Loading icons...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="absolute z-10 w-full mt-1 bg-card ring-1 ring-border/70 rounded-2xl shadow-lg p-4" role="alert">
                <div className="text-destructive text-sm text-center">
                    Failed to load icons. Please try again.
                </div>
            </div>
        );
    }

    return (
        <div className="absolute z-10 w-full mt-1 bg-card ring-1 ring-border/70 rounded-2xl shadow-lg overflow-hidden">
            {/* Search Input */}
            <div className="p-3 border-b border-border">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                    <label htmlFor="lucide-icon-search" className="sr-only">Search icons</label>
                    <input
                        id="lucide-icon-search"
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search 1400+ icons..."
                        className="w-full h-10 pl-10 pr-4 text-sm bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all placeholder:text-muted-foreground/70 text-foreground"
                        autoFocus
                    />
                </div>
                <p className="text-xs text-muted-foreground mt-2 px-1">
                    Search by name or keyword (e.g., "car", "home", "arrow")
                </p>
            </div>

            {/* Icon Grid */}
            <div className="max-h-64 overflow-y-auto">
                {filteredIcons.length === 0 ? (
                    <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                        No icons found for "{search}"
                    </div>
                ) : (
                    <div className="grid grid-cols-5 gap-1.5 p-3">
                        {filteredIcons.map((iconName) => {
                            const pascalName = kebabToPascal(iconName);
                            const isSelected = value === pascalName;
                            return (
                                <button
                                    key={iconName}
                                    type="button"
                                    onClick={() => handleSelect(iconName)}
                                    className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${isSelected
                                        ? "bg-primary/10 text-primary ring-2 ring-primary"
                                        : "ring-1 ring-transparent hover:bg-muted/60 hover:ring-border/60 text-foreground"
                                        }`}
                                    title={pascalName}
                                    aria-label={pascalName}
                                    aria-pressed={isSelected}
                                >
                                    {/* SVG from CDN */}
                                    <img
                                        src={`${LUCIDE_CDN_BASE}/icons/${iconName}.svg`}
                                        alt=""
                                        className="w-5 h-5 dark:invert dark:brightness-200"
                                        loading="lazy"
                                    />
                                    <span className="text-[9px] truncate w-full text-center text-muted-foreground">
                                        {pascalName}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-border text-xs text-muted-foreground text-center tabular-nums">
                {filteredIcons.length} icons shown
                {search && ` for "${search}"`}
            </div>
        </div>
    );
}
