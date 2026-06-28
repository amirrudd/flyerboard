import { Link } from "react-router-dom";
import { Id } from "../../../../convex/_generated/dataModel";
import { memo, useCallback } from "react";
import { GridFour, X } from '@phosphor-icons/react';
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

    const itemBase = "relative w-full text-left pl-4 pr-3 py-2 rounded-lg transition-all duration-200 text-sm flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

    return (
        <div className="h-full w-full flex flex-col bg-background">
            {/* Header - Fixed */}
            <div className="h-10 px-4 border-b border-border/70 flex items-center justify-between flex-shrink-0">
                <h2 className="kicker">Categories</h2>
                {showCloseButton && (
                    <button
                        onClick={() => setSidebarCollapsed(true)}
                        className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Close menu"
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Categories - Scrollable */}
            <nav className="flex-1 overflow-y-auto space-y-0.5 p-3" aria-label="Categories">
                <button
                    type="button"
                    onClick={handleSelectAllCategories}
                    className={`${itemBase} font-medium ${!selectedCategory
                        ? 'text-foreground bg-muted/70'
                        : 'text-foreground/85 hover:bg-muted/50 hover:text-foreground'
                        }`}
                >
                    {!selectedCategory && (
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-primary rounded-r-full" aria-hidden />
                    )}
                    <GridFour className={`w-[18px] h-[18px] flex-shrink-0 ${!selectedCategory ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="truncate">All Categories</span>
                </button>

                {isLoading ? (
                    [...Array(8)].map((_, i) => (
                        <div key={i} className="w-full px-4 py-2 rounded-lg flex items-center gap-3">
                            <div className="w-[18px] h-[18px] shimmer rounded-md flex-shrink-0" />
                            <div className="h-4 shimmer rounded w-24" />
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
                                className={`${itemBase} font-medium ${isSelected
                                    ? 'text-foreground bg-muted/70'
                                    : 'text-foreground/85 hover:bg-muted/50 hover:text-foreground'
                                    }`}
                            >
                                {isSelected && (
                                    <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-primary rounded-r-full" aria-hidden />
                                )}
                                <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                                <span className="truncate">{category.name}</span>
                            </button>
                        );
                    })
                )}
            </nav>

            {/* Footer - Fixed at bottom */}
            <div className="flex-shrink-0 border-t border-border/70 pt-4 pb-3 px-4">
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                    {[
                        { label: "About Us", href: "/about" },
                        { label: "Support", href: "/support" },
                        { label: "Terms", href: "/terms" },
                        { label: "Privacy", href: "/terms#privacy" },
                        { label: "Guidelines", href: "/community-guidelines" },
                        { label: "Contact", href: "/support" },
                    ].map((link) => (
                        <Link
                            key={link.label}
                            to={link.href}
                            className="text-[11px] tracking-wide text-muted-foreground hover:text-foreground transition-colors duration-200"
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                <div className="pt-4 text-[10px] tracking-wider uppercase text-muted-foreground font-medium">
                    © 2026 FlyerBoard
                </div>
            </div>
        </div>
    );
});
