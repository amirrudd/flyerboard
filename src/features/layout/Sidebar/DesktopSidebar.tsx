import { Id } from '../../../../convex/_generated/dataModel';
import { SidebarContent } from './SidebarContent';

interface Category {
    _id: Id<"categories">;
    name: string;
    slug: string;
    icon?: string;
    parentId?: Id<"categories">;
}

interface DesktopSidebarProps {
    categories: Category[];
    selectedCategory: Id<"categories"> | null;
    setSelectedCategory: (categoryId: Id<"categories"> | null) => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    isLoading?: boolean;
}

/**
 * Desktop sidebar - Sticky positioned, no overlay
 * Simple wrapper around SidebarContent
 */
export function DesktopSidebar({
    categories,
    selectedCategory,
    setSelectedCategory,
    setSidebarCollapsed,
    isLoading,
}: DesktopSidebarProps) {
    return (
        <div className="hidden md:block w-64 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin overscroll-contain">
            <SidebarContent
                categories={categories}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                setSidebarCollapsed={setSidebarCollapsed}
                isLoading={isLoading}
                showCloseButton={false}
            />
        </div>
    );
}
