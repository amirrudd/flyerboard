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
        <div className="h-full flex flex-col bg-white">
            <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-medium text-sm text-gray-500">Categories</h3>
                {showCloseButton && (
                    <button
                        onClick={() => setSidebarCollapsed(true)}
                        className="p-2 -mr-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Close menu"
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="space-y-1 p-4">
                <button
                    type="button"
                    onClick={handleSelectAllCategories}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 text-sm font-medium flex items-center gap-3 ${!selectedCategory
                            ? 'text-primary-700 bg-primary-50'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                >
                    <LayoutGrid className={`w-5 h-5 ${!selectedCategory ? "text-primary-700" : "text-gray-500"}`} />
                    All Categories
                </button>

                {isLoading ? (
                    [...Array(8)].map((_, i) => (
                        <div key={i} className="w-full px-3 py-2 flex items-center gap-3 animate-pulse">
                            <div className="w-5 h-5 bg-gray-200 rounded-full" />
                            <div className="h-4 bg-gray-200 rounded w-24" />
                        </div>
                    ))
                ) : (
                    categories.map((category) => {
                        const Icon = getCategoryIcon(category.slug, category.icon);
                        const isSelected = selectedCategory === category._id;
                        return (
                            <button
                                type="button"
                                key={category._id}
                                onClick={() => handleSelectCategory(category._id)}
                                className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 text-sm font-medium flex items-center gap-3 ${isSelected
                                        ? 'text-primary-700 bg-primary-50'
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 ${isSelected ? "text-primary-700" : "text-gray-500"}`} />
                                <span className="truncate">{category.name}</span>
                            </button>
                        );
                    })
                )}
            </div>

            <div className="my-4 border-t border-gray-200"></div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 px-2">
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
                        className="text-xs text-gray-500 hover:text-gray-900 transition-colors duration-200"
                    >
                        {link.label}
                    </Link>
                ))}
            </div>

            <div className="px-2 pt-4 text-[10px] text-gray-400">
                © 2025 FlyerBoard
            </div>
        </div>
    );
});
