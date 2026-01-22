import { Link } from "react-router-dom";
import { Id } from "../../../../convex/_generated/dataModel";
import { memo, useCallback } from "react";
import { LayoutGrid, X } from "lucide-react";
import { getCategoryIcon } from "../../../lib/categoryIcons";

interface Category {
    _id: Id<"categories">;
    name: string;
    slug: string;
    icon?: string;
    parentId?: Id<"categories">;
}

interface SidebarContentProps {
    categories: Category[];
    selectedCategory: Id<"categories"> | null;
    setSelectedCategory: (categoryId: Id<"categories"> | null) => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    isLoading?: boolean;
    showCloseButton?: boolean;
}

/**
 * Shared sidebar content used by both mobile and desktop variants
 * Contains categories list and footer links
 */
export const SidebarContent = memo(function SidebarContent({
    categories,
    selectedCategory,
    setSelectedCategory,
    setSidebarCollapsed,
    isLoading,
    showCloseButton = false,
}: SidebarContentProps) {
    const handleSelectAllCategories = useCallback(() => {
        setSelectedCategory(null);
    }, [setSelectedCategory]);

    const handleSelectCategory = useCallback((categoryId: Id<"categories">) => {
        setSelectedCategory(categoryId);
    }, [setSelectedCategory]);

    return (
        <div className="h-full w-full flex flex-col bg-background">
            {/* Header - Fixed */}
            <div className="h-10 px-4 border-b border-border flex items-center justify-between flex-shrink-0">
                <h3 className="font-medium text-sm text-muted-foreground">Categories</h3>
                {showCloseButton && (
                    <button
                        onClick={() => setSidebarCollapsed(true)}
                        className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                        title="Close menu"
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Categories - Scrollable */}
            <div className="flex-1 overflow-y-auto space-y-1 p-4">
                <button
                    type="button"
                    onClick={handleSelectAllCategories}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 text-sm font-medium flex items-center gap-3 ${!selectedCategory
                        ? 'text-primary-bright bg-primary/10'
                        : 'text-foreground hover:bg-accent'
                        }`}
                >
                    <LayoutGrid className={`w-5 h-5 ${!selectedCategory ? "text-primary-bright" : "text-muted-foreground"}`} />
                    All Categories
                </button>

                {isLoading ? (
                    [...Array(8)].map((_, i) => (
                        <div key={i} className="w-full px-3 py-2 rounded-md flex items-center gap-3 animate-pulse">
                            <div className="w-5 h-5 bg-muted rounded-full" />
                            <div className="h-5 bg-muted rounded w-24" />
                        </div>
                    ))
                ) : (
                    categories.map((category) => {
                        const Icon = getCategoryIcon(category.icon);
                        const isSelected = selectedCategory === category._id;
                        return (
                            <button
                                type="button"
                                key={category._id}
                                onClick={() => handleSelectCategory(category._id)}
                                className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 text-sm font-medium flex items-center gap-3 ${isSelected
                                    ? 'text-primary-bright bg-primary/10'
                                    : 'text-foreground hover:bg-accent'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 ${isSelected ? "text-primary-bright" : "text-muted-foreground"}`} />
                                <span className="truncate">{category.name}</span>
                            </button>
                        );
                    })
                )}
            </div>

            {/* Footer - Fixed at bottom */}
            <div className="flex-shrink-0 border-t border-border pt-4 pb-1.5 px-4">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {[
                        { label: "About Us", href: "/about" },
                        { label: "Support", href: "/support" },
                        { label: "Terms & Conditions", href: "/terms" },
                        { label: "Privacy Policy", href: "/terms#privacy" },
                        { label: "Community Guidelines", href: "/community-guidelines" },
                        { label: "Contact", href: "/support" },
                    ].map((link) => (
                        <Link
                            key={link.label}
                            to={link.href}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200"
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                <div className="pt-4 text-[10px] text-muted-foreground/60">
                    © 2025 FlyerBoard
                </div>
            </div>
        </div>
    );
});
